import * as Dialog from "@radix-ui/react-dialog";
import { X, Search, Download, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const s = String(children);
  const c =
    tone ??
    (/conflict|Critical|failed|Rejected/i.test(s)
      ? "red"
      : /Verified|Healthy|Recovered|Resolved|Approved/i.test(s)
        ? "green"
        : /Open|review|Unverified|Medium|High|Executed/i.test(s)
          ? "amber"
          : "neutral");
  return (
    <span className={`badge ${c}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow ?? "SONORESCUE / OPERATIONS"}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </header>
  );
}
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-content">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>
            {description ??
              "Inspect synthetic workflow information and evidence."}
          </Dialog.Description>
          <Dialog.Close
            className="icon-button modal-close"
            aria-label="Close dialog"
          >
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function download(name: string, data: unknown, csv = false) {
  const text = csv ? String(data) : JSON.stringify(data, null, 2);
  const url = URL.createObjectURL(
    new Blob([text], { type: csv ? "text/csv" : "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    `"${String(v ?? "")
      .replaceAll('"', '""')
      .replace(/^[=+@-]/, "'$&")}"`;
  return [
    keys.map(cell).join(","),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(",")),
  ].join("\n");
}
export function ExportButton({
  data,
  name = "sonorescue-export",
}: {
  data: Record<string, unknown>[];
  name?: string;
}) {
  return (
    <button
      className="button"
      onClick={() => download(`${name}.csv`, csv(data), true)}
    >
      <Download size={15} /> Export CSV
    </button>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Stat({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  onClick?: () => void;
}) {
  return (
    <button className="stat-card" onClick={onClick}>
      <span>
        {label}
        <ArrowUpRight size={16} />
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
