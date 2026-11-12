import { useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import api from '../../utils/axios';
import { chatAttachmentUrl } from '../../utils/chatAttachments';

export default function ChatFile({ attachment }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
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
  return <div className="min-w-0">
    <button type="button" onClick={download} disabled={downloading} aria-busy={downloading}
      aria-label={`Download ${attachment.name || 'file'}`}
      className="flex min-w-0 items-center gap-2 rounded-lg py-1 text-left font-medium underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 break-all">{attachment.name || 'Download file'}</span>
      {downloading ? <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Download className="h-3.5 w-3.5 shrink-0" />}
    </button>
    {error && <p role="alert" className="mt-1 text-xs">{error}</p>}
  </div>;
}
