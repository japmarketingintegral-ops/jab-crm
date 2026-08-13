'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { agregarPost } from './actions';

const PLATAFORMAS = [
  { valor: 'instagram', etiqueta: 'Instagram' },
  { valor: 'facebook', etiqueta: 'Facebook' },
  { valor: 'tiktok', etiqueta: 'TikTok' },
  { valor: 'otra', etiqueta: 'Otra' },
];

export function AgregarPostForm() {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await agregarPost(_prev, fd);
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
        + Publicación
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button aria-label="Cerrar" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/50" />
      <form
        action={formAction}
        className="relative z-10 w-full max-w-md bg-jab-panel border border-jab-border rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-bold">Cargar publicación</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Red</label>
            <select
              name="plataforma"
              defaultValue="instagram"
              className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
            >
              {PLATAFORMAS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Fecha</label>
            <input
              type="date"
              name="publicado_en"
              required
              className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Título</label>
          <input
            name="titulo"
            placeholder="Ej: Promo de verano"
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Link del posteo</label>
          <input
            name="url"
            type="url"
            placeholder="https://instagram.com/p/..."
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">Imagen (URL)</label>
          <input
            name="imagen_url"
            type="url"
            placeholder="https://..."
            className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CampoNumero nombre="alcance" etiqueta="Alcance" />
          <CampoNumero nombre="me_gusta" etiqueta="Me gusta" />
          <CampoNumero nombre="comentarios" etiqueta="Comentarios" />
          <CampoNumero nombre="compartidos" etiqueta="Compartidos" />
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
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CampoNumero({ nombre, etiqueta }: { nombre: string; etiqueta: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold tracking-widest text-jab-muted uppercase">{etiqueta}</label>
      <input
        name={nombre}
        type="number"
        min={0}
        defaultValue={0}
        className="w-full rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-2 text-sm outline-none focus:border-jab-accent"
      />
    </div>
  );
}
