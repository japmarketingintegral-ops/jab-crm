'use client';

import { obtenerUrlMaterial } from './materiales/actions';

export function MaterialDescargaButton({ ruta, children }: { ruta: string; children: React.ReactNode }) {
  async function descargar() {
    const res = await obtenerUrlMaterial(ruta);
    if ('url' in res) window.open(res.url, '_blank', 'noopener');
  }

  return (
    <button onClick={descargar} className="contents text-left">
      {children}
    </button>
  );
}
