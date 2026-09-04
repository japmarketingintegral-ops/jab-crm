'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PedidoDetailPanel, CATEGORIA_LABEL, CATEGORIA_COLOR } from '../dashboard/pedidos/pedido-detail-panel';
import { TareaDetailPanel } from '../dashboard/tablero/tarea-detail-panel';
import { cambiarEstadoTarea } from '../dashboard/tablero/actions';
import { cambiarEstadoPedido } from '../dashboard/pedidos/actions';
import { iniciales, fechaCortaSinHora, nivelVencimiento } from '@/lib/format';
import type { EtiquetaTablero } from '../dashboard/tablero/actions';
import type { TareaInternaEstado, PedidoEstado, PedidoCategoria } from '@/lib/supabase/types';

export type TarjetaMiTrabajo = {
  id: string;
  origen: 'tarea' | 'pedido';
  titulo: string;
  estado: TareaInternaEstado | PedidoEstado;
  etiquetaCategoria: PedidoCategoria | null;
  etiquetas: string[];
  fechaProgramada: string | null;
  clienteId: string;
  clienteNombre: string;
};

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  materiales: { label: 'Materiales', color: 'bg-jab-panel-2 text-jab-muted' },
  pedido: { label: 'Pedido', color: 'bg-jab-accent/15 text-jab-accent' },
  en_proceso: { label: 'En proceso', color: 'bg-jab-amber/15 text-jab-amber' },
  revision: { label: 'Revisión', color: 'bg-jab-violet/15 text-jab-violet' },
  ads: { label: 'Ads', color: 'bg-jab-teal/15 text-jab-teal' },
  on_hold: { label: 'On hold', color: 'bg-jab-red/15 text-jab-red' },
  aprobado: { label: 'Aprobado', color: 'bg-jab-green/15 text-jab-green' },
};

type Filtro = 'todo' | 'vencidas' | 'hoy' | 'semana';
const FILTRO_LABEL: Record<Filtro, string> = { todo: 'Todo', vencidas: 'Vencidas', hoy: 'Hoy', semana: 'Esta semana' };

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Primer nombre para el saludo. Si no hay full_name cargado, page.tsx pasa
 * el email entero (no tiene espacios) -- se corta en el "@" en vez de
 * saludar con la dirección completa. */
function primerNombre(nombreOEmail: string): string {
  return nombreOEmail.split(' ')[0].split('@')[0];
}

function estaEnSemana(fecha: string | null): boolean {
  if (!fecha) return false;
  const hoyStr = new Date().toISOString().slice(0, 10);
  const en7Dias = new Date();
  en7Dias.setDate(en7Dias.getDate() + 7);
  return fecha >= hoyStr && fecha <= en7Dias.toISOString().slice(0, 10);
}

function Fila({
  t,
  pending,
  onCompletar,
  onAbrir,
}: {
  t: TarjetaMiTrabajo;
  pending: boolean;
  onCompletar: (t: TarjetaMiTrabajo) => void;
  onAbrir: (t: TarjetaMiTrabajo) => void;
}) {
  const vencimiento = nivelVencimiento(t.fechaProgramada);
  const info = ESTADO_INFO[t.estado] ?? { label: t.estado, color: 'bg-jab-panel-2 text-jab-muted' };
  const yaAprobado = t.estado === 'aprobado';
  return (
    <div className="flex items-center gap-3 rounded-lg bg-jab-panel border border-jab-border px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-jab-accent/20 text-[10px] font-semibold text-jab-accent">
        {iniciales(t.clienteNombre)}
      </span>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onAbrir(t)}>
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${info.color}`}>
            {info.label}
          </span>
          {t.etiquetaCategoria && (
            <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORIA_COLOR[t.etiquetaCategoria]}`}>
              {CATEGORIA_LABEL[t.etiquetaCategoria]}
            </span>
          )}
          <span className="text-xs text-jab-muted">{t.clienteNombre}</span>
        </div>
        <p className="text-sm font-medium truncate">{t.titulo}</p>
      </div>
      <p
        className={`text-xs shrink-0 whitespace-nowrap ${
          vencimiento === 'vencida' ? 'text-jab-red font-semibold' : vencimiento === 'hoy' ? 'text-jab-amber font-semibold' : 'text-jab-muted'
        }`}
      >
        {t.fechaProgramada ? fechaCortaSinHora(t.fechaProgramada) : 'Sin fecha'}
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        {!yaAprobado && (
          <button
            disabled={pending}
            onClick={() => onCompletar(t)}
            className="rounded-full border border-jab-border px-2.5 py-1 text-xs font-medium hover:border-jab-green hover:text-jab-green disabled:opacity-50"
          >
            Completar
          </button>
        )}
        <button
          onClick={() => onAbrir(t)}
          className="rounded-full bg-jab-panel-2 px-2.5 py-1 text-xs font-medium hover:text-jab-text"
        >
          Abrir
        </button>
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  items,
  tono,
  pending,
  onCompletar,
  onAbrir,
}: {
  titulo: string;
  items: TarjetaMiTrabajo[];
  tono?: string;
  pending: boolean;
  onCompletar: (t: TarjetaMiTrabajo) => void;
  onAbrir: (t: TarjetaMiTrabajo) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <p className={`text-[11px] font-semibold tracking-widest uppercase mb-2 ${tono ?? 'text-jab-muted'}`}>
        {titulo} · {items.length}
      </p>
      <div className="space-y-2">
        {items.map((t) => (
          <Fila key={`${t.origen}-${t.id}`} t={t} pending={pending} onCompletar={onCompletar} onAbrir={onAbrir} />
        ))}
      </div>
    </div>
  );
}

export function MiTrabajoLista({
  tarjetas,
  etiquetasDisponibles,
  nombreUsuario,
}: {
  tarjetas: TarjetaMiTrabajo[];
  etiquetasDisponibles: EtiquetaTablero[];
  nombreUsuario: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seleccion, setSeleccion] = useState<TarjetaMiTrabajo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [cliente, setCliente] = useState<string>('todos');
  const [filtro, setFiltro] = useState<Filtro>('todo');

  const clientes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const t of tarjetas) mapa.set(t.clienteId, t.clienteNombre);
    return Array.from(mapa.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tarjetas]);

  const filtradas = useMemo(() => {
    let out = tarjetas;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      out = out.filter((t) => t.titulo.toLowerCase().includes(q));
    }
    if (cliente !== 'todos') out = out.filter((t) => t.clienteId === cliente);
    if (filtro === 'vencidas') out = out.filter((t) => nivelVencimiento(t.fechaProgramada) === 'vencida');
    if (filtro === 'hoy') out = out.filter((t) => nivelVencimiento(t.fechaProgramada) === 'hoy');
    if (filtro === 'semana') out = out.filter((t) => estaEnSemana(t.fechaProgramada));
    return out;
  }, [tarjetas, busqueda, cliente, filtro]);

  const vencidas = filtradas.filter((t) => nivelVencimiento(t.fechaProgramada) === 'vencida');
  const hoy = filtradas.filter((t) => nivelVencimiento(t.fechaProgramada) === 'hoy');
  const proximas = filtradas.filter((t) => {
    const v = nivelVencimiento(t.fechaProgramada);
    return v === 'proxima' || v === null;
  });

  const totalVencidas = tarjetas.filter((t) => nivelVencimiento(t.fechaProgramada) === 'vencida').length;
  const totalSemana = tarjetas.filter((t) => estaEnSemana(t.fechaProgramada)).length;

  function completar(t: TarjetaMiTrabajo) {
    startTransition(async () => {
      if (t.origen === 'tarea') await cambiarEstadoTarea(t.id, 'aprobado');
      else await cambiarEstadoPedido(t.id, 'aprobado');
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {saludo()}, {primerNombre(nombreUsuario)}
        </h1>
        <p className="text-sm text-jab-muted">
          {totalVencidas > 0
            ? `Tenés ${totalVencidas} ${totalVencidas === 1 ? 'tarea vencida' : 'tareas vencidas'}${
                totalSemana > 0 ? ` y ${totalSemana} para esta semana.` : '.'
              }`
            : totalSemana > 0
              ? `Tenés ${totalSemana} ${totalSemana === 1 ? 'tarea' : 'tareas'} para esta semana.`
              : 'No tenés nada urgente por ahora. 🎉'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <select
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-sm outline-none focus:border-jab-accent"
        >
          <option value="todos">Todos los clientes</option>
          {clientes.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                filtro === f ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
              }`}
            >
              {FILTRO_LABEL[f]}
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar..."
          className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent w-40"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-jab-muted">No hay nada que coincida con estos filtros. 🎉</p>
      ) : (
        <>
          <Seccion titulo="Vencidas" items={vencidas} tono="text-jab-red" pending={pending} onCompletar={completar} onAbrir={setSeleccion} />
          <Seccion titulo="Para hoy" items={hoy} tono="text-jab-amber" pending={pending} onCompletar={completar} onAbrir={setSeleccion} />
          <Seccion titulo="Próximas" items={proximas} pending={pending} onCompletar={completar} onAbrir={setSeleccion} />
        </>
      )}

      {seleccion &&
        (seleccion.origen === 'pedido' ? (
          <PedidoDetailPanel key={seleccion.id} pedidoId={seleccion.id} esEquipoJab onClose={() => setSeleccion(null)} />
        ) : (
          <TareaDetailPanel
            key={seleccion.id}
            tareaId={seleccion.id}
            etiquetasDisponibles={etiquetasDisponibles}
            onClose={() => setSeleccion(null)}
          />
        ))}
    </>
  );
}
