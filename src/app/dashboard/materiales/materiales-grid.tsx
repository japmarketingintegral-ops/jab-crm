'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { subirMateriales, eliminarMaterial, obtenerUrlMaterial } from './actions';
import { esImagen, fechaCortaSinHora } from '@/lib/format';

export type Material = {
  id: string;
  nombre: string;
  subidoPorNombre: string | null;
  creadoEn: string;
};

function MaterialCard({ material, esAdmin }: { material: Material; esAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const esImg = esImagen(material.nombre);

  useEffect(() => {
    if (!esImg) return;
    let cancelado = false;
    obtenerUrlMaterial(material.id).then((res) => {
      if (!cancelado && 'url' in res) setImagenUrl(res.url);
    });
    return () => {
      cancelado = true;
    };
  }, [esImg, material.id]);

  async function descargar() {
    const res = await obtenerUrlMaterial(material.id);
    if ('url' in res) window.open(res.url, '_blank', 'noopener');
  }

  function eliminar() {
    if (!confirm(`¿Eliminar "${material.nombre}"?`)) return;
    startTransition(async () => {
      await eliminarMaterial(material.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-jab-panel border border-jab-border overflow-hidden">
      <button onClick={descargar} className="block w-full h-28 bg-jab-panel-2">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl text-jab-muted">📄</div>
        )}
      </button>
      <div className="p-3">
        <p className="text-sm font-medium truncate" title={material.nombre}>
          {material.nombre}
        </p>
        <p className="text-[11px] text-jab-muted mt-0.5">
          {material.subidoPorNombre ?? 'Alguien del equipo'} · {fechaCortaSinHora(material.creadoEn.slice(0, 10))}
        </p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={descargar}
            className="flex-1 rounded-full border border-jab-border py-1 text-xs font-medium hover:text-jab-text"
          >
            Descargar
          </button>
          {esAdmin && (
            <button
              onClick={eliminar}
              disabled={pending}
              className="rounded-full border border-jab-border px-2.5 py-1 text-xs font-medium text-jab-red disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaterialesGrid({ materiales, esAdmin }: { materiales: Material[]; esAdmin: boolean }) {
  const router = useRouter();
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await subirMateriales(_prev, fd);
    if (res === undefined) router.refresh();
    return res;
  }, undefined);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {esAdmin && (
        <form action={formAction} className="mb-6 flex flex-wrap items-center gap-3">
          <input
            name="archivos"
            type="file"
            multiple
            className="text-xs text-jab-muted file:mr-2 file:rounded-full file:border-0 file:bg-jab-panel-2 file:px-3 file:py-1.5 file:text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
          >
            {pending ? 'Subiendo…' : 'Subir'}
          </button>
          {error && <p className="text-sm text-jab-red w-full">{error}</p>}
        </form>
      )}

      {materiales.length === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
          <p className="text-sm text-jab-muted">
            Todavía no hay materiales.{esAdmin ? ' Subí el primer logo o guía de marca.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
          {materiales.map((m) => (
            <MaterialCard key={m.id} material={m} esAdmin={esAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
