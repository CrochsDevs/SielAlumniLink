import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff, Phone, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { gooeyToast as toast } from "goey-toast";
import { GroupCallContext } from "../../context/group-call-context";
import { getSocket } from "../../realtime/socket";
import MeetingClient from "../../realtime/MeetingClient";
import { acquireCall, isCallBusy, releaseCall } from "../../realtime/callActivity";
import { FeedDialog } from "../feed/FeedComposer";
import "./GroupCall.css";

function PeerTile({ peer, stream, local = false }) {
  const video = useRef(null);
  useEffect(() => {
    const element = video.current;
    element.srcObject = stream || null;
    if (stream) element.play().catch(() => {});
    return () => { element.srcObject = null; };
  }, [stream]);
  return <div className="group-call-peer" data-group-call-peer={peer.id || "self"}>
    <video ref={video} autoPlay playsInline muted={local} className={peer.camera ? "" : "group-call-camera-off"} />
    {!peer.camera && <span className="group-call-avatar">{(peer.name || "Member").charAt(0).toUpperCase()}</span>}
    <div><span>{peer.name}{local ? " (You)" : ""}</span>{peer.mic ? <Mic size={13} /> : <MicOff size={13} />}</div>
  </div>;
}

function CallRoom({ session, onClose }) {
  const { client, conversation } = session;
  const state = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot);
  return <FeedDialog title={conversation.name || "Group call"} className="group-call-dialog" onClose={onClose} wide>
    <p className="group-call-subtitle"><Users size={14} />{state.joined ? `${state.peers.length + 1} in call · Up to 8 participants` : state.busy ? "Connecting to group call…" : "Group call"}</p>
    {state.error && <p role="alert" className="group-call-error">{state.error}</p>}
    {state.notice && <p role="status" className="group-call-error">{state.notice}</p>}
    <div className="group-call-grid">
      <PeerTile peer={{ ...state.self, name: state.self?.name || "You", mic: state.mic, camera: state.camera }} stream={state.stream} local />
      {state.peers.map(peer => <PeerTile key={peer.id} peer={peer} stream={peer.stream || client.peers.get(peer.id)?.stream} />)}
    </div>
    {state.joined && !state.peers.length && <p className="group-call-waiting">Waiting for other group members to join. They can join from the group chat.</p>}
    <div className="group-call-controls">
      {state.joined ? <>
        <button type="button" onClick={() => client.toggle("audio")} aria-label={state.mic ? "Mute microphone" : "Turn on microphone"} aria-pressed={state.mic}>{state.mic ? <Mic size={19} /> : <MicOff size={19} />}</button>
        <button type="button" onClick={() => client.toggle("video")} aria-label={state.camera ? "Turn off camera" : "Turn on camera"} aria-pressed={state.camera}>{state.camera ? <Video size={19} /> : <VideoOff size={19} />}</button>
      </> : !state.busy && <button type="button" onClick={() => client.join(false)} className="group-call-retry">Rejoin call</button>}
      <button type="button" onClick={onClose} className="group-call-leave" aria-label="Leave group call"><PhoneOff size={19} />Leave call</button>
    </div>
  </FeedDialog>;
}

export default function GroupCallProvider({ user, children }) {
  const [rooms, setRooms] = useState({});
  const [session, setSession] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const current = useRef(null);
  const authenticated = !!user;
  const close = useCallback(() => {
    current.current?.client.destroy();
    current.current = null;
    releaseCall("group");
    setSession(null);
  }, []);
  const start = useCallback(async (conversation, kind = "voice") => {
    if (current.current) return;
    if (!getSocket().connected) { toast.error("Call unavailable", { description: "The chat connection is offline. Please wait for it to reconnect." }); return; }
    if (!acquireCall("group")) { toast.error("Call in progress", { description: "Leave your current call before starting a group call." }); return; }
    const client = new MeetingClient(String(conversation._id), { namespace: "group-call", joinInput: { conversationId: String(conversation._id), kind } });
    const next = { client, conversation };
    current.current = next;
    setIncoming(null);
    setSession(next);
    client.attach();
    await client.join(false);
    if (current.current !== next || !client.state.joined) return;
    await client.toggle("audio");
    if (kind === "video" && current.current === next) await client.toggle("video");
  }, []);
  const inspect = useCallback(id => {
    const socket = getSocket();
    if (!socket.connected) return;
    socket.timeout(8000).emit("group-call:inspect", { conversationId: String(id) }, (error, response) => {
      if (!error && response?.success) setRooms(previous => ({ ...previous, [id]: response.data }));
    });
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    const socket = getSocket();
    const update = room => setRooms(previous => ({ ...previous, [room.conversationId]: room }));
    const invite = call => { if (!current.current && !isCallBusy()) setIncoming(call); };
    const closed = ({ conversationId }) => {
      setRooms(previous => ({ ...previous, [conversationId]: { active: false } }));
      setIncoming(previous => previous?.conversationId === conversationId ? null : previous);
    };
    const removed = ({ conversationId }) => {
      if (String(current.current?.conversation._id) === String(conversationId)) close();
      closed({ conversationId });
    };
    const disconnected = () => setIncoming(null);
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
      current.current?.client.destroy();
      current.current = null;
      releaseCall("group");
    };
  }, [authenticated, close]);
  return <GroupCallContext.Provider value={{ rooms, start, inspect }}>
    {children}
    {session && <CallRoom session={session} onClose={close} />}
    {incoming && !session && <FeedDialog title="Incoming group call" onClose={() => setIncoming(null)}>
      <div className="group-call-incoming"><span><Users size={28} /></span><h3>{incoming.name}</h3><p>{incoming.callerName} started a group {incoming.kind} call.</p><div>
        <button type="button" onClick={() => setIncoming(null)} className="group-call-decline"><PhoneOff size={16} />Dismiss</button>
        <button type="button" onClick={() => start({ _id: incoming.conversationId, name: incoming.name }, incoming.kind)} className="group-call-accept"><Phone size={16} />Join call</button>
      </div></div>
    </FeedDialog>}
  </GroupCallContext.Provider>;
}
