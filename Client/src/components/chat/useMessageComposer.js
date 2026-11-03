import { useCallback, useEffect, useRef, useState } from 'react';
import { gooeyToast as toast } from 'goey-toast';
import { CHAT_IMAGE_ACCEPT, MAX_CHAT_FILE_BYTES } from '../../utils/chatAttachments';

const emptyComposer = conversationId => ({ conversationId, draft: '', edit: null, saving: false, attachment: null });

// Full-page and floating chats share the same edit/save/cancel behavior.
export function useMessageComposer(conversationId, onSend, onEdit) {
  const [state, setState] = useState(() => emptyComposer(conversationId));
  const inputRef = useRef(null);
  const bindInput = useCallback(node => { inputRef.current = node; }, []);
  useEffect(() => {
    const url = state.attachment?.url;
    return () => { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); };
  }, [state.attachment]);
  if (state.conversationId !== conversationId) {
    setState(emptyComposer(conversationId));
  }
  const focus = () => inputRef.current?.focus();
  const setDraft = value => setState(previous => previous.saving ? previous : ({ ...previous,
    draft: typeof value === 'function' ? value(previous.draft) : value }));
  const startEdit = (id, messageId, text) => {
    if (String(id) !== String(conversationId) || state.saving) return;
    setState(previous => ({ ...previous, draft: text,
      edit: { messageId, originalText: text, restoreDraft: previous.edit?.restoreDraft ?? previous.draft } }));
    focus();
  };
  const cancelEdit = () => {
    if (state.saving) return;
    setState(previous => ({ ...previous, draft: previous.edit?.restoreDraft ?? previous.draft, edit: null }));
    focus();
  };
  const removeImage = () => {
    setState(previous => previous.saving ? previous : ({ ...previous, attachment: null }));
    focus();
  };
  const attachFile = (file, kind = 'image') => {
    if (!file || state.saving) return;
    if (state.edit) { toast.error('Finish editing first', { description: 'Save or cancel your edit before attaching a file.' }); return; }
    if (!file.size || file.size > MAX_CHAT_FILE_BYTES) { toast.error('Unable to attach file', { description: 'Choose a non-empty file up to 10 MB.' }); return; }
    if ((kind === 'image' || file.type.startsWith('image/')) && !CHAT_IMAGE_ACCEPT.split(',').includes(file.type)) {
      toast.error('Unsupported image', { description: 'Choose a JPG, PNG, GIF, or WebP image.' }); return;
    }
    setState(previous => ({ ...previous, attachment: { kind: file.type.startsWith('image/') ? 'image' : 'file',
      name: file.name || 'Pasted image.png', url: URL.createObjectURL(file), file } }));
    focus();
  };
  const onPaste = event => {
    const clipboard = event.clipboardData;
    const items = Array.from(clipboard?.items || []).filter(item => item.kind === 'file' && item.type.startsWith('image/'));
    const images = items.length ? items.map(item => item.getAsFile()).filter(Boolean)
      : Array.from(clipboard?.files || []).filter(file => file.type.startsWith('image/'));
    if (!images.length) return; // Ordinary text paste keeps its native behavior.
    event.preventDefault();
    if (images.length > 1) toast.error('One image per message', { description: 'The first image has been added. Send the other images separately.' });
    attachFile(images[0]);
  };
  const submit = async event => {
    event.preventDefault();
    if ((!state.draft.trim() && (!state.attachment || state.edit)) || !conversationId || state.saving) return;
    if (!state.edit) {
      if (state.attachment) {
        const attachment = state.attachment;
        setState(previous => ({ ...previous, saving: true }));
        let saved = false;
        try { saved = (await onSend(conversationId, state.draft.trim(), attachment)) !== false; }
        finally {
          setState(previous => previous.conversationId !== conversationId || previous.attachment !== attachment ? previous : ({ ...previous, saving: false,
            ...(saved ? { draft: '', attachment: null } : {}) }));
        }
        return;
      }
      void onSend(conversationId, state.draft.trim());
      setDraft('');
      return;
    }
    const edit = state.edit;
    if (state.draft.trim() === edit.originalText) { cancelEdit(); return; }
    setState(previous => ({ ...previous, saving: true }));
    let saved = false;
    try { saved = (await onEdit(conversationId, edit.messageId, state.draft.trim())) !== false; }
    finally {
      setState(previous => previous.edit !== edit ? previous : ({ ...previous, saving: false,
        ...(saved ? { edit: null, draft: edit.restoreDraft } : {}) }));
    }
  };
  return { draft: state.draft, setDraft, editing: !!state.edit, saving: state.saving,
    attachment: state.attachment, removeImage, onPaste, attachFile,
    canSubmit: !!(state.draft.trim() || (!state.edit && state.attachment)) && !state.saving,
    startEdit, cancelEdit, submit, bindInput };
}
