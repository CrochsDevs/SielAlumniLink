import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Mail, UserPlus, X } from 'lucide-react';
import api from '../../utils/axios';
import { AdminButton } from '../../components/admin/AdminUI';

const initial = { first_name: '', middle_name: '', last_name: '', extension_name: '', email: '',
  contact_no: '', student_number: '', source_user_type: 'alumni', program: '', year_level: '', section: '', status: 'Graduated' };
const fields = [
  ['first_name', 'First name', true, 255], ['last_name', 'Last name', true, 255],
  ['middle_name', 'Middle name', false, 255], ['extension_name', 'Extension name', false, 255],
  ['email', 'Email address', true, 254], ['contact_no', 'Contact number', false, 20],
  ['student_number', 'Student number', false, 100], ['program', 'Program / Course', false, 255],
  ['year_level', 'Year level', false, 255], ['section', 'Section', false, 255], ['status', 'Academic status', false, 255],
];

export default function RegisterUserDialog({ onClose, onRegistered }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async event => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await api.post('/users/invitations', form);
      setResult(response.data.data);
      setCooldown(60);
      onRegistered();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register the user. Please try again.');
    } finally { pending.current = false; setSaving(false); }
  };
  const resend = async () => {
    if (pending.current || cooldown) return;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await api.post(`/users/${result.authId}/invitation`);
      setResult(previous => ({ ...previous, ...response.data.data }));
      setCooldown(60);
      onRegistered();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to resend the invitation.');
      if (err.response?.status === 429) setCooldown(60);
    } finally { pending.current = false; setSaving(false); }
  };

  return (
    <dialog ref={dialog} className="admin-register-dialog" aria-labelledby="register-user-title"
      aria-describedby="register-user-description" onCancel={event => { event.preventDefault(); if (!pending.current) onClose(); }}>
      <div className="admin-register-heading">
        <span className="admin-register-icon"><UserPlus size={21} /></span>
        <div>
          <h2 id="register-user-title">Register &amp; invite user</h2>
          <p id="register-user-description">Create their account. Let them choose their password.</p>
        </div>
        <button type="button" className="admin-register-close" aria-label="Close registration" disabled={saving} onClick={onClose}><X size={20} /></button>
      </div>
      {result ? (
        <div className="admin-register-result">
          {result.invitationDelivery === 'accepted' ? <CheckCircle2 size={36} className="text-emerald-600" /> : <AlertCircle size={36} className="text-amber-600" />}
          <h3>{result.invitationDelivery === 'accepted' ? 'User registered. Invitation sent.' : 'User registered. Email needs a retry.'}</h3>
          <p><strong>{result.name}</strong> now has an account for <strong>{result.email}</strong>.</p>
          <p>{result.invitationDelivery === 'accepted'
            ? 'The email provider accepted the invitation. They can open the link within 24 hours and set their own password. Ask them to check their spam folder too.'
            : 'The email provider could not send the invitation. Their account is saved. Check the email configuration, then resend the invitation here or from the user list.'}</p>
          {error && <p role="alert" className="admin-register-error">{error}</p>}
          <div className="admin-register-footer">
            {result.invitationDelivery !== 'accepted' && <AdminButton variant="secondary" disabled={saving || cooldown > 0} onClick={resend}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
              {saving ? 'Sending...' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Resend invitation'}
            </AdminButton>}
            <AdminButton onClick={onClose} disabled={saving}>Done</AdminButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="admin-register-body">
            <div className="admin-register-note"><Mail size={18} /><p>An invitation will be emailed after registration. The user will verify their email and create a password. No temporary password is needed.</p></div>
            <p className="admin-register-required">Fields marked * are required.</p>
            <div className="admin-register-grid">
              <label className="admin-register-field admin-register-wide">Account type *
                <select value={form.source_user_type} disabled={saving} onChange={event => {
                  const role = event.target.value;
                  setForm(previous => ({ ...previous, source_user_type: role,
                    status: ['Graduated', 'Enrolled'].includes(previous.status) ? role === 'alumni' ? 'Graduated' : 'Enrolled' : previous.status }));
                }}><option value="alumni">Alumni</option><option value="student">Student</option></select>
              </label>
              {fields.map(([key, label, required, maxLength]) => (
                <label key={key} className={`admin-register-field ${key === 'email' || key === 'program' ? 'admin-register-wide' : ''}`}>
                  {label}{required ? ' *' : ''}
                  <input name={key} type={key === 'email' ? 'email' : key === 'contact_no' ? 'tel' : 'text'}
                    value={form[key]} required={required} maxLength={maxLength} disabled={saving}
                    autoComplete="off" onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            {error && <p role="alert" className="admin-register-error">{error}</p>}
          </div>
          <div className="admin-register-footer">
            <AdminButton variant="secondary" onClick={onClose} disabled={saving}>Cancel</AdminButton>
            <AdminButton type="submit" disabled={saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
              {saving ? 'Registering & sending...' : 'Register & send invitation'}
            </AdminButton>
          </div>
        </form>
      )}
    </dialog>
  );
}
