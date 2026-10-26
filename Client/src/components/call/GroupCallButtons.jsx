import { useEffect } from "react";
import { Phone, Video } from "lucide-react";
import { useGroupCall } from "../../context/useGroupCall";
import { getSocket } from "../../realtime/socket";

export default function GroupCallButtons({ conversation }) {
  const calls = useGroupCall();
  const inspect = calls?.inspect;
  const id = conversation._id;
  useEffect(() => {
    if (!inspect || !conversation.isGroup) return;
    const refresh = () => inspect(id);
    const socket = getSocket();
    refresh();
    socket.on("connect", refresh);
    return () => socket.off("connect", refresh);
  }, [id, inspect, conversation.isGroup]);
  if (!conversation.isGroup || !calls) return null;
  const room = calls.rooms[id];
  return <span className="group-call-header-actions">
    {room?.active ? <button type="button" className="group-call-join" aria-label="Join group call" title={`${room.count} in call`} onClick={() => calls.start(conversation, room.kind)}><Phone size={16} /><span>Join</span></button> : <>
      <button type="button" aria-label="Start group voice call" title="Start group voice call" onClick={() => calls.start(conversation, "voice")}><Phone size={16} /></button>
      <button type="button" aria-label="Start group video call" title="Start group video call" onClick={() => calls.start(conversation, "video")}><Video size={16} /></button>
    </>}
  </span>;
}
