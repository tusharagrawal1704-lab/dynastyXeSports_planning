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

  const myPeerIdRef = useRef<string>('');
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
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
    audioEl.volume = 0.5;
    document.body.appendChild(audioEl);
    audioEl.play().catch(() => {
      // Mobile browsers need user gesture — retry on tap
      const unlock = () => {
        audioEl.play().catch(() => { });
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

  // Setup raw RTCDataChannel for real-time tactical tool syncing
  const setupDataChannel = useCallback((dc: RTCDataChannel, targetUserId: string) => {
    dataChannelsRef.current.set(targetUserId, dc);

    dc.onopen = () => {
      console.log(`[Raw DataChannel] Opened with ${targetUserId}`);
      const currentState = useStrategyStore.getState();
      dc.send(JSON.stringify({
        type: 'SYNC_STORE',
        state: {
          markers: currentState.markers,
          players: currentState.players,
          drawings: currentState.drawings,
          safeZones: currentState.safeZones,
          flightPaths: currentState.flightPaths,
          vehiclePaths: currentState.vehiclePaths,
        },
      }));
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'SYNC_STORE' && data?.state) {
          isIncomingSyncRef.current = true;
          useStrategyStore.setState(data.state);
          setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
        }
      } catch (e) {}
    };

    dc.onclose = () => {
      dataChannelsRef.current.delete(targetUserId);
    };
  }, []);

  // WebRTC Peer Connection Factory
  const createPeerConnection = useCallback((targetUserId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId)!;
    }

    console.log(`[WebRTC] Creating PeerConnection for ${targetUserId} (Initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    peerConnectionsRef.current.set(targetUserId, pc);

    // 1. Add Local Audio Track
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // 2. Handle Remote Audio Track
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        console.log(`[WebRTC] ✅ Received remote audio stream from ${targetUserId}`);
        safeAttachAudio(targetUserId, event.streams[0]);
        setPeers((prev) => {
          if (prev.find((p) => p.id === targetUserId)) return prev;
          return [...prev, { id: targetUserId, slot: prev.length + 2, name: 'Teammate', role: 'Squad' }];
        });
      }
    };

    // 3. Route ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { targetUserId, candidate: event.candidate, from: myPeerIdRef.current },
        });
      }
    };

    // 4. Handle Disconnects
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        removeRemoteAudio(targetUserId);
        pc.close();
        peerConnectionsRef.current.delete(targetUserId);
        setPeers((prev) => prev.filter((p) => p.id !== targetUserId));
      }
    };

    // 5. Setup Data Channels for Map Sync
    if (isInitiator) {
      const dc = pc.createDataChannel('tactical-sync');
      setupDataChannel(dc, targetUserId);
    } else {
      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, targetUserId);
      };
    }

    return pc;
  }, [setupDataChannel]);

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

  // Supabase Realtime Signaling for WebRTC Mesh & Map Sync
  useEffect(() => {
    if (!supabase || !activeRoomId) return;

    const cleanCode = activeRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `dynastyx-voice:${cleanCode}`;
    
    // Ensure we only generate an ID once per session to prevent split rooms
    if (!myPeerIdRef.current) {
      myPeerIdRef.current = `dx-${cleanCode}-${Math.random().toString(36).substring(2, 8)}`;
    }

    console.log(`[Signaling] Joining room: ${channelName} as ${myPeerIdRef.current}`);

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    // 1. New User Joined -> Existing users create SDP Offer
    channel.on('broadcast', { event: 'user-joined' }, async (payload: any) => {
      const newPeerId = payload.payload.peerId;
      if (newPeerId === myPeerIdRef.current) return;
      
      console.log(`[Signaling] New user joined: ${newPeerId}. Initiating call...`);
      const pc = createPeerConnection(newPeerId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      channel.send({
        type: 'broadcast',
        event: 'sdp-offer',
        payload: { targetUserId: newPeerId, sdp: offer, from: myPeerIdRef.current },
      });
    });

    // 2. Receive SDP Offer -> Create Answer
    channel.on('broadcast', { event: 'sdp-offer' }, async (payload: any) => {
      const { targetUserId, sdp, from } = payload.payload;
      if (targetUserId !== myPeerIdRef.current) return; // Ignore if not for me

      console.log(`[Signaling] Received Offer from ${from}`);
      const pc = createPeerConnection(from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      channel.send({
        type: 'broadcast',
        event: 'sdp-answer',
        payload: { targetUserId: from, sdp: answer, from: myPeerIdRef.current },
      });
    });

    // 3. Receive SDP Answer
    channel.on('broadcast', { event: 'sdp-answer' }, async (payload: any) => {
      const { targetUserId, sdp, from } = payload.payload;
      if (targetUserId !== myPeerIdRef.current) return;

      console.log(`[Signaling] Received Answer from ${from}`);
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    });

    // 4. Receive ICE Candidate
    channel.on('broadcast', { event: 'ice-candidate' }, async (payload: any) => {
      const { targetUserId, candidate, from } = payload.payload;
      if (targetUserId !== myPeerIdRef.current) return;

      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Also listen for raw broadcast sync store events as fallback
    channel.on('broadcast', { event: 'SYNC_STORE' }, (payload: any) => {
      if (payload?.payload?.state) {
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(payload.payload.state);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        // Alert existing peers in the room that we have joined
        channel.send({
          type: 'broadcast',
          event: 'user-joined',
          payload: { peerId: myPeerIdRef.current },
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
    } catch (e) { }
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

    // 2. Broadcast via Raw Data Channels
    dataChannelsRef.current.forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(JSON.stringify(payload));
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
    } catch (e) { }
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
      }).catch(() => { });
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
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }

    // Close all raw RTCPeerConnections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Close all raw DataChannels
    dataChannelsRef.current.forEach((dc) => dc.close());
    dataChannelsRef.current.clear();

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
      // We no longer initialize PeerJS. Signaling is handled automatically
      // by the Supabase channel `useEffect` once `inVoiceRoom` state triggers.
      setInVoiceRoom(true);
      setClaimedSlot(1);

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
