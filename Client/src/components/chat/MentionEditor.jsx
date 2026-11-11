import { useLayoutEffect, useRef } from 'react';
import { draftMentionRanges, mentionParts } from './mentionText';
import { composerSelection, composerText, setComposerSelection } from './mentionEditorSelection';
import './MentionEditor.css';

// A single-line text editor: only validated draft mentions get formatting.
// Build DOM with text nodes so pasted HTML can never become executable markup.
export default function MentionEditor({ value, people, onChange, onKeyDown, onFocus, onBlur, disabled, className, ref: bindInput, ...props }) {
  const editor = useRef(null), composing = useRef(false);
  const lastSelection = useRef(null), pointerFocus = useRef(false);
  useLayoutEffect(() => {
    const element = editor.current;
    if (!element || composing.current) return;
    const focused = document.activeElement === element;
    const selection = focused ? composerSelection(element) : null;
    const content = document.createElement('div');
    for (const part of mentionParts(value, draftMentionRanges(value, people))) {
      if (!part.authId) content.append(document.createTextNode(part.text));
      else {
        const mention = document.createElement('strong');
        mention.className = 'composer-mention';
        mention.dataset.mentionAuthId = part.authId;
        mention.textContent = part.text;
        content.append(mention);
      }
    }
    if (element.innerHTML !== content.innerHTML) {
      element.replaceChildren(...content.childNodes);
      if (selection) setComposerSelection(element, selection.start, selection.end);
    }
  });
  const update = () => {
    if (composing.current) return;
    const element = editor.current;
    const text = composerText(element).replace(/[\r\n]/g, ' ').slice(0, 2000);
    const caret = Math.min(composerSelection(element).start, text.length);
    lastSelection.current = { ...composerSelection(element), text };
    onChange({ target: { value: text, selectionStart: caret } });
  };
  return <div {...props} ref={node => { editor.current = node; bindInput?.(node); }}
    contentEditable={!disabled} suppressContentEditableWarning aria-disabled={disabled || undefined}
    aria-multiline="false" data-empty={!value} className={`${className} mention-editor`}
    onPointerDown={() => { pointerFocus.current = true; }}
    onPointerUp={() => { pointerFocus.current = false; }}
    onFocus={event => {
      const element = event.currentTarget, selection = lastSelection.current;
      if (!pointerFocus.current && selection?.text === value) requestAnimationFrame(() => {
        if (document.activeElement === element) setComposerSelection(element, selection.start, selection.end);
      });
      pointerFocus.current = false;
      onFocus?.(event);
    }}
    onBlur={event => { lastSelection.current = { ...composerSelection(event.currentTarget), text: composerText(event.currentTarget) }; onBlur?.(event); }}
    onInput={update} onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={() => { composing.current = false; update(); }}
    onBeforeInput={event => { if (event.nativeEvent.inputType?.startsWith('format')) event.preventDefault(); }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      onKeyDown?.(event);
      if (!event.defaultPrevented && event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.closest('form')?.requestSubmit();
      }
    }}
    onPaste={event => {
      if (Array.from(event.clipboardData.items || []).some(item => item.kind === 'file')) return;
      event.preventDefault();
      const element = event.currentTarget;
      const { start, end } = composerSelection(element);
      const current = composerText(element);
      const pasted = event.clipboardData.getData('text/plain').replace(/[\r\n]/g, ' ').slice(0, 2000 - current.length + end - start);
      const next = current.slice(0, start) + pasted + current.slice(end);
      onChange({ target: { value: next, selectionStart: start + pasted.length } });
      requestAnimationFrame(() => setComposerSelection(element, start + pasted.length));
    }} />;
}
