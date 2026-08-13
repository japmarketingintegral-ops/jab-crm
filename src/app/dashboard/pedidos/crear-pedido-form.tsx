'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearPedido } from './actions';
import { CATEGORIA_LABEL } from './pedido-detail-panel';

const CATEGORIAS = Object.entries(CATEGORIA_LABEL) as [keyof typeof CATEGORIA_LABEL, string][];

export function CrearPedidoForm() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await crearPedido(_prev, fd);
    if (res === undefined) {
      setAbierto(false);
      router.refresh();
    }
    return res;
  }, undefined);

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
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button aria-label="Cerrar" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/50" />
      <form
        action={formAction}
        className="relative z-10 w-full max-w-sm bg-jab-panel border border-jab-border rounded-lg p-6 space-y-4"
      >
        <h2 className="text-lg font-bold">Nuevo pedido</h2>

        <div className="space-y-1">
          <label htmlFor="titulo" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            required
            placeholder="Ej: Posteo para el 15% off de aniversario"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="categoria" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue="otro"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
          >
            {CATEGORIAS.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="descripcion"
            className="text-xs font-semibold tracking-widest text-jab-muted uppercase"
          >
            Detalle (opcional)
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            placeholder="Contá qué necesitás: fecha límite, referencias, texto sugerido..."
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="archivos" className="text-xs font-semibold tracking-widest text-jab-muted uppercase">
            Archivos (opcional)
          </label>
          <input
            id="archivos"
            name="archivos"
            type="file"
            multiple
            className="w-full text-xs text-jab-muted file:mr-2 file:rounded-full file:border-0 file:bg-jab-panel-2 file:px-3 file:py-1.5 file:text-xs"
          />
        </div>

        {error && <p className="text-sm text-jab-red">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="flex-1 rounded-full border border-jab-border py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-jab-lime text-jab-lime-ink py-2 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? 'Pidiendo…' : 'Pedir'}
          </button>
        </div>
      </form>
    </div>
  );
}
