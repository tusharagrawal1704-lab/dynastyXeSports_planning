import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Users,
  Radio,
  Sparkles,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useVoiceChat } from '@/hooks/useVoiceChat';

export function VoiceChatBar() {
  const [roomCode, setRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '0414';
  });
  const [copied, setCopied] = useState(false);

  const {
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
  } = useVoiceChat({ roomCode, userName: `DXxMember-${Math.floor(Math.random() * 90 + 10)}` });

  const [showPeers, setShowPeers] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Voice Chat Floating Bar */}
      <div className="glass flex items-center gap-2 rounded-xl p-1.5 shadow-xl border border-white/10 backdrop-blur-xl">
        {!inVoiceRoom ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              className="w-24 bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-xs font-bold text-neon text-center focus:outline-none uppercase"
            />
            <button
              onClick={copyShareLink}
              className="px-2 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
              title="Copy Teammate Share Link"
            >
              {copied ? 'Link Copied!' : 'Share Link'}
            </button>
            <button
              onClick={() => joinVoiceRoom(roomCode)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95 glow-neon"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Join DynastyX ({roomCode})</span>
            </button>
          </div>
        ) : (
          <>
            {/* Live Audio Level Meter Waveform */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Radio className={`h-4 w-4 ${audioLevel > 10 ? 'text-emerald-400 animate-pulse' : 'text-muted-foreground'}`} />
              <div className="flex items-end gap-0.5 h-4 w-12">
                {[0.4, 0.8, 1, 0.6, 0.9].map((multiplier, idx) => (
                  <span
                    key={idx}
                    className="w-1 rounded-full bg-emerald-400 transition-all duration-75"
                    style={{
                      height: `${Math.max(15, Math.min(100, (audioLevel * multiplier)))}%`,
                      opacity: isMuted ? 0.3 : 1,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Mute Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                isMuted
                  ? 'border-red-500/50 bg-red-500/20 text-red-400'
                  : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 glow-neon'
              }`}
              title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Deafen Toggle */}
            <button
              onClick={toggleDeafen}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95 ${
                isDeafened
                  ? 'border-red-500/50 bg-red-500/20 text-red-400'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {/* Squad Members Button */}
            <button
              onClick={() => setShowPeers(!showPeers)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold text-white hover:bg-white/10"
            >
              <Users className="h-4 w-4 text-primary" />
              <span>{peers.length + 1}</span>
              {showPeers ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>

            {/* Leave Room Button */}
            <button
              onClick={leaveVoiceRoom}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/80 text-white hover:bg-red-600 transition-colors active:scale-95"
              title="Disconnect Voice"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Squad Voice Members Popover Drawer */}
      <AnimatePresence>
        {inVoiceRoom && showPeers && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-14 right-0 z-40 w-72 glass rounded-2xl p-3 shadow-2xl border border-white/15 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span className="font-display text-xs font-bold text-white flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                Active Squad Room: <span className="text-neon">{roomCode}</span>
              </span>
              <button
                onClick={copyRoomCode}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                {copied ? 'Copied' : 'Share Code'}
              </button>
            </div>

            {audioDevices.length > 1 && (
              <div className="mb-2 space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Microphone Input:</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                >
                  {audioDevices.map((dev) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Microphone (${dev.deviceId.slice(0, 5)}...)`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              {/* Local User */}
              <div className={`flex items-center justify-between rounded-xl p-2 text-xs transition-all ${
                audioLevel > 15 ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'bg-white/5'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${audioLevel > 15 ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="font-semibold text-white">You (Squad Leader)</span>
                </div>
                {isMuted ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
              </div>

              {/* Remote Peers */}
              {peers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between rounded-xl bg-white/5 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="font-semibold text-white">{peer.name}</span>
                  </div>
                  <Mic className="h-3.5 w-3.5 text-blue-400" />
                </div>
              ))}
            </div>

            {/* Voice Command Assistant Banner */}
            {lastCommand && (
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1.5 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5 text-neon" />
                <span>Voice Command: {lastCommand}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
