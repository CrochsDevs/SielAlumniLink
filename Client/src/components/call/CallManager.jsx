import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Maximize, Minimize } from 'lucide-react';
import { getSocket } from '../../realtime/socket';
import { acquireCall, releaseCall } from '../../realtime/callActivity';
import { gooeyToast as toast } from 'goey-toast';
import { createRingingTimeout } from './ringingTimeout';
import { createCallRinger } from './callRinger';
import ChatAvatar from '../chat/ChatAvatar';

// Free public STUN for NAT traversal. Note: strict corporate/school
// NATs may still need a TURN server (follow-up infra) — P2P works
// for most home/mobile networks.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Global call manager: incoming modal + active call overlay.
// Mount once at app root (inside ChatProvider).
const CallManager = ({ getDisplayName, getProfilePicture }) => {
  const [incoming, setIncoming] = useState(null);
  const [active, setActive] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const activeRef = useRef(null);
  const startingRef = useRef(false);
  const callIdRef = useRef(null);
  const ringingTimeoutRef = useRef(null);
  const ringerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const ownsFullscreen = useRef(false);

  useEffect(() => {
    const ringer = createCallRinger();
    ringerRef.current = ringer;
    // Unlock browser audio during normal interactions before a call arrives.
    const unlock = () => ringer.unlock();
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      ringer.destroy();
      ringerRef.current = null;
    };
  }, []);

  const ringMode = incoming ? 'incoming' : active?.outgoing && active.status === 'ringing' ? 'outgoing' : null;
  useEffect(() => {
    ringerRef.current?.start(ringMode);
    return () => ringerRef.current?.stop();
  }, [ringMode]);

  const isVideoCall = active?.kind === 'video';
  useEffect(() => {
    if (!isVideoCall) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [isVideoCall]);

  useEffect(() => {
    const update = () => {
      setFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) ownsFullscreen.current = false;
    };
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const enterFullscreen = useCallback(() => {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    // Request during the call button's click, before awaiting camera access.
    document.documentElement.requestFullscreen().then(() => {
      if (startingRef.current || activeRef.current) {
        ownsFullscreen.current = true;
      } else {
        void document.exitFullscreen().catch(() => {});
      }
    }).catch(() => {
      // The full-window layout remains available if fullscreen is restricted.
    });
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      enterFullscreen();
    }
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const cleanup = useCallback(() => {
    ringerRef.current?.stop();
    ringingTimeoutRef.current?.stop();
    if (ownsFullscreen.current && document.fullscreenElement) {
      ownsFullscreen.current = false;
      void document.exitFullscreen().catch(() => {});
    }
    releaseCall('direct');
    activeRef.current = null;
    callIdRef.current = null;
    pendingIceRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setIncoming(null);
    setActive(null);
    setMuted(false);
    setVideoOff(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  useEffect(() => {
    const timeout = createRingingTimeout({
      onExpire: (callId, peerAuthId) => {
        if (callIdRef.current !== callId || activeRef.current?.status === 'live') return;
        // Close locally first; the server signal must not keep the modal open.
        const outgoing = activeRef.current?.outgoing;
        cleanup();
        getSocket().emit('call:signal', { toAuthId: peerAuthId, kind: 'end', data: { callId } });
        if (outgoing) toast.info('No answer. The call ended after 30 seconds.');
      },
    });
    ringingTimeoutRef.current = timeout;
    return () => {
      timeout.stop();
      ringingTimeoutRef.current = null;
    };
  }, [cleanup]);

  const attachStreams = useCallback((pc, localStream, kind) => {
    localStreamRef.current = localStream;
    if (kind === 'video' && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (kind === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };
  }, []);

  const makePC = useCallback((toAuthId, kind, localStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket().emit('call:signal', { toAuthId, kind: 'signal', data: { candidate: e.candidate, callId: callIdRef.current } });
      }
    };
    attachStreams(pc, localStream, kind);
    pcRef.current = pc;
    return pc;
  }, [attachStreams]);

  // Outgoing call — exposed globally for thread headers.
  const startCall = useCallback(async (toAuthId, displayName, kind) => {
    if (callIdRef.current || activeRef.current || startingRef.current || !toAuthId) return;
    if (!acquireCall('direct')) return;
    startingRef.current = true;
    if (kind === 'video') enterFullscreen();
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
      localStreamRef.current = localStream;
      callIdRef.current = crypto.randomUUID();
      const pc = makePC(toAuthId, kind, localStream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const call = { peerAuthId: toAuthId, peerName: displayName, kind, outgoing: true, status: 'ringing', ringExpiresAt: Date.now() + 30000 };
      activeRef.current = call;
      setActive(call);
      ringingTimeoutRef.current?.start(callIdRef.current, toAuthId);
      getSocket().emit('call:signal', { toAuthId, kind: 'invite', data: { offer, callKind: kind, callId: callIdRef.current } });
    } catch {
      cleanup();
    } finally {
      startingRef.current = false;
    }
  }, [makePC, cleanup, enterFullscreen]);

  useEffect(() => {
    window.__startCall = startCall;
    return () => {
      delete window.__startCall;
    };
  }, [startCall ]);

  const endCall = useCallback((peerAuthId) => {
    if (peerAuthId) {
      getSocket().emit('call:signal', { toAuthId: peerAuthId, kind: 'end', data: { callId: callIdRef.current } });
    }
    cleanup();
  }, [cleanup]);

  // Incoming signaling.
  useEffect(() => {
    const socket = getSocket();

    const onSignal = async ({ fromAuthId, fromEmail, kind, data }) => {
      if (kind === 'invite') {
        if (callIdRef.current || activeRef.current || startingRef.current || !acquireCall('direct')) {
          socket.emit('call:signal', { toAuthId: fromAuthId, kind: 'decline', data: { callId: data?.callId } });
          return;
        }
        callIdRef.current = data?.callId;
        ringingTimeoutRef.current?.start(data?.callId, fromAuthId, data?.ringExpiresAt);
        setIncoming({
          callId: data?.callId,
          fromAuthId,
          fromEmail,
          kind: data?.callKind || 'voice',
          offer: data?.offer,
          ringExpiresAt: data?.ringExpiresAt || Date.now() + 30000,
        });
        return;
      }
      if (!data?.callId || data.callId !== callIdRef.current) return;

      if (kind === 'ringing') {
        setActive(previous => previous?.status === 'ringing'
          ? { ...previous, ringExpiresAt: data.ringExpiresAt }
          : previous);
        return;
      }

      if (kind === 'decline' || kind === 'end') {
        if (data.reason === 'no-answer' && activeRef.current?.outgoing) {
          toast.info('No answer. The call ended after 30 seconds.');
        }
        if (String(activeRef.current?.peerAuthId) === String(fromAuthId)) {
          cleanup();
        }
        setIncoming(null);
        cleanup();
        return;
      }

      if (kind === 'accept' && activeRef.current && String(activeRef.current.peerAuthId) === String(fromAuthId)) {
        ringerRef.current?.stop();
        ringingTimeoutRef.current?.stop();
        try {
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
          for (const candidate of pendingIceRef.current) {
            await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingIceRef.current = [];
          setActive((prev) => (prev ? { ...prev, status: 'live' } : prev));
        } catch {
          // ignore
        }
        return;
      }

      if (kind === 'signal' && data?.candidate) {
        if (pcRef.current?.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch {
            // ignore
          }
        } else {
          pendingIceRef.current.push(data.candidate);
        }
      }
    };

    socket.on('call:signal', onSignal);
    const onDisconnect = () => {
      setIncoming(null);
      cleanup();
    };
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('call:signal', onSignal);
      socket.off('disconnect', onDisconnect);
    };
  }, [cleanup]);

  const acceptIncoming = async () => {
    if (!incoming || startingRef.current || activeRef.current) return;
    ringerRef.current?.stop();
    startingRef.current = true;
    if (incoming.kind === 'video') enterFullscreen();
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incoming.kind === 'video',
      });
      if (callIdRef.current !== incoming.callId) {
        localStream.getTracks().forEach(track => track.stop());
        return;
      }
      localStreamRef.current = localStream;
      const pc = makePC(incoming.fromAuthId, incoming.kind, localStream);
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      for (const candidate of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      // The ringing deadline may expire while media negotiation is awaiting.
      if (callIdRef.current !== incoming.callId) {
        pc.close();
        localStream.getTracks().forEach(track => track.stop());
        return;
      }
      pendingIceRef.current = [];
      const call = {
        peerAuthId: incoming.fromAuthId,
        peerName: getDisplayName ? getDisplayName(incoming.fromAuthId, incoming.fromEmail) : incoming.fromEmail,
        kind: incoming.kind,
        outgoing: false,
        status: 'live',
      };
      activeRef.current = call;
      ringingTimeoutRef.current?.stop();
      setActive(call);
      setIncoming(null);
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'accept', data: { answer, callId: incoming.callId } });
    } catch {
      // mic/camera denied — decline instead
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'decline', data: { callId: incoming.callId } });
      setIncoming(null);
      cleanup();
    } finally {
      startingRef.current = false;
    }
  };

  const declineIncoming = () => {
    if (incoming) {
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'decline', data: { callId: incoming.callId } });
    }
    setIncoming(null);
    cleanup();
  };

  const toggleMute = () => {
    const enabled = !muted;
    setMuted(enabled);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !enabled;
    });
  };

  const toggleVideo = () => {
    const off = !videoOff;
    setVideoOff(off);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
  };

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Incoming call modal */}
      {incoming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-3xl bg-white dark:bg-zinc-900 p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-xl font-extrabold text-brand ring-4 ring-brand/10">
              <ChatAvatar convo={{
                name: getDisplayName?.(incoming.fromAuthId, incoming.fromEmail) || incoming.fromEmail,
                profilePicture: getProfilePicture?.(incoming.fromAuthId, incoming.fromEmail),
              }} />
            </span>
            <p className="mt-3 text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
              {getDisplayName ? getDisplayName(incoming.fromAuthId, incoming.fromEmail) : incoming.fromEmail}
            </p>
            <p className="text-[12px] text-zinc-500">
              Incoming {incoming.kind === 'video' ? 'video' : 'voice'} call...
            </p>
            <div className="mt-5 flex justify-center gap-4">
              <button
                type="button"
                onClick={declineIncoming}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
                aria-label="Decline call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={acceptIncoming}
                className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:bg-brand"
                aria-label="Accept call"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {active && createPortal(
        <div className={`fixed inset-0 z-[100] m-0 flex items-center justify-center overflow-hidden ${active.kind === 'video' ? 'h-dvh w-full bg-black p-0' : 'bg-zinc-950/90 p-4'}`}>
          <div
            className={active.kind === 'video'
              ? 'flex h-full w-full min-h-0 flex-col overflow-hidden bg-black'
              : 'w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl'}
            role="dialog"
            aria-modal="true"
            aria-label={`${active.kind === 'video' ? 'Video' : 'Voice'} call with ${active.peerName || 'participant'}`}
          >
            {active.kind === 'video' ? (
              <div className="relative min-h-0 w-full flex-1 bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
                <video
                  ref={localVideoRef}
                  autoPlay playsInline muted
                  className={`absolute bottom-4 right-4 h-32 max-h-[35%] w-24 rounded-2xl border border-white/20 bg-black object-cover shadow-lg sm:bottom-6 sm:right-6 sm:h-44 sm:w-32 ${videoOff ? 'hidden' : ''}`}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 pb-2 pt-8">
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand/20 text-3xl font-extrabold text-brand ring-4 ring-white/5">
                  <ChatAvatar convo={{
                    name: active.peerName,
                    profilePicture: getProfilePicture?.(active.peerAuthId),
                  }} />
                </span>
                <p className="mt-3 text-[16px] font-extrabold text-white">{active.peerName}</p>
                <p className="text-[12px] text-white/60">
                  {active.status === 'ringing' ? 'Ringing...' : 'Voice call • live'}
                </p>
              </div>
            )}
            {active.kind === 'video' && (
              <p className="shrink-0 px-4 pt-3 text-center text-[13px] font-bold text-white">
                {active.peerName} • {active.status === 'ringing' ? 'Ringing...' : 'Live'}
              </p>
            )}
            <div className="flex shrink-0 items-center justify-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {active.kind === 'video' && document.fullscreenEnabled && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
                >
                  {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={toggleMute}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${muted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {active.kind === 'video' && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  aria-label={videoOff ? 'Camera on' : 'Camera off'}
                >
                  {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
                aria-label="Speaker"
              >
                <Volume2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => endCall(active.peerAuthId)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
                aria-label="End call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default CallManager;
