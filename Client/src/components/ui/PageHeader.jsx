export default function PageHeader({ title, description, children }) {
  return (
    <header className="workspace-page-header flex flex-wrap items-start justify-between gap-4">
      <div className="page-header-copy min-w-0">
        <h1>{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {children && <div className="page-header-actions flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
