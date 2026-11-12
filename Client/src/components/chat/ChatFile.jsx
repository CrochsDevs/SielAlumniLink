import { useRef, useState } from 'react';
import { Download, FileArchive, FileText, LoaderCircle } from 'lucide-react';
import api from '../../utils/axios';
import { chatAttachmentUrl } from '../../utils/chatAttachments';
import './ChatFile.css';

const fileSize = bytes => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes < 1024 * 1024 ? 'KB' : 'MB';
  const value = bytes / (unit === 'KB' ? 1024 : 1024 * 1024);
  return `${Number(value.toFixed(1))} ${unit}`;
};

export default function ChatFile({ attachment }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const name = attachment.name || 'Attachment';
  const extension = name.includes('.') ? name.split('.').at(-1).toUpperCase() : '';
  const archive = ['ZIP', 'RAR', '7Z', 'GZ', 'TAR'].includes(extension);
  const Icon = archive ? FileArchive : FileText;
  const metadata = [extension ? `${extension} file` : 'File', fileSize(attachment.bytes)].filter(Boolean).join(' · ');
  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setDownloading(true);
    setError('');
    try {
      const url = chatAttachmentUrl(attachment);
      const apiOrigin = new URL(api.defaults.baseURL || '/api', window.location.origin).origin;
      let blob;
      if (new URL(url).origin === apiOrigin) {
        const response = await api.get(url, { responseType: 'blob' });
        blob = response.data;
      } else {
        // Legacy public assets do not receive the application's account header or cookies.
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) throw new Error('Download unavailable');
        blob = await response.blob();
      }
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.name || 'attachment';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setError('Unable to download this file. Please try again.');
    } finally {
      pending.current = false;
      setDownloading(false);
    }
  };
  return <div className="chat-file">
    <button type="button" onClick={download} disabled={downloading} aria-busy={downloading}
      aria-label={`Download ${attachment.name || 'file'}`}
      className="chat-file-card">
      <span className="chat-file-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.6} /></span>
      <span className="chat-file-details">
        <span className="chat-file-name" title={name}>{name}</span>
        <span className="chat-file-meta">{downloading ? 'Downloading…' : metadata}</span>
      </span>
      <span className="chat-file-download" aria-hidden="true">{downloading ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}</span>
    </button>
    {error && <p role="alert" className="chat-file-error">{error}</p>}
  </div>;
}
