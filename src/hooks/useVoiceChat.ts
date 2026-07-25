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

  // Attach & play remote WebRTC audio stream (NEVER play self stream)
  const attachRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    if (!peerId || peerId === peerRef.current?.id || peerId === myPeerIdRef.current) return;

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
  }, [isDeafened]);

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

  // Connect to a discovered remote peer
  const connectToPeer = useCallback((remotePeerId: string, peer: Peer, stream: MediaStream) => {
    if (!remotePeerId || remotePeerId === peer.id || callsRef.current.has(remotePeerId)) return;
    try {
      const activeStream = localStreamRef.current || stream;
      console.log(`[Voice WebRTC] Calling discovered peer: ${remotePeerId}`);
      const call = peer.call(remotePeerId, activeStream);
      if (call) {
        callsRef.current.set(remotePeerId, call);

        call.on('stream', (remoteStream) => {
          console.log(`[Voice WebRTC] ✅ Audio stream connected with ${remotePeerId}`);
          attachRemoteAudio(remotePeerId, remoteStream);
          setPeers((prev) => [
            ...prev.filter((p) => p.id !== remotePeerId),
            { id: remotePeerId, slot: prev.length + 2, name: `Teammate`, role: 'Squad' },
          ]);
        });

        call.on('close', () => {
          removeRemoteAudio(remotePeerId);
          callsRef.current.delete(remotePeerId);
          setPeers((prev) => prev.filter((p) => p.id !== remotePeerId));
        });

        call.on('error', (err) => {
          console.warn(`[Voice WebRTC] Call error with ${remotePeerId}:`, err);
          callsRef.current.delete(remotePeerId);
        });
      }

      // Also open data connection for map sync
      if (!dataConnsRef.current.has(remotePeerId)) {
        const conn = peer.connect(remotePeerId);
        if (conn) {
          setupDataConnection(conn);
        }
      }
    } catch (e) {
      console.warn('[connectToPeer error]', e);
    }
  }, [attachRemoteAudio]);

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
  useEffect(() => {
    if (!supabase || !activeRoomId) return;

    const cleanCode = activeRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `dynastyx-voice:${cleanCode}`;
    const presenceKey = myPeerIdRef.current || `anon-${Math.random().toString(36).substr(2, 6)}`;

    console.log(`[Supabase Presence] Joining channel: ${channelName}, presenceKey: ${presenceKey}`);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKey },
      },
    });

    // Listen for map state broadcasts
    channel.on('broadcast', { event: 'SYNC_STORE' }, (payload: any) => {
      if (payload?.payload?.state) {
        console.log('[Supabase Broadcast] ✅ Received map state sync');
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(payload.payload.state);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    // Listen for presence changes - discover other peers
    channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
      console.log(`[Supabase Presence] 🟢 Peer JOINED: ${key}`, newPresences);
      newPresences.forEach((pres: any) => {
        if (pres?.peerId && pres.peerId !== myPeerIdRef.current && peerRef.current && localStreamRef.current) {
          console.log(`[Supabase Presence] Connecting to discovered peer: ${pres.peerId}`);
          // Small delay to let the other peer's PeerJS fully register
          setTimeout(() => {
            if (peerRef.current && localStreamRef.current) {
              connectToPeer(pres.peerId, peerRef.current, localStreamRef.current);
            }
          }, 1000);
        }
      });
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log('[Supabase Presence] Sync - all online peers:', Object.keys(state));
      Object.keys(state).forEach((key) => {
        state[key].forEach((pres: any) => {
          if (pres?.peerId && pres.peerId !== myPeerIdRef.current && peerRef.current && localStreamRef.current) {
            if (!callsRef.current.has(pres.peerId)) {
              connectToPeer(pres.peerId, peerRef.current, localStreamRef.current);
            }
          }
        });
      });
    });

    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
      console.log(`[Supabase Presence] 🔴 Peer LEFT: ${key}`);
      leftPresences.forEach((pres: any) => {
        if (pres?.peerId) {
          removeRemoteAudio(pres.peerId);
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
        // Track our presence with our unique PeerJS ID
        const trackData = {
          peerId: myPeerIdRef.current,
          name: userName,
          joinedAt: Date.now(),
        };
        console.log('[Supabase Presence] ✅ Tracking presence:', trackData);
        await channel.track(trackData);
      }
    });

    supabaseChannelRef.current = channel;

    return () => {
      supabase?.removeChannel(channel);
      supabaseChannelRef.current = null;
    };
  }, [activeRoomId, inVoiceRoom, userName, connectToPeer]);

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

  // Join Voice Room with random unique PeerJS ID
  const joinVoiceRoom = useCallback(async (customCode?: string) => {
    const targetRoom = (customCode || activeRoomId || 'DX-0414').trim();
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
        if (callsRef.current.has(call.peer)) return;
        console.log(`[PeerJS] ✅ Answering incoming call from: ${call.peer}`);
        const activeStream = localStreamRef.current || stream;
        call.answer(activeStream);
        callsRef.current.set(call.peer, call);

        call.on('stream', (remoteStream) => {
          console.log(`[PeerJS] ✅ Got audio stream from: ${call.peer}`);
          attachRemoteAudio(call.peer, remoteStream);
          setPeers((prev) => [
            ...prev.filter((p) => p.id !== call.peer),
            { id: call.peer, slot: prev.length + 2, name: 'Teammate', role: 'Squad' },
          ]);
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
  }, [activeRoomId, selectedDeviceId, userName, attachRemoteAudio, connectToPeer]);

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
