import { useState } from 'react';

const digitsOnly = value => value.replace(/\D/g, '');

export default function VerificationCodeInput({ value, onChange, inputRef, disabled }) {
  const [focused, setFocused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const select = () => {
    const input = inputRef.current;
    if (input) setSelection({ start: input.selectionStart, end: input.selectionEnd });
  };

  const moveCaret = position => {
    // Wait for React to apply the controlled value before restoring the caret.
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(position, position);
      select();
    });
  };

  const handlePaste = event => {
    event.preventDefault();
    const pasted = digitsOnly(event.clipboardData.getData('text'));
    if (!pasted) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    // A complete code replaces the old code, even when pasting in a middle box.
    const next = pasted.length >= 6 ? pasted.slice(0, 6) : (value.slice(0, start) + pasted + value.slice(end)).slice(0, 6);
    onChange(next);
    moveCaret(pasted.length >= 6 ? 6 : Math.min(start + pasted.length, next.length));
  };

  return <div className={`verification-code ${focused ? 'is-focused' : ''} ${disabled ? 'is-disabled' : ''}`}>
    <div className="verification-code-boxes" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => {
      const selected = focused && selection.end > selection.start && index >= selection.start && index < selection.end;
      const active = focused && selection.start === selection.end && index === Math.min(selection.start, 5);
      return <span key={index} className={`${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''} ${value[index] ? 'has-value' : ''}`}>{value[index] || <i />}</span>;
    })}</div>
    {/* One native input preserves mobile editing, deletion, selection, and OTP autofill. */}
    <input
      ref={inputRef}
      id="recovery-otp"
      className="verification-code-native"
      name="otp"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoCapitalize="off"
      spellCheck={false}
      pattern="[0-9]{6}"
      maxLength={6}
      value={value}
      required
      disabled={disabled}
      aria-describedby="recovery-otp-help"
      onFocus={() => { setFocused(true); select(); }}
      onBlur={() => setFocused(false)}
      onSelect={select}
      onPaste={handlePaste}
      onClick={event => {
        if (event.detail !== 1) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const position = Math.min(value.length, Math.max(0, Math.floor((event.clientX - bounds.left) / (bounds.width / 6))));
        event.currentTarget.setSelectionRange(position, Math.min(position + 1, value.length));
        select();
      }}
      onChange={event => {
        const raw = event.currentTarget.value;
        const position = digitsOnly(raw.slice(0, event.currentTarget.selectionStart ?? raw.length)).length;
        onChange(digitsOnly(raw).slice(0, 6));
        moveCaret(Math.min(position, 6));
      }}
    />
  </div>;
}
