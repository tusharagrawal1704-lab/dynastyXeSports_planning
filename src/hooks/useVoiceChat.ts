import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

export function useVoiceChat({ roomCode = 'squad-room-1', userName = 'TacticalPlayer' }: UseVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [inVoiceRoom, setInVoiceRoom] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Socket connection (with Vercel static fallback)
  useEffect(() => {
    const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
    const socket = io(serverUrl, { autoConnect: false, reconnectionAttempts: 3, timeout: 2000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Voice] Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setInVoiceRoom(false);
    });

    socket.on('voice-all-users', (existingPeers: PeerUser[]) => {
      setPeers(existingPeers);
      existingPeers.forEach((peer) => initiatePeerConnection(peer.id, socket, true));
    });

    socket.on('voice-user-joined', ({ id, name }: { id: string; name: string }) => {
      setPeers((prev) => [...prev.filter((p) => p.id !== id), { id, name }]);
    });

    socket.on('voice-user-left', ({ id }: { id: string }) => {
      setPeers((prev) => prev.filter((p) => p.id !== id));
      if (peerConnectionsRef.current.has(id)) {
        peerConnectionsRef.current.get(id)?.close();
        peerConnectionsRef.current.delete(id);
      }
    });

    socket.on('voice-signal', async ({ from, signal }: { from: string; signal: any }) => {
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from, socket);
        peerConnectionsRef.current.set(from, pc);
      }
      try {
        if (signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice-signal', { to: from, signal: { sdp: pc.localDescription } });
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('[Voice] Error handling signal:', err);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = (peerId: string, socket: Socket): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('voice-signal', { to: peerId, signal: { candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      let audioEl = document.getElementById(`audio-peer-${peerId}`) as HTMLAudioElement;
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `audio-peer-${peerId}`;
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => {});
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    }

    return pc;
  };

  const initiatePeerConnection = async (peerId: string, socket: Socket, isOffer: boolean) => {
    const pc = createPeerConnection(peerId, socket);
    peerConnectionsRef.current.set(peerId, pc);

    if (isOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice-signal', { to: peerId, signal: { sdp: pc.localDescription } });
      } catch (err) {
        console.error('[Voice] Error creating offer:', err);
      }
    }
  };

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Fetch available audio input devices
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

  // Join Voice Room
  const joinVoiceRoom = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Web Audio API volume meter
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

      if (socketRef.current) {
        socketRef.current.emit('voice-join', { roomCode, userName });
      }

      setInVoiceRoom(true);
      startSpeechRecognition();
    } catch (err) {
      console.error('[Voice] Could not access microphone:', err);
      // Fallback try without specific deviceId constraint
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setInVoiceRoom(true);
      } catch (e) {
        alert('Microphone access is required for Voice Chat. Please allow mic permissions in your browser.');
      }
    }
  }, [roomCode, userName, selectedDeviceId]);

  // Leave Voice Room
  const leaveVoiceRoom = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    setInVoiceRoom(false);
    setAudioLevel(0);
    setPeers([]);

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        if (socketRef.current) {
          socketRef.current.emit('voice-mute-toggle', { roomCode, isMuted: !audioTrack.enabled });
        }
      }
    }
  }, [roomCode]);

  // Toggle Deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => !prev);
  }, []);

  // Speech Recognition Assistant
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        const text = lastResult[0].transcript.toLowerCase().trim();
        setTranscript(text);

        if (text.includes('enemy')) {
          setLastCommand('Marked Enemy Spot');
        } else if (text.includes('zoom in')) {
          setLastCommand('Zooming In');
        } else if (text.includes('clear')) {
          setLastCommand('Cleared Map Annotations');
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('[Voice Assistant] Web Speech not supported or disabled.');
    }
  };

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
