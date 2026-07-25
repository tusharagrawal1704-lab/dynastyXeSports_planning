import { useEffect, useRef, useState, useCallback } from 'react';
import Peer, { MediaConnection } from 'peerjs';

export interface PeerUser {
  id: string;
  name: string;
  isMuted?: boolean;
  isSpeaking?: boolean;
}

interface UseVoiceChatProps {
  roomCode?: string;
  userName?: string;
}

export function useVoiceChat({ roomCode = '0414', userName = 'DXxPlayer' }: UseVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Map<string, MediaConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

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

  // Attach remote audio stream
  const attachRemoteAudio = (peerId: string, stream: MediaStream) => {
    let audioEl = document.getElementById(`audio-peer-${peerId}`) as HTMLAudioElement;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `audio-peer-${peerId}`;
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      document.body.appendChild(audioEl);
    }
    audioEl.srcObject = stream;
    audioEl.play().catch(() => {});
  };

  const removeRemoteAudio = (peerId: string) => {
    const audioEl = document.getElementById(`audio-peer-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  // Connect to remote peer
  const connectToPeer = (remotePeerId: string, peer: Peer, stream: MediaStream) => {
    try {
      const call = peer.call(remotePeerId, stream);
      if (!call) return;
      callsRef.current.set(remotePeerId, call);

      call.on('stream', (remoteStream) => {
        attachRemoteAudio(remotePeerId, remoteStream);
        const slotNum = remotePeerId.split('-slot-')[1] || '?';
        setPeers((prev) => [
          ...prev.filter((p) => p.id !== remotePeerId),
          { id: remotePeerId, name: `Player ${slotNum} (Teammate)` },
        ]);
      });

      call.on('close', () => {
        removeRemoteAudio(remotePeerId);
        setPeers((prev) => prev.filter((p) => p.id !== remotePeerId));
      });
    } catch (e) {}
  };

  // Attempt to claim deterministic slot in Room (slot-1, slot-2, slot-3, slot-4, slot-5)
  const tryJoinSlot = (slotIndex: number, roomCodeStr: string, stream: MediaStream) => {
    if (slotIndex > 5) {
      console.warn('[PeerJS] Room is full (max 5 players)');
      alert(`DynastyX Room ${roomCodeStr} is currently full (5/5 teammates connected).`);
      return;
    }

    // Clean room code format
    const cleanCode = roomCodeStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const peerId = `dynastyx-${cleanCode}-slot-${slotIndex}`;
    console.log(`[PeerJS] Attempting to claim Slot ${slotIndex} with Peer ID: ${peerId}`);

    const peer = new Peer(peerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      setIsConnected(true);
      setInVoiceRoom(true);
      console.log(`[PeerJS Voice] Connected to DynastyX Room ${roomCodeStr} as Slot ${slotIndex} (${id})`);

      // Connect to all other 4 slots in the same room
      [1, 2, 3, 4, 5].forEach((s) => {
        if (s !== slotIndex) {
          const targetPeerId = `dynastyx-${cleanCode}-slot-${s}`;
          connectToPeer(targetPeerId, peer, stream);
        }
      });
    });

    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // Slot is already claimed by host/teammate, try next slot
        console.log(`[PeerJS] Slot ${slotIndex} occupied. Trying Slot ${slotIndex + 1}...`);
        peer.destroy();
        tryJoinSlot(slotIndex + 1, roomCodeStr, stream);
      } else {
        console.warn('[PeerJS Notice]', err.type || err);
      }
    });

    peer.on('call', (call) => {
      call.answer(stream);
      callsRef.current.set(call.peer, call);

      call.on('stream', (remoteStream) => {
        attachRemoteAudio(call.peer, remoteStream);
        const slotNum = call.peer.split('-slot-')[1] || '?';
        setPeers((prev) => [
          ...prev.filter((p) => p.id !== call.peer),
          { id: call.peer, name: `Player ${slotNum} (Teammate)` },
        ]);
      });

      call.on('close', () => {
        removeRemoteAudio(call.peer);
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
        },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      localStreamRef.current = stream;

      // Audio Level Analyzer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

      // Start attempting from Slot 1
      tryJoinSlot(1, targetRoom, stream);

    } catch (err) {
      console.error('[Voice] Could not access microphone:', err);
      alert('Microphone access is required for Voice Chat. Please allow mic permissions in your browser.');
    }
  }, [roomCode, selectedDeviceId]);

  // Leave Voice Room
  const leaveVoiceRoom = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();

    callsRef.current.forEach((call) => call.close());
    callsRef.current.clear();

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setInVoiceRoom(false);
    setIsConnected(false);
    setAudioLevel(0);
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
    peers,
    transcript,
    lastCommand,
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
  };
}
