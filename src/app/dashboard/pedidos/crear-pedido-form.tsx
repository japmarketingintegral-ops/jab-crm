'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearPedido } from './actions';
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedido-detail-panel';
import { esImagen } from '@/lib/format';
import type { PedidoCategoria } from '@/lib/supabase/types';

const CATEGORIAS = Object.entries(CATEGORIA_LABEL) as [PedidoCategoria, string][];

export function CrearPedidoForm() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState<PedidoCategoria>('otro');
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const portadaInputRef = useRef<HTMLInputElement>(null);

  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    fd.delete('archivos');
    for (const f of archivos) fd.append('archivos', f);
    const res = await crearPedido(_prev, fd);
    if (res === undefined) {
      cerrar();
      router.refresh();
    }
    return res;
  }, undefined);

  const portada = useMemo(() => archivos.find((f) => esImagen(f.name)) ?? null, [archivos]);
  const portadaUrl = useMemo(() => (portada ? URL.createObjectURL(portada) : null), [portada]);

  function cerrar() {
    setAbierto(false);
    setArchivos([]);
    setCategoria('otro');
    setMostrarEtiquetas(false);
    setMostrarFecha(false);
  }

  function agregarArchivos(lista: FileList | null, comoPortada = false) {
    if (!lista?.length) return;
    const nuevos = Array.from(lista);
    setArchivos((prev) => (comoPortada ? [...nuevos, ...prev] : [...prev, ...nuevos]));
  }

  function quitarArchivo(idx: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-sm rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 font-bold uppercase tracking-wide"
      >
        + Pedido
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 py-10">
      <button aria-label="Cerrar" onClick={cerrar} className="fixed inset-0 bg-black/60" />
      <form
        action={formAction}
        className="relative z-10 w-full max-w-2xl bg-jab-panel border border-jab-border rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Portada */}
        <div className="relative h-40 bg-jab-panel-2">
          {portadaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portadaUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => portadaInputRef.current?.click()}
              className="h-full w-full flex flex-col items-center justify-center gap-1 text-jab-muted hover:text-jab-text"
            >
              <span className="text-2xl">🖼️</span>
              <span className="text-xs font-medium">Agregar portada</span>
            </button>
          )}
          <input
            ref={portadaInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              agregarArchivos(e.target.files, true);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Etiqueta como chip de color */}
          <span
            className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${CATEGORIA_COLOR[categoria]}`}
          >
            {CATEGORIA_LABEL[categoria]}
          </span>

          {/* Título grande */}
          <textarea
            name="titulo"
            required
            rows={1}
            placeholder="Título del pedido"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            className="w-full resize-none rounded-lg bg-transparent border-0 px-0 text-xl font-bold outline-none placeholder:text-jab-muted focus:ring-0"
          />

          {/* Acciones rápidas */}
          <div className="flex flex-wrap gap-2">
            <QuickButton icono="🏷️" etiqueta="Etiqueta" onClick={() => setMostrarEtiquetas((v) => !v)} />
            <QuickButton icono="📅" etiqueta="Fecha" onClick={() => setMostrarFecha((v) => !v)} />
            <QuickButton icono="📎" etiqueta="Adjuntar" onClick={() => fileInputRef.current?.click()} />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                agregarArchivos(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {mostrarEtiquetas && (
            <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-3">
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Elegí una etiqueta
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS.map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => {
                      setCategoria(valor);
                      setMostrarEtiquetas(false);
                    }}
                    className={`rounded px-3 py-1 text-xs font-bold uppercase ${CATEGORIA_COLOR[valor]} ${
                      categoria === valor ? 'ring-2 ring-jab-accent' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input type="hidden" name="categoria" value={categoria} />

          {mostrarFecha && (
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Fecha programada
              </p>
              <input
                type="date"
                name="fecha_programada"
                className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
              />
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
              Descripción
            </p>
            <textarea
              name="descripcion"
              rows={3}
              placeholder="Contá qué necesitás: fecha límite, referencias, texto sugerido..."
              className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
            />
          </div>

          {archivos.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
                Adjuntos ({archivos.length})
              </p>
              <ul className="space-y-1.5">
                {archivos.map((a, i) => (
                  <li
                    key={`${a.name}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-sm"
                  >
                    <span className="truncate">
                      {esImagen(a.name) ? '🖼️' : '📎'} {a.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarArchivo(i)}
                      className="text-jab-muted hover:text-jab-red text-xs shrink-0 ml-2"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-jab-red">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-jab-border p-4">
          <button
            type="button"
            onClick={cerrar}
            className="flex-1 rounded-full border border-jab-border py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-jab-lime text-jab-lime-ink py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? 'Pidiendo…' : 'Crear pedido'}
          </button>
        </div>
      </form>
    </div>
  );
}

function QuickButton({ icono, etiqueta, onClick }: { icono: string; etiqueta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent"
    >
      <span>{icono}</span>
      {etiqueta}
    </button>
  );
}
