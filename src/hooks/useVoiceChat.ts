import { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack, IRemoteVideoTrack, UID, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { useStrategyStore } from '@/store/strategyStore';
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

// Provided by user
const AGORA_APP_ID = 'e3c44f662b8943b7bf5a3052b3810b61';

export function useVoiceChat({ roomCode, userName = 'DXxPlayer' }: { roomCode?: string; userName?: string }) {
  // Hardcoded to force the entire site to use a single fixed room as requested
  const activeRoomId = 'DX-0414';

  const [isConnected, setIsConnected] = useState(false);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [claimedSlot, setClaimedSlot] = useState<number | null>(null);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const myUidRef = useRef<UID>('');
  
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const isIncomingSyncRef = useRef(false);
  
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

  const leaveVoiceRoom = useCallback(async () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    if (clientRef.current) {
      await clientRef.current.leave();
      clientRef.current = null;
    }

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
    if (AGORA_APP_ID === 'YOUR_AGORA_APP_ID_HERE') {
      alert('Please add your Agora App ID to the code before joining!');
      return;
    }
    
    // Ignore any custom code passed in; lock strictly to activeRoomId
    const targetRoom = activeRoomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    try {
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          console.log('[Agora] ✅ Subscribed to remote audio from:', user.uid);
          user.audioTrack?.play();
          
          setPeers((prev) => {
            if (prev.find((p) => p.id === String(user.uid))) return prev;
            return [...prev, { id: String(user.uid), slot: prev.length + 2, name: 'Teammate', role: 'Squad' }];
          });
        }
      });

      client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
        if (mediaType === 'audio') {
          user.audioTrack?.stop();
        }
      });

      client.on('user-left', (user: IAgoraRTCRemoteUser) => {
        setPeers((prev) => prev.filter((p) => p.id !== String(user.uid)));
      });

      // Join the channel (App ID, Channel Name, Token (null for testing mode), UID)
      const uid = await client.join(AGORA_APP_ID, targetRoom, null, null);
      myUidRef.current = uid;

      // Create and publish local audio track
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: selectedDeviceId ? selectedDeviceId : undefined
      });
      localAudioTrackRef.current = localAudioTrack;
      await client.publish([localAudioTrack]);

      console.log('[Agora] ✅ Successfully joined voice channel!');
      setInVoiceRoom(true);
      setClaimedSlot(1);

    } catch (err) {
      console.error('[Voice] Agora connection failed:', err);
      alert('Voice Chat failed to connect. Ensure your App ID is correct and mic is allowed.');
    }
  }, [activeRoomId, selectedDeviceId]);

  const toggleMute = useCallback(() => {
    if (localAudioTrackRef.current) {
      const currentState = !isMuted;
      localAudioTrackRef.current.setMuted(currentState);
      setIsMuted(currentState);
    }
  }, [isMuted]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev;
      if (clientRef.current) {
        clientRef.current.remoteUsers.forEach(user => {
          if (user.audioTrack) {
            if (next) {
              user.audioTrack.setVolume(0);
            } else {
              user.audioTrack.setVolume(100);
            }
          }
        });
      }
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
