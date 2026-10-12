import { useEffect, useId, useRef, useState } from 'react';
import { Briefcase, CalendarDays, HandHeart, ImagePlus, ImageUp, Sparkles, X } from 'lucide-react';
import api from '../../utils/axios';
import ProfileAvatar from '../profile/ProfileAvatar';
import { MAX_POST_IMAGES, POST_IMAGE_ACCEPT, removePostImage, uploadPostImage, validatePostImage } from '../../utils/feedImages';

const kinds = [
  { type: 'referral', label: 'Referral', Icon: HandHeart },
  { type: 'hiring', label: 'Hiring', Icon: Briefcase },
  { type: 'event', label: 'Event', Icon: CalendarDays },
  { type: 'story', label: 'Success story', Icon: Sparkles },
];
const fieldClass = 'w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export function AudienceSelect({ value, onChange, privateOnly = false }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      Who can see this?
      <select aria-label="Post audience" value={value} onChange={e => onChange(e.target.value)} className={fieldClass + ' !w-auto max-w-full !p-2'}>
        {!privateOnly && <option value="public">Public · All users</option>}
        <option value="connections">Connections only</option>
      </select>
    </label>
  );
}

export function FeedDialog({ title, onClose, children, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
      className="m-auto max-h-[94dvh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 text-zinc-900 shadow-xl backdrop:bg-black/50 sm:w-[calc(100%-2rem)] sm:p-5 dark:bg-zinc-900 dark:text-zinc-100">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close dialog" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"><X size={20} /></button>
      </div>
      {children}
    </dialog>
  );
}

export default function FeedComposer({ user, defaultType = 'update', fixedType, onPublished }) {
  const [type, setType] = useState(null);
  const [draft, setDraft] = useState({ title: '', body: '', audience: 'public', details: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const pending = useRef(false);
  const picker = useRef(null);
  const previewUrls = useRef(new Set());
  const activeUploads = useRef(new Set());
  const uploading = photos.some(photo => photo.status === 'uploading' || photo.status === 'queued' || photo.status === 'removing');
  const unreadyPhotos = photos.some(photo => !photo.asset || photo.status === 'removing');
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, []);
  const open = next => { setType(next); setError(''); };
  const detail = (key, value) => setDraft(prev => ({ ...prev, details: { ...prev.details, [key]: value } }));
  const uploadPhoto = async photo => {
    if (activeUploads.current.has(photo.key)) return;
    activeUploads.current.add(photo.key);
    setPhotos(prev => prev.map(item => item.key === photo.key ? { ...item, status: 'uploading', percent: 0, error: '' } : item));
    try {
      const asset = await uploadPostImage(photo.file, percent => setPhotos(prev => prev.map(item => item.key === photo.key ? { ...item, percent: Math.min(percent, 100) } : item)));
      setPhotos(prev => prev.map(item => item.key === photo.key ? { ...item, asset, status: 'uploaded', percent: 100 } : item));
    } catch (err) {
      setPhotos(prev => prev.map(item => item.key === photo.key ? { ...item, status: 'failed', error: err.response?.data?.message || err.message || 'Photo upload failed.' } : item));
    } finally { activeUploads.current.delete(photo.key); }
  };
  const addPhotos = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    try {
      if (photos.length + files.length > MAX_POST_IMAGES) throw new Error(`You can attach up to ${MAX_POST_IMAGES} photos per post.`);
      files.forEach(validatePostImage);
      const additions = files.map(file => {
        const preview = URL.createObjectURL(file);
        previewUrls.current.add(preview);
        return { key: crypto.randomUUID(), file, preview, alt: '', status: 'queued', percent: 0 };
      });
      setPhotos(prev => [...prev, ...additions]);
      setError('');
      // Upload immediately on selection. Publishing only attaches completed uploads.
      for (const photo of additions) await uploadPhoto(photo);
    } catch (err) { setError(err.message); }
  };
  const removePhoto = async key => {
    const photo = photos.find(item => item.key === key);
    if (!photo || ['uploading', 'queued', 'removing'].includes(photo.status)) return;
    if (photo.asset) {
      setPhotos(prev => prev.map(item => item.key === key ? { ...item, status: 'removing' } : item));
      try { await removePostImage(photo.asset.id); }
      catch (err) {
        setPhotos(prev => prev.map(item => item.key === key ? { ...item, status: 'uploaded' } : item));
        setError(err.response?.data?.message || 'Unable to remove photo. Please try again.');
        return;
      }
    }
    if (photo) { URL.revokeObjectURL(photo.preview); previewUrls.current.delete(photo.preview); }
    setPhotos(prev => prev.filter(item => item.key !== key));
  };
  const publish = async e => {
    e.preventDefault();
    if (pending.current || uploading || unreadyPhotos) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const images = photos.map(photo => ({ id: photo.asset.id, alt: photo.alt }));
      const details = { ...draft.details };
      if (type === 'event') {
        details.startAt = new Date(details.startAt).toISOString();
        details.endAt = details.endAt ? new Date(details.endAt).toISOString() : null;
      }
      const res = await api.post('/feed', { ...draft, type, details, images });
      setDraft({ title: '', body: '', audience: 'public', details: {} });
      previewUrls.current.forEach(url => URL.revokeObjectURL(url));
      previewUrls.current.clear();
      setPhotos([]);
      setType(null);
      onPublished(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to publish. Please try again.');
    } finally { setBusy(false); pending.current = false; }
  };
  return (
    <>
      <div className="rounded-2xl border border-emerald-900/10 bg-white p-3 shadow-sm dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-emerald-700"><ProfileAvatar user={user} fallback="A" /></div>
          <button type="button" onClick={() => open(defaultType)} className="min-w-0 flex-1 rounded-2xl border border-zinc-300 px-3 py-3 text-left text-sm text-zinc-500 hover:border-emerald-500 sm:px-4 dark:border-zinc-700 dark:text-zinc-400">
            {defaultType === 'story' ? 'Share your success story and inspire others…' : 'Share an update with your network…'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <button type="button" onClick={() => open(defaultType)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><ImagePlus size={18} className="text-emerald-600" />Photo</button>
          {kinds.filter(kind => !fixedType || kind.type === fixedType).map(kind => <button key={kind.type} type="button" onClick={() => open(kind.type)}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-zinc-600 hover:bg-emerald-50 dark:text-zinc-300 dark:hover:bg-zinc-800"><kind.Icon size={16} className="text-emerald-600" />{kind.label}</button>)}
        </div>
      </div>
      {type && <FeedDialog title={type === 'update' ? 'Create a post' : `Share ${type === 'story' ? 'your success story' : `a ${type} post`}`} busy={busy} onClose={() => setType(null)}>
        <form onSubmit={publish} className="space-y-3">
          <fieldset disabled={busy} className="min-w-0 space-y-3">
          {!fixedType && <label className="block text-sm">Post type
            <select disabled={busy} value={type} onChange={e => setType(e.target.value)} className={fieldClass}>
              <option value="update">Update</option>{kinds.map(k => <option key={k.type} value={k.type}>{k.label}</option>)}
            </select>
          </label>}
          <AudienceSelect value={draft.audience} onChange={audience => setDraft(prev => ({ ...prev, audience }))} />
          <p className="text-xs text-zinc-500">{draft.audience === 'public' ? 'Everyone in the portal can see this post, including users outside your network.' : 'Only you and your accepted connections can see this post.'}</p>
          {type !== 'update' && <label className="block text-sm">{type === 'story' ? 'Story title' : 'Title'}
            <input required maxLength={200} value={draft.title} onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))} className={fieldClass} />
          </label>}
          <label className="block text-sm">{type === 'story' ? 'Your journey, achievements, and advice for others' : 'Post details'}
            <textarea autoFocus required={type !== 'update' || photos.length === 0} maxLength={10000} rows={4} value={draft.body} onChange={e => setDraft(prev => ({ ...prev, body: e.target.value }))} placeholder="What would you like to share?" className={fieldClass + ' resize-y'} />
          </label>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" aria-label={photos.length ? 'Add more photos' : 'Add photos'} title={photos.length ? 'Add more photos' : 'Add photos'} disabled={photos.length >= MAX_POST_IMAGES} onClick={() => picker.current?.click()} className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"><ImageUp size={22} aria-hidden="true" /></button>
              <span className="text-xs text-zinc-500">{photos.length}/{MAX_POST_IMAGES} photos · 10 MB each</span>
            </div>
            <input ref={picker} type="file" multiple accept={POST_IMAGE_ACCEPT} onChange={addPhotos} aria-label="Choose post photos" className="hidden" />
            {photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((photo, index) => <div key={photo.key} className="min-w-0">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  <img src={photo.preview} alt={photo.alt || `Selected photo ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" disabled={['uploading', 'queued', 'removing'].includes(photo.status)} onClick={() => removePhoto(photo.key)} aria-label={`Remove photo ${index + 1}`} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-40"><X size={18} /></button>
                </div>
                <div aria-live="polite" className="mt-1 text-xs text-zinc-500">
                  {photo.status === 'queued' && 'Waiting to upload…'}
                  {photo.status === 'uploading' && <><span>Uploading… {photo.percent}%</span><progress value={photo.percent} max={100} className="h-1.5 w-full accent-emerald-600" /></>}
                  {photo.status === 'uploaded' && 'Photo ready'}
                  {photo.status === 'removing' && 'Removing photo…'}
                  {photo.status === 'failed' && <><p role="alert" className="text-red-600">{photo.error}</p><button type="button" onClick={() => uploadPhoto(photo)} className="min-h-11 font-bold text-emerald-700 underline">Retry upload</button></>}
                </div>
                <label className="mt-2 block text-xs text-zinc-500">Photo {index + 1} description
                  <input maxLength={300} value={photo.alt} onChange={e => setPhotos(prev => prev.map(item => item.key === photo.key ? { ...item, alt: e.target.value } : item))} placeholder="Describe this photo" className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-xs text-zinc-900 dark:border-zinc-700 dark:text-zinc-100" />
                </label>
              </div>)}
            </div>}
          </div>
          {['referral', 'hiring'].includes(type) && <label className="block text-sm">Company or organization
            <input required maxLength={200} value={draft.details.organization || ''} onChange={e => detail('organization', e.target.value)} className={fieldClass} />
          </label>}
          {['referral', 'hiring', 'event'].includes(type) && <>
            <label className="block text-sm">Location{type === 'event' ? ' (or online meeting venue)' : ''}
              <input required={type === 'event'} maxLength={200} value={draft.details.location || ''} onChange={e => detail('location', e.target.value)} className={fieldClass} />
            </label>
            <label className="block text-sm">{type === 'event' ? 'Registration link (optional)' : 'Application or opportunity link (optional)'}
              <input type="url" placeholder="https://" maxLength={2000} value={draft.details.link || ''} onChange={e => detail('link', e.target.value)} className={fieldClass} />
            </label>
          </>}
          {type === 'event' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Starts at (your local time)<input type="datetime-local" required value={draft.details.startAt || ''} onChange={e => detail('startAt', e.target.value)} className={fieldClass} /></label>
            <label className="text-sm">Ends at (optional)<input type="datetime-local" value={draft.details.endAt || ''} onChange={e => detail('endAt', e.target.value)} className={fieldClass} /></label>
          </div>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button disabled={busy || uploading || unreadyPhotos || (!draft.body.trim() && (type !== 'update' || photos.length === 0))} className="min-h-11 w-full rounded-xl bg-emerald-600 p-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Publishing…' : uploading ? 'Uploading photos…' : 'Publish post'}</button>
          </fieldset>
        </form>
      </FeedDialog>}
    </>
  );
}
