export function KpiCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
      <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase">{etiqueta}</p>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}
