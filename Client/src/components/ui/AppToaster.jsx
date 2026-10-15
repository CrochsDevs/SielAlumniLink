import { useEffect, useState } from 'react';
import { GooeyToaster } from 'goey-toast';

export default function AppToaster() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <GooeyToaster
      position="top-center"
      theme={theme}
      preset="subtle"
      duration={4500}
      closeButton
      closeOnEscape
      showProgress
      visibleToasts={3}
      maxQueue={5}
      queueOverflow="drop-oldest"
    />
  );
}
