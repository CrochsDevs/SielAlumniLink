// Return to the start of the active view, including nested table/dialog scrollers.
// A dialog owns its scrolling; pagination inside it must not move the background.
export function scrollToTop(origin) {
  const modal = origin?.closest('dialog, [role="dialog"]');
  const scope = modal || origin?.closest('main') || origin;
  if (scope) {
    for (const element of [scope, ...scope.querySelectorAll('*')]) {
      if (element.scrollTop > 0) element.scrollTo({ top: 0, behavior: 'instant' });
    }
    for (let ancestor = scope.parentElement; ancestor && ancestor !== document.body && !modal; ancestor = ancestor.parentElement) {
      if (ancestor.scrollTop > 0) ancestor.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  if (!modal) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function scrollAfterViewChange(origin) {
  const context = origin?.closest('dialog, [role="dialog"], main') || origin;
  scrollToTop(context);
  // Reapply after React updates rows and popup controls restore their focus.
  requestAnimationFrame(() => {
    if (!context || context.isConnected) scrollToTop(context);
  });
}
