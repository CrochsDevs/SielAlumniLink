import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { gooeyToast as toast } from "goey-toast";
import { useChat } from "../../context/useChat.js";
import { useAuth } from "../../context/useAuth";
import { useMessageComposer } from "./useMessageComposer";

export function useInbox() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedId = searchParams.get("conversation");
  const {
    convos,
    threads,
    loadThread,
    sendChat,
    editChatMessage,
    unsendChatMessage,
    createGroupChat,
    openChat,
  } = useChat();
  const accountId = user?.authId || user?._id;
  const storageKey = accountId
    ? `messages:last-conversation:${accountId}`
    : null;
  const savedId = useMemo(() => {
    try {
      return storageKey ? localStorage.getItem(storageKey) : null;
    } catch {
      return null;
    }
  }, [storageKey]);
  const [selection, setSelection] = useState({ storageKey: null, id: null, requestedId: null });
  const activeId = selection.storageKey === storageKey ? selection.id : null;
  const setActiveId = useCallback(
    (id) => {
      const conversationId = id == null ? null : String(id);
      setSelection({ storageKey, id: conversationId, requestedId });
      // A selection made inside Messages replaces the header's explicit deep link.
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete("conversation");
        return next;
      }, { replace: true });
      // Going back to the mobile list keeps the last conversation for the next visit.
      if (storageKey && conversationId) {
        try {
          localStorage.setItem(storageKey, conversationId);
        } catch {
          // Conversation selection still works when browser storage is unavailable.
        }
      }
    },
    [storageKey, setSearchParams, requestedId],
  );
  const composer = useMessageComposer(activeId, sendChat, editChatMessage);
  const { draft, setDraft } = composer;
  const [query, setQuery] = useState("");
  const [chatFilter, setChatFilter] = useState("all");
  const [showEmoji, setShowEmoji] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupEmails, setGroupEmails] = useState([]); // now an array
  const [groupSaving, setGroupSaving] = useState(false);

  // Initialize when the asynchronous list arrives. A deliberate null selection
  // keeps the mobile list open; later messages must not change the selected chat.
  if (
    storageKey &&
    convos.length &&
    (selection.storageKey !== storageKey ||
      selection.requestedId !== requestedId ||
      (selection.id && !convos.some((c) => String(c._id) === selection.id)))
  ) {
    const requested = convos.find((c) => String(c._id) === requestedId);
    const remembered = convos.find((c) => String(c._id) === savedId);
    const latest = convos.reduce((recent, conversation) =>
      (Date.parse(conversation.time) || 0) > (Date.parse(recent.time) || 0)
        ? conversation
        : recent,
    );
    // Clearing a deep link must preserve an explicit selection or mobile Back.
    // Router URL updates can commit after the local selection state changes.
    const clearedRequest = selection.storageKey === storageKey && selection.requestedId && !requestedId &&
      (!selection.id || convos.some(c => String(c._id) === selection.id));
    setSelection({ storageKey, id: clearedRequest ? selection.id : String((requested || remembered || latest)._id), requestedId });
  }

  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    try {
      if (storageKey) localStorage.setItem(storageKey, activeId);
    } catch {
      // Explicit conversation links also work when browser storage is unavailable.
    }
  }, [activeId, loadThread, storageKey]);

  const active = convos.find((c) => String(c._id) === String(activeId));
  const filtered = convos.filter(
    (c) =>
      (chatFilter !== "groups" || c.isGroup) &&
      `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()),
  );

  const send = composer.submit;

  const sendFile = composer.attachFile;

  const closeGroup = () => {
    setGroupOpen(false);
    setGroupEmails([]);
    setGroupName("");
  };

  const submitGroup = async (e) => {
    e.preventDefault();
    const emails = groupEmails;
    if (emails.length < 2) {
      toast.error("Error", {
        description: "Add at least 2 connected Sieles (3+ people total)",
      });
      return;
    }
    setGroupSaving(true);
    const created = await createGroupChat(
      groupName.trim() || "Group Chat",
      emails,
    );
    setGroupSaving(false);
    if (created) {
      const full = {
        ...created,
        _id: created._id,
        name: groupName.trim() || "Group Chat",
        isGroup: true,
        initial: "G",
      };
      closeGroup();
      openChat(full);
      setActiveId(String(created._id));
    }
  };

  return {
    activeId,
    setActiveId,
    draft,
    composer,
    setDraft,
    query,
    setQuery,
    active,
    filtered,
    threads,
    send,
    showEmoji,
    setShowEmoji,
    chatFilter,
    setChatFilter,
    groupOpen,
    setGroupOpen,
    groupName,
    setGroupName,
    groupEmails,
    setGroupEmails,
    groupSaving,
    submitGroup,
    closeGroup,
    editChatMessage,
    unsendChatMessage,
    sendFile,
  };
}
