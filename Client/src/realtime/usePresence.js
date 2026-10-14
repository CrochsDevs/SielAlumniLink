import { useEffect, useState } from "react";
import { getSocket } from "./socket";

// Subscribes to live presence snapshots from the server.
// Returns { onlineIds: Set<string>, lastSeen: Record<authId, ISOString> }.
export const usePresence = () => {
  const [presence, setPresence] = useState({
    onlineIds: new Set(),
    lastSeen: {},
  });

  useEffect(() => {
    const socket = getSocket();

    const onUpdate = (snapshot) => {
      setPresence({
        onlineIds: new Set(
          (snapshot.online || []).map((u) => String(u.authId)),
        ),
        lastSeen: snapshot.lastSeen || {},
      });
    };

    socket.on("presence:update", onUpdate);
    return () => {
      socket.off("presence:update", onUpdate);
    };
  }, []);

  return presence;
};
