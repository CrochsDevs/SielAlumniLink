import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { getSocket } from '../../realtime/socket';
import { acquireCall, releaseCall } from '../../realtime/callActivity';
import { gooeyToast as toast } from 'goey-toast';
import { createRingingTimeout } from './ringingTimeout';
import { createCallRinger } from './callRinger';
import ChatAvatar from '../chat/ChatAvatar';
import { attachCallMedia, setCallTrackEnabled, stopCallStream, callMediaError } from './callMedia';

// Free public STUN for NAT traversal. Note: strict corporate/school
// NATs may still need a TURN server (follow-up infra) — P2P works
// for most home/mobile networks.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Global call manager: incoming modal + active call overlay.
// Mount once at app root (inside ChatProvider).
const CallManager = ({ getDisplayName, getProfilePicture }) => {
  const [incoming, setIncoming] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [active, setActive] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingLocalIceRef = useRef([]);
  const inviteReadyRef = useRef(false);
  const pendingIceRef = useRef([]);
  const activeRef = useRef(null);
  const startingRef = useRef(false);
  const callIdRef = useRef(null);
  const ringingTimeoutRef = useRef(null);
  const connectionTimerRef = useRef(null);
  const ringerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const ownsFullscreen = useRef(false);

  useEffect(() => {
    const ringer = createCallRinger();
    ringerRef.current = ringer;
    // Unlock browser audio during normal interactions before a call arrives.
    const unlock = () => {
      ringer.unlock();
      if (remoteAudioRef.current?.srcObject) void remoteAudioRef.current.play().catch(() => {});
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      ringer.destroy();
      ringerRef.current = null;
    };
  }, []);

  const ringMode = incoming && !accepting ? 'incoming' : active?.outgoing && active.status === 'ringing' ? 'outgoing' : null;
  useEffect(() => {
    ringerRef.current?.start(speakerMuted ? null : ringMode);
    return () => ringerRef.current?.stop();
  }, [ringMode, speakerMuted]);

  const callStatusLabel = {
    preparing: active?.kind === 'video' ? 'Preparing camera...' : 'Preparing microphone...',
    ringing: 'Ringing...',
    connecting: 'Connecting...',
    live: 'Live',
  }[active?.status] || 'Connecting...';

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

  const bindLocalVideo = useCallback(element => {
    localVideoRef.current = element;
    attachCallMedia(element, localStreamRef.current);
  }, []);
  const bindRemoteVideo = useCallback(element => {
    remoteVideoRef.current = element;
    attachCallMedia(element, remoteStreamRef.current);
  }, []);
  const bindRemoteAudio = useCallback(element => {
    remoteAudioRef.current = element;
    attachCallMedia(element, remoteStreamRef.current);
  }, []);

  const cleanup = useCallback(() => {
    clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = null;
    ringerRef.current?.stop();
    ringingTimeoutRef.current?.stop();
    if (ownsFullscreen.current && document.fullscreenElement) {
      ownsFullscreen.current = false;
      void document.exitFullscreen().catch(() => {});
    }
    releaseCall('direct');
    activeRef.current = null;
    callIdRef.current = null;
    startingRef.current = false;
    inviteReadyRef.current = false;
    pendingLocalIceRef.current = [];
    pendingIceRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }
    stopCallStream(localStreamRef.current);
    stopCallStream(remoteStreamRef.current);
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    for (const element of [localVideoRef.current, remoteVideoRef.current, remoteAudioRef.current]) {
      if (element) { element.pause(); element.srcObject = null; }
    }
    setIncoming(null);
    setAccepting(false);
    setActive(null);
    setMuted(false);
    setSpeakerMuted(false);
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

  const attachStreams = useCallback((pc, localStream) => {
    localStreamRef.current = localStream;
    attachCallMedia(localVideoRef.current, localStream);
    pc.ontrack = (e) => {
      if (pcRef.current !== pc) return;
      const stream = remoteStreamRef.current || new MediaStream();
      if (!stream.getTracks().some(track => track.id === e.track.id)) stream.addTrack(e.track);
      remoteStreamRef.current = stream;
      attachCallMedia(remoteVideoRef.current, stream);
      attachCallMedia(remoteAudioRef.current, stream);
    };
  }, []);

  const watchConnection = useCallback((callId, peerAuthId) => {
    clearTimeout(connectionTimerRef.current);
    connectionTimerRef.current = setTimeout(() => {
      if (callIdRef.current !== callId) return;
      cleanup();
      getSocket().emit('call:signal', { toAuthId: peerAuthId, kind: 'end', data: { callId } });
      toast.error('The call could not connect. Check your connection and try again.');
    }, 20000);
  }, [cleanup]);

  const makePC = useCallback((toAuthId, localStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const callId = callIdRef.current;
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (callIdRef.current !== callId) return;
        if (!inviteReadyRef.current) pendingLocalIceRef.current.push(e.candidate);
        else getSocket().emit('call:signal', { toAuthId, kind: 'signal', data: { candidate: e.candidate, callId } });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc || callIdRef.current !== callId) return;
      if (pc.connectionState === 'connected' && activeRef.current) {
        clearTimeout(connectionTimerRef.current);
        connectionTimerRef.current = null;
        const connected = { ...activeRef.current, status: 'live' };
        activeRef.current = connected;
        setActive(connected);
      } else if (pc.connectionState === 'disconnected') {
        watchConnection(callId, toAuthId);
      } else if (pc.connectionState === 'failed') {
        cleanup();
        getSocket().emit('call:signal', { toAuthId, kind: 'end', data: { callId } });
        toast.error('The call connection failed. Please try again.');
      }
    };
    attachStreams(pc, localStream);
    pcRef.current = pc;
    return pc;
  }, [attachStreams, cleanup, watchConnection]);

  // Outgoing call — exposed globally for thread headers.
  const startCall = useCallback(async (toAuthId, displayName, kind) => {
    if (callIdRef.current || activeRef.current || startingRef.current || !toAuthId) return;
    if (!getSocket().connected) {
      toast.error('Messaging is reconnecting. Please try calling again shortly.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Calling requires microphone access on HTTPS or localhost.');
      return;
    }
    if (!acquireCall('direct')) {
      toast.info('End your current call before starting another.');
      return;
    }
    const callId = crypto.randomUUID();
    callIdRef.current = callId;
    startingRef.current = true;
    const preparing = { peerAuthId: toAuthId, peerName: displayName, kind, outgoing: true, status: 'preparing' };
    activeRef.current = preparing;
    setActive(preparing);
    if (kind === 'video') enterFullscreen();
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      if (callIdRef.current !== callId) { stopCallStream(localStream); return; }
      localStreamRef.current = localStream;
      const pc = makePC(toAuthId, localStream);
      const offer = await pc.createOffer();
      if (callIdRef.current !== callId) return;
      await pc.setLocalDescription(offer);
      if (callIdRef.current !== callId) return;
      const call = { ...preparing, status: 'ringing', ringExpiresAt: Date.now() + 30000 };
      activeRef.current = call;
      setActive(call);
      ringingTimeoutRef.current?.start(callId, toAuthId);
      getSocket().emit('call:signal', { toAuthId, kind: 'invite', data: { offer, callKind: kind, callId } });
    } catch (error) {
      if (callIdRef.current === callId) {
        cleanup();
        toast.error(callMediaError(error));
      }
    } finally {
      if (callIdRef.current === callId) startingRef.current = false;
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
        inviteReadyRef.current = true;
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
        inviteReadyRef.current = true;
        for (const candidate of pendingLocalIceRef.current) {
          socket.emit('call:signal', { toAuthId: fromAuthId, kind: 'signal', data: { candidate, callId: data.callId } });
        }
        pendingLocalIceRef.current = [];
        setActive(previous => previous?.status === 'ringing'
          ? { ...previous, ringExpiresAt: data.ringExpiresAt }
          : previous);
        return;
      }

      if (kind === 'decline' || kind === 'end') {
        if (data.reason === 'no-answer' && activeRef.current?.outgoing) {
          toast.info('No answer. The call ended after 30 seconds.');
        }
        cleanup();
        return;
      }

      if (kind === 'accept' && activeRef.current && String(activeRef.current.peerAuthId) === String(fromAuthId)) {
        ringerRef.current?.stop();
        ringingTimeoutRef.current?.stop();
        const pc = pcRef.current;
        if (!pc) return;
        const connecting = { ...activeRef.current, status: 'connecting' };
        activeRef.current = connecting;
        setActive(connecting);
        watchConnection(data.callId, fromAuthId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          if (pcRef.current !== pc || callIdRef.current !== data.callId) return;
          for (const candidate of pendingIceRef.current.splice(0)) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (error) {
          if (callIdRef.current !== data.callId) return;
          cleanup();
          socket.emit('call:signal', { toAuthId: fromAuthId, kind: 'end', data: { callId: data.callId } });
          toast.error(callMediaError(error));
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
  }, [cleanup, watchConnection]);

  const acceptIncoming = async () => {
    if (!incoming || startingRef.current || activeRef.current) return;
    setAccepting(true);
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
      const pc = makePC(incoming.fromAuthId, localStream);
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
        status: pc.connectionState === 'connected' ? 'live' : 'connecting',
      };
      activeRef.current = call;
      ringingTimeoutRef.current?.stop();
      if (call.status !== 'live') watchConnection(incoming.callId, incoming.fromAuthId);
      setActive(call);
      setIncoming(null);
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'accept', data: { answer, callId: incoming.callId } });
    } catch (error) {
      if (callIdRef.current !== incoming.callId) return;
      toast.error(callMediaError(error));
      // mic/camera denied — decline instead
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'decline', data: { callId: incoming.callId } });
      setIncoming(null);
      cleanup();
    } finally {
      if (callIdRef.current === incoming.callId) {
        startingRef.current = false;
        setAccepting(false);
      }
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
    setCallTrackEnabled(localStreamRef.current, 'audio', !enabled);
  };

  const toggleVideo = () => {
    const off = !videoOff;
    setVideoOff(off);
    setCallTrackEnabled(localStreamRef.current, 'video', !off);
  };

  return (
    <>
      <audio ref={bindRemoteAudio} autoPlay playsInline muted={speakerMuted} className="hidden" />

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
              {accepting ? 'Connecting...' : `Incoming ${incoming.kind === 'video' ? 'video' : 'voice'} call...`}
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
                disabled={accepting}
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
                <video ref={bindRemoteVideo} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
                <video
                  ref={bindLocalVideo}
                  autoPlay playsInline muted
                  style={{ transform: 'scaleX(-1)' }}
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
                  {callStatusLabel}
                </p>
              </div>
            )}
            {active.kind === 'video' && (
              <p className="shrink-0 px-4 pt-3 text-center text-[13px] font-bold text-white">
                {active.peerName} &middot; {callStatusLabel}
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
                aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                aria-pressed={muted}
                title={muted ? 'Unmute microphone' : 'Mute microphone'}
                disabled={active.status === 'preparing'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              {active.kind === 'video' && (
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition ${videoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  aria-label={videoOff ? 'Camera on' : 'Camera off'}
                  aria-pressed={videoOff}
                  title={videoOff ? 'Turn camera on' : 'Turn camera off'}
                  disabled={active.status === 'preparing'}
                >
                  {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSpeakerMuted(previous => !previous)}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition ${speakerMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
                aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
                aria-pressed={speakerMuted}
                title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
              >
                {speakerMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
