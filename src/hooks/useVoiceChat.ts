import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
import { useStrategyStore } from '@/store/strategyStore';

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

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useVoiceChat({ roomCode = '0414', userName = 'DXxPlayer' }: { roomCode?: string; userName?: string }) {
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
  const isIncomingSyncRef = useRef(false);

  // Initialize BroadcastChannel for same-device cross-tab syncing
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

  // Broadcast strategy store changes to all connected teammates in real time
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

    // Broadcast across PeerJS Data Connections to remote devices
    dataConnsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
      }
    });

    // Broadcast across local browser tabs
    try {
      broadcastChannelRef.current?.postMessage(payload);
    } catch (e) {}
  }, []);

  // Subscribe to local Zustand store changes to trigger real-time peer sync
  useEffect(() => {
    const unsub = useStrategyStore.subscribe((state) => {
      if (inVoiceRoom) {
        broadcastStoreState(state);
      }
    });
    return () => unsub();
  }, [inVoiceRoom, broadcastStoreState]);

  // Check available mic input devices
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

  // Attach and play remote audio stream (Single HTML5 Audio tag per remote peer ID)
  const attachRemoteAudio = (peerId: string, stream: MediaStream) => {
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
      audioEl.srcObject = stream;
      audioEl.volume = 1.0;
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
  };

  const removeRemoteAudio = (peerId: string) => {
    const audioEl = document.getElementById(`audio-peer-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  // Setup PeerJS Data Connection for real-time tactical tool syncing
  const setupDataConnection = (conn: DataConnection) => {
    dataConnsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
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

  // Connect to remote peer slot (Lower slot calls higher slot only)
  const connectToPeer = (remotePeerId: string, peer: Peer, stream: MediaStream) => {
    if (callsRef.current.has(remotePeerId)) return;
    try {
      console.log(`[Voice WebRTC] Calling remote teammate slot: ${remotePeerId}`);
      const call = peer.call(remotePeerId, stream);
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
  };

  // Attempt to claim deterministic slot in Room (slot-1 to slot-5)
  const tryJoinSlot = (slotIndex: number, roomCodeStr: string, stream: MediaStream) => {
    if (slotIndex > 5) {
      alert(`DynastyX Room ${roomCodeStr} is full (5/5 teammates currently connected).`);
      return;
    }

    const cleanCode = roomCodeStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const peerId = `dynastyx-${cleanCode}-slot-${slotIndex}`;

    const peer = new Peer(peerId, {
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setIsConnected(true);
      setInVoiceRoom(true);
      setClaimedSlot(slotIndex);
      console.log(`[PeerJS Voice] Connected to DynastyX Room ${roomCodeStr} as Slot ${slotIndex} (${id})`);

      // Lower slot calls higher slots ONLY (avoids duplicate cross-calling & double echo)
      [1, 2, 3, 4, 5].forEach((s) => {
        if (s > slotIndex) {
          const targetPeerId = `dynastyx-${cleanCode}-slot-${s}`;
          connectToPeer(targetPeerId, peer, stream);
        }
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        tryJoinSlot(slotIndex + 1, roomCodeStr, stream);
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
      call.answer(stream);
      callsRef.current.set(call.peer, call);

      call.on('stream', (remoteStream) => {
        console.log(`[PeerJS Voice] Connected audio stream from ${call.peer}`);
        attachRemoteAudio(call.peer, remoteStream);
        const slotNum = parseInt(call.peer.split('-slot-')[1] || '1', 10);
        const rosterItem = DYNASTY_ROSTER.find((r) => r.slot === slotNum) || { name: `Player ${slotNum}`, role: 'Teammate' };
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

  // Join Voice Room
  const joinVoiceRoom = useCallback(async (customCode?: string) => {
    const targetRoom = (customCode || roomCode || '0414').trim();
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
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

      // Local Audio Level Analyzer ONLY (DO NOT connect to audioCtx.destination to prevent local echo)
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
  }, [roomCode, selectedDeviceId]);

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
