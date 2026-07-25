import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
import { useStrategyStore } from '@/store/strategyStore';
import { DEFAULT_ICE_SERVERS, getRoomIdFromUrl } from '@/services/realtimeService';
import { supabase } from '@/services/supabaseClient';

export interface PeerUser {
  id: string;
  name: string;
  slot: number;
  role: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
}

const DYNASTY_ROSTER = [
  { slot: 1, name: 'DXxTushar1704M', role: 'IGL / Leader' },
  { slot: 2, name: 'DXxMystic', role: 'Assaulter' },
  { slot: 3, name: 'DXxJester', role: 'Assaulter' },
  { slot: 4, name: 'DXxVillian', role: 'Assaulter' },
  { slot: 5, name: 'DXxDeep', role: 'Assaulter' },
];

export function useVoiceChat({ roomCode, userName = 'DXxPlayer' }: { roomCode?: string; userName?: string }) {
  const activeRoomId = (roomCode || getRoomIdFromUrl()).toUpperCase();

  const [isConnected, setIsConnected] = useState(false);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [claimedSlot, setClaimedSlot] = useState<number | null>(null);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const isIncomingSyncRef = useRef(false);

  // Initialize BroadcastChannel for local cross-tab syncing
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('dynastyx-tactical-sync');
      broadcastChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STORE' && event.data?.state) {
          isIncomingSyncRef.current = true;
          useStrategyStore.setState(event.data.state);
          setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
        }
      };
    } catch (e) {}
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, []);

  // Initialize Supabase Realtime broadcast channel when connected to room
  useEffect(() => {
    if (supabase && inVoiceRoom && activeRoomId) {
      const channelName = `dynastyx-room:${activeRoomId.toLowerCase()}`;
      console.log(`[Supabase Realtime] Connecting to channel: ${channelName}`);
      const channel = supabase.channel(channelName, {
        config: { broadcast: { self: false } },
      });

      channel.on('broadcast', { event: 'SYNC_STORE' }, (payload: any) => {
        if (payload?.payload?.state) {
          isIncomingSyncRef.current = true;
          useStrategyStore.setState(payload.payload.state);
          setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
        }
      }).subscribe();

      supabaseChannelRef.current = channel;

      return () => {
        supabase?.removeChannel(channel);
        supabaseChannelRef.current = null;
      };
    }
  }, [inVoiceRoom, activeRoomId]);

  // Broadcast strategy store changes across WebRTC & Supabase Realtime
  const broadcastStoreState = useCallback((stateSnapshot: any) => {
    if (isIncomingSyncRef.current) return;
    const payload = {
      type: 'SYNC_STORE',
      state: {
        markers: stateSnapshot.markers,
        players: stateSnapshot.players,
        drawings: stateSnapshot.drawings,
        safeZones: stateSnapshot.safeZones,
        flightPaths: stateSnapshot.flightPaths,
        vehiclePaths: stateSnapshot.vehiclePaths,
      },
    };

    // 1. Broadcast across PeerJS Data Connections to remote devices
    dataConnsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
      }
    });

    // 2. Broadcast across Supabase Realtime Channel
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'SYNC_STORE',
        payload: { state: payload.state },
      });
    }

    // 3. Broadcast across local browser tabs
    try {
      broadcastChannelRef.current?.postMessage(payload);
    } catch (e) {}
  }, []);

  // Subscribe to Zustand store mutations to trigger real-time peer sync
  useEffect(() => {
    const unsub = useStrategyStore.subscribe((state) => {
      if (inVoiceRoom) {
        broadcastStoreState(state);
      }
    });
    return () => unsub();
  }, [inVoiceRoom, broadcastStoreState]);

  // Enumerate input audio devices
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      }).catch(() => {});
    }
  }, []);

  // Attach & play remote WebRTC audio stream (Single HTML5 Audio element per peer, NEVER self stream)
  const attachRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    if (!peerId || peerId === peerRef.current?.id) return;
    if (claimedSlot && peerId.endsWith(`-slot-${claimedSlot}`)) return;

    try {
      let audioEl = document.getElementById(`audio-peer-${peerId}`) as HTMLAudioElement;
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `audio-peer-${peerId}`;
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }
      if (audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }
      audioEl.volume = 0.85;
      audioEl.muted = isDeafened;

      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          const unlock = () => {
            audioEl.play().catch(() => {});
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
          };
          document.addEventListener('click', unlock);
          document.addEventListener('touchstart', unlock);
        });
      }
    } catch (e) {
      console.warn('[Voice Stream Playback Notice]', e);
    }
  }, [claimedSlot, isDeafened]);

  const removeRemoteAudio = (peerId: string) => {
    const audioEl = document.getElementById(`audio-peer-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  // Setup PeerJS Data Connection for real-time tactical tool syncing
  const setupDataConnection = (conn: DataConnection) => {
    dataConnsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
      console.log(`[PeerJS DataSync] Data channel opened with ${conn.peer}`);
      const currentState = useStrategyStore.getState();
      conn.send({
        type: 'SYNC_STORE',
        state: {
          markers: currentState.markers,
          players: currentState.players,
          drawings: currentState.drawings,
          safeZones: currentState.safeZones,
          flightPaths: currentState.flightPaths,
          vehiclePaths: currentState.vehiclePaths,
        },
      });
    });

    conn.on('data', (data: any) => {
      if (data?.type === 'SYNC_STORE' && data?.state) {
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(data.state);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    conn.on('close', () => {
      dataConnsRef.current.delete(conn.peer);
    });
  };

  // Connect to remote peer slot with guaranteed active local stream
  const connectToPeer = useCallback((remotePeerId: string, peer: Peer, stream: MediaStream) => {
    if (!remotePeerId || remotePeerId === peer.id || callsRef.current.has(remotePeerId)) return;
    try {
      const activeStream = localStreamRef.current || stream;
      console.log(`[Voice WebRTC] Calling remote teammate slot: ${remotePeerId}`);
      const call = peer.call(remotePeerId, activeStream);
      if (call) {
        callsRef.current.set(remotePeerId, call);

        call.on('stream', (remoteStream) => {
          console.log(`[Voice WebRTC] Connected audio stream with ${remotePeerId}`);
          attachRemoteAudio(remotePeerId, remoteStream);
          const slotNum = parseInt(remotePeerId.split('-slot-')[1] || '1', 10);
          const rosterItem = DYNASTY_ROSTER.find((r) => r.slot === slotNum) || { name: `Player ${slotNum}`, role: 'Teammate' };
          setPeers((prev) => [
            ...prev.filter((p) => p.id !== remotePeerId),
            { id: remotePeerId, slot: slotNum, name: rosterItem.name, role: rosterItem.role },
          ]);
        });

        call.on('close', () => {
          removeRemoteAudio(remotePeerId);
          callsRef.current.delete(remotePeerId);
          setPeers((prev) => prev.filter((p) => p.id !== remotePeerId));
        });
      }

      const conn = peer.connect(remotePeerId);
      if (conn) {
        setupDataConnection(conn);
      }
    } catch (e) {}
  }, [attachRemoteAudio]);

  // Periodic Squad Mesh Health Check: Automatically connects all 1..10 squad slots
  useEffect(() => {
    if (!inVoiceRoom || !peerRef.current || !localStreamRef.current) return;

    const interval = setInterval(() => {
      const cleanCode = activeRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
      const currentPeer = peerRef.current;
      const stream = localStreamRef.current;

      if (!currentPeer || currentPeer.destroyed || !stream) return;

      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((s) => {
        if (claimedSlot && s !== claimedSlot) {
          const targetPeerId = `dynastyx-${cleanCode}-slot-${s}`;
          if (!callsRef.current.has(targetPeerId)) {
            connectToPeer(targetPeerId, currentPeer, stream);
          }
        }
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [inVoiceRoom, activeRoomId, claimedSlot, connectToPeer]);

  // Attempt to claim deterministic slot in Room (slot-1 to slot-20 unlimited)
  const tryJoinSlot = (slotIndex: number, targetRoomId: string, stream: MediaStream) => {
    const cleanCode = targetRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const peerId = `dynastyx-${cleanCode}-slot-${slotIndex}`;

    const peer = new Peer(peerId, {
      config: {
        iceServers: DEFAULT_ICE_SERVERS,
      },
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setIsConnected(true);
      setInVoiceRoom(true);
      setClaimedSlot(slotIndex);
      console.log(`[PeerJS Voice] Connected to DynastyX Room ${targetRoomId} as Slot ${slotIndex} (${id})`);

      const activeStream = localStreamRef.current || stream;

      // Attempt to connect to all other slots in squad
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((s) => {
        if (s !== slotIndex) {
          const targetPeerId = `dynastyx-${cleanCode}-slot-${s}`;
          connectToPeer(targetPeerId, peer, activeStream);
        }
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        tryJoinSlot(slotIndex + 1, targetRoomId, stream);
      } else {
        console.warn('[PeerJS Notice]', err.type || err);
      }
    });

    peer.on('connection', (conn) => {
      setupDataConnection(conn);
    });

    peer.on('call', (call) => {
      if (callsRef.current.has(call.peer)) return;
      console.log(`[PeerJS Voice] Answering call from ${call.peer}`);
      const activeStream = localStreamRef.current || stream;
      call.answer(activeStream);
      callsRef.current.set(call.peer, call);

      call.on('stream', (remoteStream) => {
        console.log(`[PeerJS Voice] Connected audio stream from ${call.peer}`);
        attachRemoteAudio(call.peer, remoteStream);
        const slotNum = parseInt(call.peer.split('-slot-')[1] || '1', 10);
        const rosterItem = DYNASTY_ROSTER.find((r) => r.slot === slotNum) || { name: `DXxMember-${slotNum}`, role: 'Teammate' };
        setPeers((prev) => [
          ...prev.filter((p) => p.id !== call.peer),
          { id: call.peer, slot: slotNum, name: rosterItem.name, role: rosterItem.role },
        ]);
      });

      call.on('close', () => {
        removeRemoteAudio(call.peer);
        callsRef.current.delete(call.peer);
        setPeers((prev) => prev.filter((p) => p.id !== call.peer));
      });
    });
  };

  // Leave Voice Room and release slot immediately
  const leaveVoiceRoom = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    callsRef.current.forEach((call) => call.close());
    callsRef.current.clear();

    dataConnsRef.current.forEach((conn) => conn.close());
    dataConnsRef.current.clear();

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    document.querySelectorAll('audio[id^="audio-peer-"]').forEach((el) => el.remove());

    setInVoiceRoom(false);
    setIsConnected(false);
    setAudioLevel(0);
    setClaimedSlot(null);
    setPeers([]);
  }, []);

  // Automatic Slot Cleanup on Page Refresh / Close Tab / Page Hide
  useEffect(() => {
    const handleUnload = () => {
      leaveVoiceRoom();
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('unload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [leaveVoiceRoom]);

  // Join Voice Room
  const joinVoiceRoom = useCallback(async (customCode?: string) => {
    const targetRoom = (customCode || activeRoomId || '0414').trim();
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: 1,
          sampleRate: 48000,
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
        } as any,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      localStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      tryJoinSlot(1, targetRoom, stream);

    } catch (err) {
      console.error('[Voice] Could not access microphone:', err);
      alert('Microphone access is required for Voice Chat. Please allow mic permissions in your browser.');
    }
  }, [activeRoomId, selectedDeviceId]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle Deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      document.querySelectorAll('audio[id^="audio-peer-"]').forEach((el) => {
        (el as HTMLAudioElement).muted = next;
      });
      return next;
    });
  }, []);

  return {
    activeRoomId,
    isConnected,
    inVoiceRoom,
    isMuted,
    isDeafened,
    audioLevel,
    claimedSlot,
    peers,
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
  };
}
