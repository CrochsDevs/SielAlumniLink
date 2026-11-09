import { useEffect, useRef, useSyncExternalStore } from "react";
import GradCapLoader from "./GraduationCapAnimation";
import { isDarkActive } from "../../lib/theme";
import "./GraduationCapLoader.css";

function subscribeToTheme(onChange) {
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("alumnilink:theme-change", onChange);
  window.addEventListener("storage", onChange);
  systemTheme.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("alumnilink:theme-change", onChange);
    window.removeEventListener("storage", onChange);
    systemTheme.removeEventListener("change", onChange);
  };
}

export default function GraduationCapLoader({
  label = "Loading",
  fullScreen = true,
  compact = false,
  speed = 1,
  className = "",
}) {
  const animationRef = useRef(null);
  const dark = useSyncExternalStore(subscribeToTheme, isDarkActive, () => false);

  useEffect(() => {
    const loader = new GradCapLoader(animationRef.current, { speed });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      if (motion.matches) {
        loader.pause();
        loader.render(0);
      } else {
        loader.play();
      }
    };
    const resize = new ResizeObserver(() => loader.setStroke());
    resize.observe(animationRef.current);
    updateMotion();
    motion.addEventListener("change", updateMotion);
    return () => {
      motion.removeEventListener("change", updateMotion);
      resize.disconnect();
      loader.destroy();
    };
  }, [speed]);

  return (
    <div
      className={`graduation-cap-loader${fullScreen ? " graduation-cap-loader--fullscreen" : ""}${compact ? " graduation-cap-loader--compact" : ""} ${className}`.trim()}
      data-theme={dark ? "dark" : "light"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="graduation-cap-loader__animation" ref={animationRef} aria-hidden="true" />
      <div className="graduation-cap-loader__label">
        {label}
        <span className="graduation-cap-loader__dots" aria-hidden="true" />
      </div>
    </div>
  );
}
