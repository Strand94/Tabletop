/** Temporary empty-state for screens implemented in later stages. */
export function Placeholder({ title }: { title: string }): JSX.Element {
  return (
    <div className="p-7">
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <div className="font-display text-lg font-semibold">{title}</div>
        <p className="mt-1 text-[13px] text-muted">Kommer snart.</p>
      </div>
    </div>
  );
}
