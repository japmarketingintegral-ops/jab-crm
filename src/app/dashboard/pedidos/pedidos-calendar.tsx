'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PedidoTarjeta } from './pedidos-kanban';
import { cambiarEstadoPedido, obtenerUrlArchivo } from './actions';
import { PedidoDetailPanel, CATEGORIA_COLOR } from './pedido-detail-panel';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function claveFecha(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PedidosCalendar({
  pedidos,
  esEquipoJab,
}: {
  pedidos: PedidoTarjeta[];
  esEquipoJab: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mes, setMes] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<string | null>(null);
  const [imagenes, setImagenes] = useState<Record<string, string>>({});

  const porDia = useMemo(() => {
    const mapa = new Map<string, PedidoTarjeta[]>();
    for (const p of pedidos) {
      if (!p.fechaProgramada) continue;
      const lista = mapa.get(p.fechaProgramada) ?? [];
      lista.push(p);
      mapa.set(p.fechaProgramada, lista);
    }
    return mapa;
  }, [pedidos]);

  const dias = useMemo(() => {
    const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const finMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const inicioGrilla = new Date(inicioMes);
    inicioGrilla.setDate(inicioGrilla.getDate() - inicioGrilla.getDay());
    const finGrilla = new Date(finMes);
    finGrilla.setDate(finGrilla.getDate() + (6 - finGrilla.getDay()));

    const resultado: Date[] = [];
    for (let d = new Date(inicioGrilla); d <= finGrilla; d.setDate(d.getDate() + 1)) {
      resultado.push(new Date(d));
    }
    return resultado;
  }, [mes]);

  useEffect(() => {
    const pendientes = pedidos.filter(
      (p) =>
        p.fechaProgramada &&
        p.primeraImagenId &&
        p.fechaProgramada.startsWith(`${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`) &&
        !(p.id in imagenes),
    );
    if (pendientes.length === 0) return;
    let cancelado = false;
    Promise.all(
      pendientes.map(async (p) => {
        const res = await obtenerUrlArchivo(p.primeraImagenId!);
        return 'url' in res ? ([p.id, res.url] as const) : null;
      }),
    ).then((resultados) => {
      if (cancelado) return;
      setImagenes((prev) => {
        const next = { ...prev };
        for (const r of resultados) if (r) next[r[0]] = r[1];
        return next;
      });
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, pedidos]);

  function aprobar(pedidoId: string) {
    startTransition(async () => {
      await cambiarEstadoPedido(pedidoId, 'aprobado');
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
            className="rounded-full border border-jab-border px-2.5 py-1 text-xs text-jab-muted hover:text-jab-text"
          >
            ←
          </button>
          <p className="text-sm font-semibold capitalize">
            {mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
            className="rounded-full border border-jab-border px-2.5 py-1 text-xs text-jab-muted hover:text-jab-text"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-jab-border rounded-lg overflow-hidden border border-jab-border flex-1 min-h-0">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="bg-jab-panel-2 text-center text-[10px] font-semibold text-jab-muted uppercase py-1.5">
              {d}
            </div>
          ))}
          {dias.map((d) => {
            const clave = claveFecha(d);
            const items = porDia.get(clave) ?? [];
            const esMesActual = d.getMonth() === mes.getMonth();
            return (
              <div
                key={clave}
                className={`bg-jab-panel p-1.5 min-h-[110px] overflow-y-auto ${esMesActual ? '' : 'opacity-40'}`}
              >
                <p className="text-[10px] text-jab-muted mb-1">{d.getDate()}</p>
                <div className="space-y-1">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setPedidoSeleccionado(p.id)}
                      className="cursor-pointer rounded-md bg-jab-panel-2 border border-jab-border overflow-hidden hover:border-jab-accent"
                    >
                      {imagenes[p.id] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imagenes[p.id]} alt="" className="h-14 w-full object-cover" />
                      )}
                      <div className="p-1">
                        <span
                          className={`inline-block rounded px-1 py-0.5 text-[8px] font-bold uppercase mb-0.5 ${CATEGORIA_COLOR[p.categoria]}`}
                        >
                          {p.categoria}
                        </span>
                        <p className="text-[10px] font-medium truncate">{p.titulo}</p>
                        {p.estado !== 'aprobado' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              aprobar(p.id);
                            }}
                            className="mt-1 w-full rounded bg-jab-lime text-jab-lime-ink text-[9px] font-bold uppercase tracking-wide py-0.5"
                          >
                            Aprobar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pedidoSeleccionado && (
        <PedidoDetailPanel
          key={pedidoSeleccionado}
          pedidoId={pedidoSeleccionado}
          esEquipoJab={esEquipoJab}
          onClose={() => setPedidoSeleccionado(null)}
        />
      )}
    </>
  );
}
