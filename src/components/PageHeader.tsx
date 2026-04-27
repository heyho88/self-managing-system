import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="border-b border-line px-4 py-2 flex items-baseline gap-3">
      <h1 className="text-xl font-medium text-ink">{title}</h1>
      {subtitle && <span className="text-sm text-sub">{subtitle}</span>}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export function EmptyShell({ note }: { note: string }) {
  return (
    <div className="px-4 py-6 text-sm text-sub">
      <div className="border border-dashed border-line px-4 py-6">{note}</div>
    </div>
  );
}
