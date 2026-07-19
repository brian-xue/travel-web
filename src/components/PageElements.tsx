import type { PropsWithChildren, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: PropsWithChildren<{ title: string; description: string; action?: ReactNode }>) {
  return (
    <section className="page-header">
      <div>
        <p className="eyebrow">Workspace</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}

export function PlaceholderGrid({ items }: { items: Array<{ title: string; value: string; detail: string }> }) {
  return (
    <div className="card-grid">
      {items.map((item) => (
        <article className="panel-card" key={item.title}>
          <p className="eyebrow">{item.title}</p>
          <strong>{item.value}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </div>
  );
}
