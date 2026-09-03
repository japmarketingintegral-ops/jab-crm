'use client';

import { obtenerUrlMaterial } from './materiales/actions';

export function MaterialDescargaButton({ materialId, children }: { materialId: string; children: React.ReactNode }) {
  async function descargar() {
    const res = await obtenerUrlMaterial(materialId);
    if ('url' in res) window.open(res.url, '_blank', 'noopener');
  }

  return (
    <button onClick={descargar} className="contents text-left">
      {children}
    </button>
  );
}
