import { useLayoutEffect, useRef, useState } from 'react';

// Scale the document instead of rearranging its columns on small screens.
export default function ResumePreview({ children }) {
  const container = useRef(null);
  const page = useRef(null);
  const [size, setSize] = useState({ scale: 1, height: 1123 });

  useLayoutEffect(() => {
    const measure = () => {
      const scale = Math.min(1, container.current.clientWidth / 794);
      const height = page.current.offsetHeight * scale;
      setSize(previous => previous.scale === scale && previous.height === height ? previous : { scale, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    observer.observe(page.current);
    measure();
    return () => observer.disconnect();
  }, []);

  return <div ref={container} className="resume-preview" style={{ height: size.height }}>
    <div ref={page} className="resume-preview-page" style={{ transform: `scale(${size.scale})` }}>{children}</div>
  </div>;
}
