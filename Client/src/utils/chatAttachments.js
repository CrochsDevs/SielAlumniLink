import api from './axios';

export const MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const chatAttachmentUrl = attachment => attachment?.url
  ? new URL(attachment.url, new URL(api.defaults.baseURL || '/api', window.location.origin)).href : '';

export function messageUploadBody(text, clientMessageId, attachment, mentionAuthIds = []) {
  if (!attachment) return { text, clientMessageId, mentionAuthIds };
  if (!(attachment.file instanceof File)) throw new Error('Choose or paste the attachment again.');
  const form = new FormData();
  form.append('text', text);
  form.append('clientMessageId', clientMessageId);
  form.append('mentionAuthIds', JSON.stringify(mentionAuthIds));
  form.append('file', attachment.file);
  return form;
}
