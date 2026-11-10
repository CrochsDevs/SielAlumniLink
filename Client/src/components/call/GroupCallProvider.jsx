import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Users, Video } from "lucide-react";
import { gooeyToast as toast } from "goey-toast";
import { GroupCallContext } from "../../context/group-call-context";
import { getSocket } from "../../realtime/socket";
import MeetingClient from "../../realtime/MeetingClient";
import { acquireCall, isCallBusy, releaseCall } from "../../realtime/callActivity";
import GroupCallDialog from "./GroupCallDialog";
import ChatAvatar from "../chat/ChatAvatar";
import { createCallRinger } from "./callRinger";
import { createRingingTimeout } from "./ringingTimeout";
import "./GroupCall.css";

const GroupCallRoom = lazy(() => import("./GroupCallRoom"));

export default function GroupCallProvider({ user, children }) {
  const [rooms, setRooms] = useState({});
  const [session, setSession] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [ringing, setRinging] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const current = useRef(null);
  const ringer = useRef(null);
  const outgoingTimeout = useRef(null);
  const ownedFullscreen = useRef(false);
  const authenticated = !!user;
  const authId = String(user?.authId || user?._id || '');

  const close = useCallback(() => {
    outgoingTimeout.current?.stop();
    ringer.current?.stop();
    const previous = current.current;
    current.current = null;
    previous?.unsubscribe?.();
    previous?.client.destroy();
    if (ownedFullscreen.current && document.fullscreenElement === document.documentElement) {
      void document.exitFullscreen().catch(() => {});
    }
    ownedFullscreen.current = false;
    releaseCall("group");
    setSession(null);
    setRinging(false);
    setSpeakerMuted(false);
  }, []);

  useEffect(() => {
    const sound = createCallRinger();
    ringer.current = sound;
    const timeout = createRingingTimeout({ onExpire: callId => {
      if (!current.current || current.current.callId !== callId || current.current.answered) return;
      close();
      toast.info('No answer. The group call ended after 30 seconds.');
    } });
    outgoingTimeout.current = timeout;
    const unlock = () => sound.unlock();
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      timeout.stop();
      sound.destroy();
      outgoingTimeout.current = null;
      ringer.current = null;
    };
  }, [close]);

  useEffect(() => {
    ringer.current?.start(speakerMuted ? null : incoming ? 'incoming' : ringing ? 'outgoing' : null);
    return () => ringer.current?.stop();
  }, [incoming, ringing, speakerMuted]);

  useEffect(() => {
    if (!incoming) return;
    const timeout = createRingingTimeout({ onExpire: () => setIncoming(previous => previous?.callId === incoming.callId ? null : previous) });
    timeout.start(incoming.callId, incoming.conversationId, incoming.ringExpiresAt);
    return () => timeout.stop();
  }, [incoming]);

  const start = useCallback(async (conversation, kind = "voice") => {
    if (current.current) return;
    if (!getSocket().connected) { toast.error('The chat connection is offline. Please wait for it to reconnect.'); return; }
    if (!acquireCall("group")) { toast.error('Leave your current call before starting a group call.'); return; }
    const client = new MeetingClient(String(conversation._id), { namespace: "group-call", joinInput: { conversationId: String(conversation._id), kind } });
    const next = { client, conversation, kind, isCaller: !rooms[conversation._id]?.active, answered: false, joinedOnce: false };
    current.current = next;
    setIncoming(null);
    setSpeakerMuted(false);
    setSession(next);
    if (kind === 'video' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().then(() => {
        if (current.current === next) ownedFullscreen.current = true;
        else if (document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
      }).catch(() => {});
    }
    next.unsubscribe = client.subscribe(() => {
      if (current.current !== next) return;
      if (client.state.joined) next.joinedOnce = true;
      if (client.state.peers.length > 0) {
        next.answered = true;
        outgoingTimeout.current?.stop();
        ringer.current?.stop();
        setRinging(false);
      }
      if (next.joinedOnce && !client.state.joined && !client.state.busy) {
        const message = client.state.notice || client.state.error;
        close();
        if (message) toast.info(message);
      }
    });
    client.attach();
    await client.join(false);
    if (current.current !== next || !client.state.joined) return;
    if (next.isCaller && !next.answered) {
      next.callId ||= `local:${conversation._id}`;
      outgoingTimeout.current?.start(next.callId, String(conversation._id), next.ringExpiresAt);
      setRinging(true);
    }
    await client.toggle("audio");
    if (kind === "video" && current.current === next) await client.toggle("video");
  }, [close, rooms]);

  const inspect = useCallback(id => {
    const socket = getSocket();
    if (!socket.connected) return;
    socket.timeout(8000).emit("group-call:inspect", { conversationId: String(id) }, (error, response) => {
      if (!error && response?.success) setRooms(previous => ({ ...previous, [id]: response.data }));
    });
  }, []);
  const dismiss = () => {
    if (incoming) getSocket().emit('group-call:decline', { conversationId: incoming.conversationId, callId: incoming.callId });
    ringer.current?.stop();
    setIncoming(null);
  };

  useEffect(() => {
    if (!authenticated) return;
    const socket = getSocket();
    const update = room => {
      setRooms(previous => ({ ...previous, [room.conversationId]: room }));
      const next = current.current;
      if (!next || String(next.conversation._id) !== String(room.conversationId)) return;
      if (room.callId) next.callId = room.callId;
      next.ringExpiresAt = room.ringExpiresAt;
      if (room.callerAuthId) next.isCaller = room.callerAuthId === authId;
      if (room.answered) {
        next.answered = true;
        outgoingTimeout.current?.stop();
        setRinging(false);
      }
    };
    const invite = call => { if (!current.current && !isCallBusy()) setIncoming(call); };
    const closed = ({ conversationId, callId, reason }) => {
      setRooms(previous => previous[conversationId]?.callId && callId && previous[conversationId].callId !== callId ? previous : ({ ...previous, [conversationId]: { active: false } }));
      setIncoming(previous => previous?.conversationId === conversationId && (!callId || previous.callId === callId) ? null : previous);
      const next = current.current;
      if (String(next?.conversation._id) === String(conversationId) && (!callId || !next.callId || next.callId === callId)) {
        close();
        if (reason === 'no-answer') toast.info('No answer. The group call ended after 30 seconds.');
        if (reason === 'declined') toast.info('The group call was declined.');
      }
    };
    const removed = ({ conversationId }) => {
      if (String(current.current?.conversation._id) === String(conversationId)) close();
      closed({ conversationId });
    };
    const disconnected = () => { setIncoming(null); close(); };
    socket.on("group-call:availability", update);
    socket.on("group-call:invite", invite);
    socket.on("group-call:closed", closed);
    socket.on("conversation:removed", removed);
    socket.on("disconnect", disconnected);
    return () => {
      socket.off("group-call:availability", update);
      socket.off("group-call:invite", invite);
      socket.off("group-call:closed", closed);
      socket.off("conversation:removed", removed);
      socket.off("disconnect", disconnected);
      close();
    };
  }, [authenticated, authId, close]);
  return <GroupCallContext.Provider value={{ rooms, start, inspect }}>
    {children}
    {session && <Suspense fallback={<div role="status" className="fixed bottom-4 right-4 z-50 rounded-lg bg-zinc-900 p-4 text-sm text-white">Opening call…</div>}><GroupCallRoom session={session} onClose={close} user={user} ringing={ringing} speakerMuted={speakerMuted} onSpeakerChange={() => setSpeakerMuted(previous => !previous)} /></Suspense>}
    {incoming && !session && <GroupCallDialog title="Incoming group call" onClose={dismiss}>
      <div className="group-call-incoming"><span className="group-call-incoming-icon">{incoming.callerProfilePicture ? <ChatAvatar convo={{ name: incoming.callerName, profilePicture: incoming.callerProfilePicture }} /> : <Users size={30} />}</span><h3>{incoming.name}</h3><p>{incoming.callerName} is calling</p><span className="group-call-kind">{incoming.kind === "video" ? <Video size={14} /> : <Phone size={14} />} Group {incoming.kind} call</span><div className="group-call-incoming-actions">
        <button type="button" onClick={dismiss} className="group-call-decline"><PhoneOff size={16} />Decline</button>
        <button type="button" onClick={() => start({ _id: incoming.conversationId, name: incoming.name }, incoming.kind)} className="group-call-accept"><Phone size={16} />Join call</button>
      </div></div>
    </GroupCallDialog>}
  </GroupCallContext.Provider>;
}
