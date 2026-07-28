import { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { useStrategyStore } from '@/store/strategyStore';
import { getRoomIdFromUrl } from '@/services/realtimeService';
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

const DAILY_DOMAIN = 'https://dynastyxesports.daily.co'; // Temporary/placeholder domain

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

  const callObjectRef = useRef<DailyCall | null>(null);
  const myPeerIdRef = useRef<string>('');

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const isIncomingSyncRef = useRef(false);

  // Create audio element wrapper
  const safeAttachAudio = (session_id: string, track: MediaStreamTrack) => {
    if (!session_id || session_id === 'local') return;
    const existing = document.getElementById(`audio-peer-${session_id}`);
    if (existing) existing.remove();

    const audioEl = document.createElement('audio');
    audioEl.id = `audio-peer-${session_id}`;
    audioEl.setAttribute('playsinline', 'true');
    audioEl.setAttribute('autoplay', 'true');
    audioEl.style.display = 'none';
    const stream = new MediaStream([track]);
    audioEl.srcObject = stream;
    audioEl.volume = 0.8;
    document.body.appendChild(audioEl);

    audioEl.play().catch(() => {
      const unlock = () => {
        audioEl.play().catch(() => { });
        document.removeEventListener('click', unlock);
        document.removeEventListener('touchstart', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('touchstart', unlock);
    });
    console.log(`[Audio] ✅ Attached for: ${session_id}`);
  };

  const removeRemoteAudio = (session_id: string) => {
    const el = document.getElementById(`audio-peer-${session_id}`);
    if (el) el.remove();
  };

  // Load initial state from Supabase DB on room mount & subscribe to Postgres DB changes
  useEffect(() => {
    if (!activeRoomId) return;

    fetchRoomState(activeRoomId).then((dbState) => {
      if (dbState) {
        console.log('[Supabase DB] ✅ Loaded room state from database');
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(dbState);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    if (supabase) {
      const dbChannel = supabase
        .channel(`db-rooms-${activeRoomId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${activeRoomId}` },
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

  // Supabase Realtime Broadcast for Map Sync
  useEffect(() => {
    if (!supabase || !activeRoomId) return;
    const cleanCode = activeRoomId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `dynastyx-sync:${cleanCode}`;

    console.log(`[Supabase Broadcast] Joining channel: ${channelName}`);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'SYNC_STORE' }, (payload: any) => {
      if (payload?.payload?.state) {
        isIncomingSyncRef.current = true;
        useStrategyStore.setState(payload.payload.state);
        setTimeout(() => { isIncomingSyncRef.current = false; }, 50);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      }
    });

    supabaseChannelRef.current = channel;

    return () => {
      supabase?.removeChannel(channel);
      supabaseChannelRef.current = null;
    };
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

    saveRoomState(activeRoomId, stateSnapshot);

    // Broadcast via Supabase Realtime
    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: 'broadcast',
        event: 'SYNC_STORE',
        payload: { state: payload.state },
      });
    }

    try {
      broadcastChannelRef.current?.postMessage(payload);
    } catch (e) { }
  }, [activeRoomId]);

  useEffect(() => {
    const unsub = useStrategyStore.subscribe((state) => {
      broadcastStoreState(state);
    });
    return () => unsub();
  }, [broadcastStoreState]);

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
  }, [selectedDeviceId]);

  const leaveVoiceRoom = useCallback(() => {
    if (callObjectRef.current) {
      callObjectRef.current.leave();
      callObjectRef.current.destroy();
      callObjectRef.current = null;
    }

    document.querySelectorAll('audio[id^="audio-peer-"]').forEach((el) => el.remove());

    setInVoiceRoom(false);
    setAudioLevel(0);
    setClaimedSlot(null);
    setPeers([]);
  }, []);

  useEffect(() => {
    const handleUnload = () => { leaveVoiceRoom(); };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [leaveVoiceRoom]);

  const joinVoiceRoom = useCallback(async (customCode?: string) => {
    const targetRoom = (customCode || activeRoomId || 'DX-0414').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const roomUrl = `${DAILY_DOMAIN}/${targetRoom}`;

    try {
      const callFrame = DailyIframe.createCallObject({
        audioSource: selectedDeviceId || true,
        videoSource: false,
      });
      callObjectRef.current = callFrame;

      callFrame.on('joined-meeting', (e: any) => {
        console.log('[Daily.co] ✅ Joined meeting', e);
        setInVoiceRoom(true);
        setClaimedSlot(1);
        myPeerIdRef.current = e.participants.local.session_id;
      });

      callFrame.on('participant-joined', (e: any) => {
        console.log('[Daily.co] Participant joined', e.participant.session_id);
        setPeers((prev) => {
          if (prev.find((p) => p.id === e.participant.session_id)) return prev;
          return [...prev, { id: e.participant.session_id, slot: prev.length + 2, name: 'Teammate', role: 'Squad' }];
        });
      });

      callFrame.on('participant-left', (e: any) => {
        console.log('[Daily.co] Participant left', e.participant.session_id);
        removeRemoteAudio(e.participant.session_id);
        setPeers((prev) => prev.filter((p) => p.id !== e.participant.session_id));
      });

      callFrame.on('track-started', (e: any) => {
        if (e.track.kind === 'audio' && e.participant && e.participant.session_id !== 'local') {
          safeAttachAudio(e.participant.session_id, e.track);
        }
      });

      callFrame.on('track-stopped', (e: any) => {
        if (e.track.kind === 'audio' && e.participant && e.participant.session_id !== 'local') {
          removeRemoteAudio(e.participant.session_id);
        }
      });

      callFrame.on('error', (e: any) => {
        console.error('[Daily.co] Error:', e);
        alert('Daily.co Voice Chat failed to connect. Ensure room exists.');
      });

      await callFrame.join({ url: roomUrl, userName });

    } catch (err) {
      console.error('[Voice] Could not access microphone or connect Daily:', err);
      alert('Microphone access is required for Voice Chat. Please allow mic permissions.');
    }
  }, [activeRoomId, selectedDeviceId, userName]);

  const toggleMute = useCallback(() => {
    if (callObjectRef.current) {
      const localAudio = callObjectRef.current.localAudio();
      callObjectRef.current.setLocalAudio(!localAudio);
      setIsMuted(localAudio); // If it was on, we are turning it off (muted=true)
    }
  }, []);

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
