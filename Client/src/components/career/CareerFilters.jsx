import { createElement, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, RotateCcw, SlidersHorizontal, X } from "lucide-react";

export function CareerFilters({
  categories,
  selectedCategories,
  sources,
  selectedSources,
  rows,
  categoryLabel,
  resultCount,
  onCategoryChange,
  onSourceChange,
  onClear,
  onClose,
}) {
  return (
    <>
      <div className="career-filter-heading">
        <div className="flex items-center gap-2.5">
          <span className="career-filter-heading-icon">
            <SlidersHorizontal size={17} aria-hidden="true" />
          </span>
          <div>
            <h2>Filters</h2>
            <p>Refine your results</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="career-filter-close"
          >
            <X size={19} />
          </button>
        )}
      </div>
      <div className="career-filter-groups">
        <fieldset
          data-filter-group={
            categoryLabel === "Opportunity type" ? "opportunities" : undefined
          }
        >
          <legend>{categoryLabel}</legend>
          <div className="space-y-1">
            {categories.map((category) => (
              <label
                key={category.id}
                className={`career-filter-option ${selectedCategories.includes(category.id) ? "is-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Filter ${category.label}`}
                  checked={selectedCategories.includes(category.id)}
                  onChange={() => onCategoryChange(category.id)}
                />
                {createElement(category.icon, {
                  size: 15,
                  "aria-hidden": true,
                })}
                <span className="min-w-0 flex-1">{category.label}</span>
                <span className="career-filter-count">
                  {rows.filter((row) => row.category === category.id).length}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset data-filter-group="sources">
          <legend>Posted by</legend>
          <div className="space-y-1">
            {sources.map(([id, label]) => (
              <label
                key={id}
                className={`career-filter-option ${selectedSources.includes(id) ? "is-selected" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Filter ${label}`}
                  checked={selectedSources.includes(id)}
                  onChange={() => onSourceChange(id)}
                />
                <span className="min-w-0 flex-1">{label}</span>
                <span className="career-filter-count">
                  {rows.filter((row) => row.source === id).length}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="career-filter-footer">
        <p role="status">
          {resultCount} {resultCount === 1 ? "result" : "results"} found
        </p>
        <button type="button" onClick={onClear} className="career-filter-reset">
          <RotateCcw size={14} aria-hidden="true" />
          Clear all
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="career-filter-results"
          >
            View results
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

export function CareerFilterDrawer({ onClose, children }) {
  const dialogRef = useRef(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [onClose]);
  return createPortal(
    <dialog
      ref={dialogRef}
      id="career-filter-drawer"
      aria-label="Career filters"
      className="career-marketplace career-filter-drawer"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="career-filter-panel">{children}</div>
    </dialog>,
    document.body,
  );
}
