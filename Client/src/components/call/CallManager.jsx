import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { getSocket } from '../../realtime/socket';

// Free public STUN for NAT traversal. Note: strict corporate/school
// NATs may still need a TURN server (follow-up infra) — P2P works
// for most home/mobile networks.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Global call manager: incoming modal + active call overlay.
// Mount once at app root (inside ChatProvider).
const CallManager = ({ getDisplayName }) => {
  const [incoming, setIncoming] = useState(null);
  const [active, setActive] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingIceRef = useRef([]);
  const activeRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  activeRef.current = active;

  const cleanup = useCallback(() => {
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
    setActive(null);
    setMuted(false);
    setVideoOff(false);
  }, []);

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
        getSocket().emit('call:signal', { toAuthId, kind: 'signal', data: { candidate: e.candidate } });
      }
    };
    attachStreams(pc, localStream, kind);
    pcRef.current = pc;
    return pc;
  }, [attachStreams]);

  // Outgoing call — exposed globally for thread headers.
  const startCall = useCallback(async (toAuthId, displayName, kind) => {
    if (activeRef.current || !toAuthId) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      });
      const pc = makePC(toAuthId, kind, localStream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setActive({ peerAuthId: toAuthId, peerName: displayName, kind, outgoing: true, status: 'ringing' });
      getSocket().emit('call:signal', { toAuthId, kind: 'invite', data: { offer, callKind: kind } });
    } catch {
      // mic/camera denied
    }
  }, [makePC]);

  useEffect(() => {
    window.__startCall = startCall;
    return () => {
      delete window.__startCall;
    };
  }, [startCall ]);

  const endCall = useCallback((peerAuthId) => {
    if (peerAuthId) {
      getSocket().emit('call:signal', { toAuthId: peerAuthId, kind: 'end' });
    }
    cleanup();
  }, [cleanup]);

  // Incoming signaling.
  useEffect(() => {
    const socket = getSocket();

    const onSignal = async ({ fromAuthId, fromEmail, kind, data }) => {
      if (kind === 'invite') {
        if (activeRef.current) {
          socket.emit('call:signal', { toAuthId: fromAuthId, kind: 'decline' });
          return;
        }
        setIncoming({
          fromAuthId,
          fromEmail,
          kind: data?.callKind || 'voice',
          offer: data?.offer,
        });
        return;
      }

      if (kind === 'decline' || kind === 'end') {
        if (String(activeRef.current?.peerAuthId) === String(fromAuthId)) {
          cleanup();
        }
        setIncoming(null);
        return;
      }

      if (kind === 'accept' && activeRef.current && String(activeRef.current.peerAuthId) === String(fromAuthId)) {
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
    return () => {
      socket.off('call:signal', onSignal);
    };
  }, [cleanup]);

  const acceptIncoming = async () => {
    if (!incoming) return;
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incoming.kind === 'video',
      });
      const pc = makePC(incoming.fromAuthId, incoming.kind, localStream);
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      for (const candidate of pendingIceRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingIceRef.current = [];
      setActive({
        peerAuthId: incoming.fromAuthId,
        peerName: getDisplayName ? getDisplayName(incoming.fromAuthId, incoming.fromEmail) : incoming.fromEmail,
        kind: incoming.kind,
        outgoing: false,
        status: 'live',
      });
      setIncoming(null);
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'accept', data: { answer } });
    } catch {
      // mic/camera denied — decline instead
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'decline' });
      setIncoming(null);
    }
  };

  const declineIncoming = () => {
    if (incoming) {
      getSocket().emit('call:signal', { toAuthId: incoming.fromAuthId, kind: 'decline' });
    }
    setIncoming(null);
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
            <span className="mx-auto flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[#009639]/10 text-xl font-extrabold text-[#009639]">
              {(incoming.fromEmail || 'U').charAt(0).toUpperCase()}
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
                className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-[#009639] text-white shadow-lg transition hover:bg-[#007a2e]"
                aria-label="Accept call"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/90 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl">
            {active.kind === 'video' ? (
              <div className="relative aspect-[3/4] max-h-[60vh] w-full bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                <video
                  ref={localVideoRef}
                  autoPlay playsInline muted
                  className={`absolute bottom-3 right-3 h-28 w-20 rounded-2xl border border-white/20 bg-zinc-800 object-cover ${videoOff ? 'hidden' : ''}`}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 pb-2 pt-8">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#009639]/20 text-3xl font-extrabold text-emerald-300">
                  {(active.peerName || 'U').charAt(0).toUpperCase()}
                </span>
                <p className="mt-3 text-[16px] font-extrabold text-white">{active.peerName}</p>
                <p className="text-[12px] text-white/60">
                  {active.status === 'ringing' ? 'Ringing...' : 'Voice call • live'}
                </p>
              </div>
            )}
            {active.kind === 'video' && (
              <p className="px-4 pt-2 text-center text-[13px] font-bold text-white">
                {active.peerName} • {active.status === 'ringing' ? 'Ringing...' : 'Live'}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 p-5">
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
        </div>
      )}
    </>
  );
};

export default CallManager;
