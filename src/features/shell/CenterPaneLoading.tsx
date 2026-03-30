interface CenterPaneLoadingProps {
  dataTestId?: string;
  breadcrumb: string[];
  title: string;
  description: string;
  bodyPreview?: string;
}

export function CenterPaneLoading({
  dataTestId,
  breadcrumb,
  title,
  description,
  bodyPreview,
}: CenterPaneLoadingProps) {
  return (
    <section
      data-testid={dataTestId}
      data-pane-density="compact"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-canvas)] px-7 pb-5 pt-5 shadow-[0_10px_24px_rgba(15,23,42,0.035)]"
    >
      <header className="flex items-center justify-between border-b border-[rgba(148,163,184,0.16)] pb-4">
        <nav className="flex items-center gap-2 text-[11px] font-medium text-[var(--wk-muted)]">
          {breadcrumb.map((item, index) => (
            <span key={`${item}-${index}`} className="contents">
              {index > 0 ? <span>›</span> : null}
              <span className={index === breadcrumb.length - 1 ? 'text-[var(--wk-ink)]' : undefined}>
                {item}
              </span>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 animate-spin rounded-[12px] border-2 border-blue-500 border-t-transparent bg-white/84" />
        </div>
      </header>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
        <div className="px-1">
          <h1 className="text-[22px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--wk-ink)]">{title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[12px] text-[var(--wk-muted)]">
            <span>{description}</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2 text-[13px] text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            <span>{bodyPreview || description}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
