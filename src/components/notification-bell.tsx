'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { obtenerNotificaciones, type Notificacion } from '@/app/dashboard/notificaciones-actions';

const PUNTO_NIVEL: Record<Notificacion['nivel'], string> = {
  rojo: 'bg-jab-red',
  ambar: 'bg-jab-amber',
  info: 'bg-jab-accent',
};

export function NotificationBell() {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Notificacion[]>([]);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      const res = await obtenerNotificaciones();
      if (vivo) setItems(res);
    }
    cargar();
    const intervalo = setInterval(cargar, 60_000);
    return () => {
      vivo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => {
    function fueraDeClick(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener('mousedown', fueraDeClick);
    return () => document.removeEventListener('mousedown', fueraDeClick);
  }, []);

  return (
    <div className="relative" ref={contenedorRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-jab-muted hover:text-jab-text hover:bg-jab-panel-2"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-jab-red px-1 text-[10px] font-bold text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute left-0 z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg bg-jab-panel border border-jab-border shadow-xl">
          <p className="px-4 py-3 text-xs font-semibold tracking-widest text-jab-muted uppercase border-b border-jab-border">
            Notificaciones
          </p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-jab-muted text-center">Estás al día. No hay novedades.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-jab-border last:border-0">
                  <Link
                    href={n.href}
                    onClick={() => setAbierto(false)}
                    className="flex items-start gap-2 px-4 py-3 text-sm hover:bg-jab-panel-2"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO_NIVEL[n.nivel]}`} />
                    <span>{n.texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
