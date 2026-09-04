'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { subirMateriales, eliminarMaterial, obtenerUrlMaterial } from './actions';
import { esImagen, fechaCortaSinHora } from '@/lib/format';

export type Material = {
  id: string;
  nombre: string;
  subidoPorNombre: string | null;
  creadoEn: string;
};

type Orden = 'reciente' | 'nombre';

function extension(nombre: string): string {
  const partes = nombre.split('.');
  return partes.length > 1 ? partes[partes.length - 1].toUpperCase() : 'ARCHIVO';
}

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
      <button onClick={descargar} className="block w-full h-28 bg-jab-panel-2 relative">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1">
            <span className="text-2xl text-jab-muted">📄</span>
            <span className="text-[10px] font-bold tracking-widest text-jab-muted uppercase">
              {extension(material.nombre)}
            </span>
          </div>
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

function ZonaDeCarga({ formAction, pending }: { formAction: (fd: FormData) => void; pending: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  function enviarArchivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('archivos', f);
    formAction(fd);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        enviarArchivos(e.dataTransfer.files);
      }}
      className={`mb-6 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        arrastrando ? 'border-jab-accent bg-jab-accent/5' : 'border-jab-border'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => enviarArchivos(e.target.files)}
      />
      <p className="text-sm font-medium mb-1">Arrastrá archivos acá</p>
      <p className="text-xs text-jab-muted mb-3">o elegilos desde tu computadora</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? 'Subiendo…' : 'Elegir archivos'}
      </button>
    </div>
  );
}

export function MaterialesGrid({ materiales, esAdmin }: { materiales: Material[]; esAdmin: boolean }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<Orden>('reciente');
  const [error, formAction, pending] = useActionState(async (_prev: string | undefined, fd: FormData) => {
    const res = await subirMateriales(_prev, fd);
    if (res === undefined) router.refresh();
    return res;
  }, undefined);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const lista = texto ? materiales.filter((m) => m.nombre.toLowerCase().includes(texto)) : materiales;
    return [...lista].sort((a, b) =>
      orden === 'nombre' ? a.nombre.localeCompare(b.nombre) : b.creadoEn.localeCompare(a.creadoEn),
    );
  }, [materiales, busqueda, orden]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {esAdmin && <ZonaDeCarga formAction={(fd) => formAction(fd)} pending={pending} />}
      {error && <p className="text-sm text-jab-red mb-4">{error}</p>}

      {materiales.length === 0 ? (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-10 text-center">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="text-sm font-medium mb-1">Centralizá acá logos, guías y materiales importantes</p>
          <p className="text-sm text-jab-muted">
            {esAdmin
              ? 'Arrastrá el primer archivo arriba, o usá "Elegir archivos".'
              : 'JAB puede cargarlos cuando haga falta gestionar una plataforma.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre..."
              className="rounded-lg bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-sm outline-none placeholder:text-jab-muted focus:border-jab-accent"
            />
            <div className="flex items-center gap-1 text-xs ml-auto">
              <span className="text-jab-muted">Ordenar</span>
              {(['reciente', 'nombre'] as Orden[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrden(o)}
                  className={`rounded-full px-2.5 py-1 font-medium ${
                    orden === o ? 'bg-jab-accent text-jab-bg-deep' : 'bg-jab-panel-2 text-jab-muted hover:text-jab-text'
                  }`}
                >
                  {o === 'reciente' ? 'Más reciente' : 'Nombre'}
                </button>
              ))}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <p className="text-sm text-jab-muted">No hay materiales que coincidan con &quot;{busqueda}&quot;.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
              {filtrados.map((m) => (
                <MaterialCard key={m.id} material={m} esAdmin={esAdmin} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
