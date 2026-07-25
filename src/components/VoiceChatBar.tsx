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
  Plus,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { getRoomShareUrl, generateRoomId, getRoomIdFromUrl } from '@/services/realtimeService';
import { isSupabaseConfigured } from '@/services/supabaseClient';

export function VoiceChatBar() {
  const [roomCode, setRoomCode] = useState(() => getRoomIdFromUrl());
  const [copied, setCopied] = useState(false);

  const {
    activeRoomId,
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
  } = useVoiceChat({ roomCode, userName: `DXxMember-${Math.floor(Math.random() * 90 + 10)}` });

  const [showPeers, setShowPeers] = useState(false);

  // Auto-set browser URL parameter and auto-join room on page load
  React.useEffect(() => {
    const currentUrl = getRoomShareUrl(roomCode);
    window.history.replaceState({}, '', currentUrl);

    if (!inVoiceRoom) {
      const timer = setTimeout(() => {
        joinVoiceRoom(roomCode);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareLink = () => {
    const shareUrl = getRoomShareUrl(roomCode);
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateNewRoom = () => {
    if (inVoiceRoom) leaveVoiceRoom();
    const newId = generateRoomId();
    setRoomCode(newId);
    const newUrl = getRoomShareUrl(newId);
    window.history.pushState({}, '', newUrl);
    setTimeout(() => {
      joinVoiceRoom(newId);
    }, 300);
  };

  const handleJoinRoom = (codeToJoin: string) => {
    const cleanCode = codeToJoin.trim().toUpperCase();
    setRoomCode(cleanCode);
    const newUrl = getRoomShareUrl(cleanCode);
    window.history.pushState({}, '', newUrl);
    joinVoiceRoom(cleanCode);
  };

  return (
    <div className="relative">
      {/* Debug Status Bar */}
      <div className="mb-1 flex items-center gap-2 text-[9px] font-mono px-1">
        <span className={`flex items-center gap-1 ${isSupabaseConfigured ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-400' : 'bg-red-400'}`} />
          SB:{isSupabaseConfigured ? 'ON' : 'OFF'}
        </span>
        <span className={`flex items-center gap-1 ${inVoiceRoom ? 'text-emerald-400' : 'text-yellow-400'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${inVoiceRoom ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
          Peer:{inVoiceRoom ? `Slot${claimedSlot}` : 'OFF'}
        </span>
        <span className="text-blue-400">Room:{activeRoomId}</span>
        <span className="text-purple-400">Peers:{peers.length}</span>
      </div>
      {/* Voice Chat Floating Bar */}
      <div className="glass flex items-center gap-2 rounded-xl p-1.5 shadow-xl border border-white/10 backdrop-blur-xl">
        {!inVoiceRoom ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setRoomCode(val);
                window.history.pushState({}, '', getRoomShareUrl(val));
              }}
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
              onClick={handleCreateNewRoom}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/15 bg-white/5 text-[10px] font-bold text-white hover:bg-white/10 transition-colors"
              title="Create New Session Room ID"
            >
              <Plus className="h-3 w-3" />
              <span>New Room</span>
            </button>
            <button
              onClick={() => handleJoinRoom(roomCode)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-emerald-500 active:scale-95 glow-neon"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Join Room ({roomCode})</span>
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
              className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white shadow hover:bg-red-500 transition-all active:scale-95"
              title="Disconnect Voice & Free Slot"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>Leave Room</span>
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
              {(() => {
                const localInfo = [
                  { name: 'DXxTushar1704M', role: 'IGL / Leader' },
                  { name: 'DXxMystic', role: 'Assaulter' },
                  { name: 'DXxJester', role: 'Assaulter' },
                  { name: 'DXxVillian', role: 'Assaulter' },
                  { name: 'DXxDeep', role: 'Assaulter' },
                ][(claimedSlot || 1) - 1] || { name: 'DXxPlayer', role: 'Teammate' };

                return (
                  <div className={`flex items-center justify-between rounded-xl p-2 text-xs transition-all ${
                    audioLevel > 15 ? 'bg-emerald-500/20 ring-1 ring-emerald-500/50' : 'bg-white/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${audioLevel > 15 ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{localInfo.name} <span className="text-[10px] text-emerald-400">(You)</span></span>
                        <span className="text-[10px] text-muted-foreground">Slot {claimedSlot || 1} • {localInfo.role}</span>
                      </div>
                    </div>
                    {isMuted ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                );
              })()}

              {/* Remote Peers */}
              {peers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between rounded-xl bg-white/5 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{peer.name}</span>
                      <span className="text-[10px] text-muted-foreground">Slot {peer.slot || '?'} • {peer.role || 'Teammate'}</span>
                    </div>
                  </div>
                  <Mic className="h-3.5 w-3.5 text-blue-400" />
                </div>
              ))}
            </div>

            {/* Big Disconnect / Leave Room Button */}
            <div className="mt-3 pt-2 border-t border-white/10">
              <button
                onClick={leaveVoiceRoom}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600/90 hover:bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-lg transition-all active:scale-95"
              >
                <PhoneOff className="h-4 w-4" />
                <span>Disconnect & Clear Room Slot</span>
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
