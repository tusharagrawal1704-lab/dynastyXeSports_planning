import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';
import { useStrategyStore } from '@/store/strategyStore';
import { DEFAULT_ICE_SERVERS, getRoomIdFromUrl } from '@/services/realtimeService';
import { supabase } from '@/services/supabaseClient';
import { fetchRoomState, saveRoomState } from '@/services/supabaseService';

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

// Generate a unique random peer ID per browser session
function generateUniquePeerId(roomId: string): string {
  const rand = Math.random().toString(36).substring(2, 8);
  const ts = Date.now().toString(36).substring(-4);
  const clean = roomId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `dx-${clean}-${rand}${ts}`;
}

export function useVoiceChat({ roomCode, userName = 'DXxPlayer' }: { roomCode?: string; userName?: string }) {
  const activeRoomId = (roomCode || getRoomIdFromUrl()).toUpperCase().trim();

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
  const myPeerIdRef = useRef<string>('');
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const isIncomingSyncRef = useRef(false);
  const streamsAttachedRef = useRef<Set<string>>(new Set());

  // Play remote audio via <audio> element — one per peer, strictly deduplicated
  const safeAttachAudio = (peerId: string, stream: MediaStream) => {
    if (!peerId || peerId === myPeerIdRef.current) return;
    if (streamsAttachedRef.current.has(peerId)) {
      console.log(`[Audio] Already attached for ${peerId}, skipping`);
      return;
    }
    streamsAttachedRef.current.add(peerId);

    // Remove any existing element for this peer
    const existing = document.getElementById(`audio-peer-${peerId}`);
    if (existing) existing.remove();

    const audioEl = document.createElement('audio');
    audioEl.id = `audio-peer-${peerId}`;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.style.display = 'none';
    audioEl.srcObject = stream;
    audioEl.volume = 0.7;
    document.body.appendChild(audioEl);
    audioEl.play().catch(() => {
      // Mobile browsers need user gesture — retry on tap
      const unlock = () => {
        audioEl.play().catch(() => {});
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('touchstart', unlock);
    });
    console.log(`[Audio] ✅ Attached for: ${peerId}`);
  };

  const removeRemoteAudio = (peerId: string) => {
    streamsAttachedRef.current.delete(peerId);
    const el = document.getElementById(`audio-peer-${peerId}`);
    if (el) el.remove();
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

  // connectToPeer removed — all connections handled via tryConnect inside Supabase Presence effect

  // Load initial state from Supabase DB on room mount & subscribe to Postgres DB changes
  useEffect(() => {
    if (!activeRoomId) return;

    // 1. Initial DB Fetch
    fetchRoomState(activeRoomId).then((dbState) => {
      if (dbState) {
        console.log('[Supabase DB] ✅ Loaded room state from database');
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(dbState);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    // 2. Realtime Postgres Changes Subscription
    if (supabase) {
      const dbChannel = supabase
        .channel(`db-rooms-${activeRoomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${activeRoomId}`,
          },
          (payload: any) => {
            if (payload?.new?.state) {
              console.log('[Supabase DB] ✅ Received realtime DB update');
              isIncomingSyncRef.current = true;
              useStrategyStore.setState(payload.new.state);
              setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
            }
          }
        )
        .subscribe();

      return () => {
        supabase?.removeChannel(dbChannel);
      };
    }
  }, [activeRoomId]);

  // Supabase Realtime Presence & Broadcast for peer discovery and map sync
  // IMPORTANT: Only depends on activeRoomId to prevent channel teardown/recreate loops
  useEffect(() => {
    if (!supabase || !activeRoomId) return;

    const cleanCode = activeRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `dynastyx-voice:${cleanCode}`;
    const presenceKey = myPeerIdRef.current || `anon-${Math.random().toString(36).substr(2, 6)}`;

    console.log(`[Supabase Presence] Joining channel: ${channelName}`);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKey },
      },
    });

    // Helper: only the peer with the SMALLER ID initiates the call (prevents double connections & echo)
    const shouldInitiateCall = (remotePeerId: string): boolean => {
      const myId = myPeerIdRef.current;
      return myId < remotePeerId;
    };

    const tryConnect = (remotePeerId: string) => {
      if (!remotePeerId || remotePeerId === myPeerIdRef.current) return;
      if (callsRef.current.has(remotePeerId)) return;
      if (!peerRef.current || !localStreamRef.current) return;
      
      if (shouldInitiateCall(remotePeerId)) {
        console.log(`[Presence] I initiate call to: ${remotePeerId}`);
        const peer = peerRef.current;
        const stream = localStreamRef.current;
        
        const call = peer.call(remotePeerId, stream);
        if (call) {
          callsRef.current.set(remotePeerId, call);
          let streamHandled = false;
          call.on('stream', (remoteStream) => {
            if (streamHandled) return; // CRITICAL: only handle first stream event
            streamHandled = true;
            console.log(`[Voice] ✅ Got audio from: ${remotePeerId}`);
            safeAttachAudio(remotePeerId, remoteStream);
            setPeers((prev) => [
              ...prev.filter((p) => p.id !== remotePeerId),
              { id: remotePeerId, slot: prev.length + 2, name: 'Teammate', role: 'Squad' },
            ]);
          });
          call.on('close', () => {
            removeRemoteAudio(remotePeerId);
            callsRef.current.delete(remotePeerId);
            setPeers((prev) => prev.filter((p) => p.id !== remotePeerId));
          });
        }
        
        // Data connection for map sync
        if (!dataConnsRef.current.has(remotePeerId)) {
          const conn = peer.connect(remotePeerId);
          if (conn) {
            dataConnsRef.current.set(conn.peer, conn);
            conn.on('open', () => {
              const s = useStrategyStore.getState();
              conn.send({ type: 'SYNC_STORE', state: { markers: s.markers, players: s.players, drawings: s.drawings, safeZones: s.safeZones, flightPaths: s.flightPaths, vehiclePaths: s.vehiclePaths } });
            });
            conn.on('data', (data: any) => {
              if (data?.type === 'SYNC_STORE' && data?.state) {
                isIncomingSyncRef.current = true;
                useStrategyStore.setState(data.state);
                setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
              }
            });
            conn.on('close', () => dataConnsRef.current.delete(conn.peer));
          }
        }
      } else {
        console.log(`[Presence] Waiting for ${remotePeerId} to call me (they have smaller ID)`);
      }
    };

    // Listen for map state broadcasts
    channel.on('broadcast', { event: 'SYNC_STORE' }, (payload: any) => {
      if (payload?.payload?.state) {
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(payload.payload.state);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    // Discover peers via presence
    channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
      console.log(`[Presence] 🟢 Peer JOINED: ${key}`);
      newPresences.forEach((pres: any) => {
        if (pres?.peerId) {
          setTimeout(() => tryConnect(pres.peerId), 1500);
        }
      });
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      Object.keys(state).forEach((key) => {
        state[key].forEach((pres: any) => {
          if (pres?.peerId) {
            tryConnect(pres.peerId);
          }
        });
      });
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
      console.log(`[Presence] 🔴 Peer LEFT: ${key}`);
      leftPresences.forEach((pres: any) => {
        if (pres?.peerId) {
          document.getElementById(`audio-peer-${pres.peerId}`)?.remove();
          callsRef.current.get(pres.peerId)?.close();
          callsRef.current.delete(pres.peerId);
          dataConnsRef.current.get(pres.peerId)?.close();
          dataConnsRef.current.delete(pres.peerId);
          setPeers((prev) => prev.filter((p) => p.id !== pres.peerId));
        }
      });
    });

    channel.subscribe(async (status) => {
      console.log(`[Supabase Presence] Channel status: ${status}`);
      if (status === 'SUBSCRIBED') {
        await channel.track({
          peerId: myPeerIdRef.current,
          name: userName,
          joinedAt: Date.now(),
        });
      }
    });

    supabaseChannelRef.current = channel;

    return () => {
      supabase?.removeChannel(channel);
      supabaseChannelRef.current = null;
    };
  // ONLY activeRoomId as dependency - everything else via refs to prevent channel recreation
  }, [activeRoomId]);

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

  // Broadcast strategy store changes across all channels
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

    // 1. Save to Supabase DB
    saveRoomState(activeRoomId, stateSnapshot);

    // 2. Broadcast via PeerJS Data Connections
    dataConnsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(payload);
      }
    });

    // 3. Broadcast via Supabase Realtime
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'SYNC_STORE',
        payload: { state: payload.state },
      });
    }

    // 4. Broadcast to local browser tabs
    try {
      broadcastChannelRef.current?.postMessage(payload);
    } catch (e) {}
  }, [activeRoomId]);

  // Subscribe to Zustand store mutations
  useEffect(() => {
    const unsub = useStrategyStore.subscribe((state) => {
      broadcastStoreState(state);
    });
    return () => unsub();
  }, [broadcastStoreState]);

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

    // Clean up ALL remote audio
    streamsAttachedRef.current.clear();
    document.querySelectorAll('audio[id^="audio-peer-"]').forEach((el) => el.remove());

    setInVoiceRoom(false);
    setIsConnected(false);
    setAudioLevel(0);
    setClaimedSlot(null);
    setPeers([]);
  }, []);

  // Automatic cleanup on Page Refresh / Close Tab only (NOT pagehide — that fires when switching apps on mobile)
  useEffect(() => {
    const handleUnload = () => {
      leaveVoiceRoom();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [leaveVoiceRoom]);

  // Join Voice Room with random unique PeerJS ID
  const joinVoiceRoom = useCallback(async (customCode?: string) => {
    const targetRoom = (customCode || activeRoomId || 'DX-0414').trim();
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          // REQUIRED (not ideal) — forces browser to enable hardware echo cancellation
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          // Chrome-specific echo suppression flags
          googEchoCancellation: true,
          googExperimentalEchoCancellation: true,
          googAutoGainControl: true,
          googExperimentalAutoGainControl: true,
          googNoiseSuppression: true,
          googExperimentalNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
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

      // Audio level meter
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

      // Create PeerJS with RANDOM UNIQUE ID (no more slot collisions)
      const uniquePeerId = generateUniquePeerId(targetRoom);
      myPeerIdRef.current = uniquePeerId;

      console.log(`[PeerJS] Creating peer with unique ID: ${uniquePeerId}`);

      const peer = new Peer(uniquePeerId, {
        config: {
          iceServers: DEFAULT_ICE_SERVERS,
        },
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log(`[PeerJS] ✅ Connected to signaling server as: ${id}`);
        setIsConnected(true);
        setInVoiceRoom(true);
        setClaimedSlot(1);

        // Re-track presence now that PeerJS is open
        if (supabaseChannelRef.current) {
          supabaseChannelRef.current.track({
            peerId: id,
            name: userName,
            joinedAt: Date.now(),
          }).then(() => {
            console.log('[Supabase Presence] ✅ Re-tracked with PeerJS ID:', id);
          }).catch((err: any) => {
            console.warn('[Supabase Presence] Track error:', err);
          });
        }
      });

      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err.type, err);
        if (err.type === 'unavailable-id') {
          // Extremely unlikely with random IDs, but handle it
          peer.destroy();
          const newId = generateUniquePeerId(targetRoom);
          myPeerIdRef.current = newId;
          const retryPeer = new Peer(newId, { config: { iceServers: DEFAULT_ICE_SERVERS } });
          peerRef.current = retryPeer;
          retryPeer.on('open', () => {
            setIsConnected(true);
            setInVoiceRoom(true);
            setClaimedSlot(1);
          });
        }
      });

      peer.on('connection', (conn) => {
        console.log(`[PeerJS] Incoming data connection from: ${conn.peer}`);
        setupDataConnection(conn);
      });

      peer.on('call', (call) => {
        if (callsRef.current.has(call.peer)) {
          console.log(`[PeerJS] Ignoring duplicate call from: ${call.peer}`);
          return;
        }
        console.log(`[PeerJS] ✅ Answering incoming call from: ${call.peer}`);
        const activeStream = localStreamRef.current || stream;
        call.answer(activeStream);
        callsRef.current.set(call.peer, call);

        let streamHandled = false;
        call.on('stream', async (remoteStream) => {
          if (streamHandled) return;
          streamHandled = true;
          console.log(`[PeerJS] ✅ Got audio stream from: ${call.peer}`);
          safeAttachAudio(call.peer, remoteStream);
          setPeers((prev) => [
            ...prev.filter((p) => p.id !== call.peer),
            { id: call.peer, slot: prev.length + 2, name: 'Teammate', role: 'Squad' },
          ]);

          // Re-acquire mic stream to force AEC re-calibration now that remote audio is playing
          try {
            const freshStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              } as any,
            });
            const newTrack = freshStream.getAudioTracks()[0];
            // Replace the track in the PeerJS call's underlying RTCPeerConnection
            const pc = (call as any).peerConnection as RTCPeerConnection | undefined;
            if (pc) {
              const sender = pc.getSenders().find((s: RTCRtpSender) => s.track?.kind === 'audio');
              if (sender) {
                await sender.replaceTrack(newTrack);
                // Stop old tracks and update ref
                localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
                localStreamRef.current = freshStream;
                console.log('[AEC] ✅ Mic re-acquired for echo cancellation re-calibration');
              } else {
                freshStream.getTracks().forEach((t) => t.stop());
              }
            } else {
              freshStream.getTracks().forEach((t) => t.stop());
            }
          } catch (e) {
            console.warn('[AEC] Mic re-acquisition failed (non-critical):', e);
          }
        });

        call.on('close', () => {
          removeRemoteAudio(call.peer);
          callsRef.current.delete(call.peer);
          setPeers((prev) => prev.filter((p) => p.id !== call.peer));
        });
      });

    } catch (err) {
      console.error('[Voice] Could not access microphone:', err);
      alert('Microphone access is required for Voice Chat. Please allow mic permissions in your browser.');
    }
  }, [activeRoomId, selectedDeviceId, userName]);

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
