/**
 * DynastyX Esports Tactical Hub - Real-time Signaling & WebRTC Architecture
 * Serverless-compatible for Vercel Deployments
 */

export interface ICEConfig {
  iceServers: RTCIceServer[];
}

// Production-grade STUN / TURN Server Configuration
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
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

/**
 * Generate a unique Room ID for tactical sessions
 */
export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'DX-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extract Room ID from URL or fallback to default room
 */
export function getRoomIdFromUrl(): string {
  if (typeof window === 'undefined') return '0414';
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('roomId') || params.get('room') || '0414';
  return roomId.trim().toUpperCase();
}

/**
 * Create shareable room link
 */
export function getRoomShareUrl(roomId: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('roomId', roomId.toUpperCase());
  return url.toString();
}
