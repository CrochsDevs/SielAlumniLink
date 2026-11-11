export const composerText = element => typeof element?.setSelectionRange === 'function' ? element.value || '' : element?.textContent || '';

export function composerSelection(element) {
  if (typeof element?.setSelectionRange === 'function') return { start: element?.selectionStart ?? 0, end: element?.selectionEnd ?? 0 };
  const selection = window.getSelection();
  if (!selection?.rangeCount || !element.contains(selection.anchorNode) || !element.contains(selection.focusNode)) {
    const end = composerText(element).length;
    return { start: end, end };
  }
  const range = selection.getRangeAt(0), prefix = range.cloneRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(range.startContainer, range.startOffset);
  const start = prefix.toString().length;
  return { start, end: start + range.toString().length };
}

export function setComposerSelection(element, start, end = start) {
  if (!element) return;
  if (typeof element.setSelectionRange === 'function') { element.setSelectionRange(start, end); return; }
  if (!element.firstChild) element.append(document.createTextNode(''));
  const locate = offset => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node, last;
    while ((node = walker.nextNode())) {
      last = node;
      if (offset <= node.length) return [node, offset];
      offset -= node.length;
    }
    return last ? [last, last.length] : [element, 0];
  };
  const range = document.createRange();
  range.setStart(...locate(start));
  range.setEnd(...locate(end));
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  if (start === end && document.activeElement === element) {
    const caret = range.getClientRects()[0], bounds = element.getBoundingClientRect();
    const padding = getComputedStyle(element);
    const left = bounds.left + parseFloat(padding.paddingLeft || 0);
    const right = bounds.right - parseFloat(padding.paddingRight || 0);
    if (caret?.height && caret.left < left) element.scrollLeft -= left - caret.left;
    else if (caret?.height && caret.right > right) element.scrollLeft += caret.right - right;
  }
}
