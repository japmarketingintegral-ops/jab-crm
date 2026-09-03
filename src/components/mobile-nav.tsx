'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { iniciales } from '@/lib/format';
import { CerrarSesionButton } from './cerrar-sesion-button';
import { salirDeCliente } from '@/app/admin/actions';
import { NAV_CUENTA, NAV_RESULTADOS, type SidebarProps } from './nav-data';

function IconoInicio({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activo ? 2.5 : 2} className="h-5 w-5">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoResultados({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activo ? 2.5 : 2} className="h-5 w-5">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoPedidos({ activo }: { activo: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activo ? 2.5 : 2} className="h-5 w-5">
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 9h6M9 13h6M9 17h3" strokeLinecap="round" />
    </svg>
  );
}

function IconoMenu({ abierto }: { abierto: boolean }) {
  if (abierto) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function TabLink({
  href,
  activo,
  etiqueta,
  icono,
  onClick,
}: {
  href: string;
  activo: boolean;
  etiqueta: string;
  icono: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${
        activo ? 'text-jab-accent' : 'text-jab-muted'
      }`}
    >
      {icono}
      <span className="text-[10px] font-medium">{etiqueta}</span>
    </Link>
  );
}

export function MobileNav({
  tenantNombre,
  nombreUsuario,
  rolLabel,
  seccion,
  viendoComoJab,
  mostrarTablero,
  puedeConfigurar = true,
}: SidebarProps) {
  const [abierto, setAbierto] = useState(false);

  const navCuenta = puedeConfigurar
    ? NAV_CUENTA
    : NAV_CUENTA.filter((item) => item.seccion !== 'configuracion');
  const enResultados = seccion === 'redes' || seccion === 'pauta';
  const cerrar = () => setAbierto(false);

  return (
    <>
      <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 bg-jab-bg-deep border-b border-jab-border">
        <Image src="/brand/isologo-horizontal-blanco.svg" alt="Jab" width={64} height={16} />
        <div className="flex items-center gap-2 min-w-0">
          {viendoComoJab && (
            <span className="text-[10px] font-medium text-jab-amber bg-jab-amber/10 rounded-full px-2 py-1 shrink-0">
              Viendo como JAB
            </span>
          )}
          <span className="text-xs text-jab-muted truncate max-w-[9rem]">{tenantNombre}</span>
        </div>
      </header>

      {abierto && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <button
            className="flex-1 bg-black/50"
            aria-label="Cerrar menú"
            onClick={cerrar}
          />
          <div className="w-72 max-w-[85vw] h-full bg-jab-bg-deep border-l border-jab-border overflow-y-auto flex flex-col">
            <div className="p-4 flex items-center justify-between border-b border-jab-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-jab-panel-2 text-xs font-semibold">
                  {iniciales(tenantNombre)}
                </span>
                <span className="text-sm font-medium truncate">{tenantNombre}</span>
              </div>
              <button onClick={cerrar} aria-label="Cerrar menú" className="text-jab-muted p-1">
                <IconoMenu abierto />
              </button>
            </div>

            {viendoComoJab && (
              <div className="px-4 py-2 bg-jab-amber/10 border-b border-jab-border flex items-center justify-between gap-2">
                <p className="text-[11px] text-jab-amber font-medium">Viendo como JAB</p>
                <form action={salirDeCliente}>
                  <button type="submit" className="text-[11px] text-jab-amber underline">
                    Volver a admin
                  </button>
                </form>
              </div>
            )}

            <nav className="flex-1 px-3 py-4 space-y-6">
              <div>
                <p className="px-2 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
                  Cuenta
                </p>
                <ul className="space-y-0.5">
                  {navCuenta.map((item) => (
                    <li key={item.seccion}>
                      <Link
                        href={item.href}
                        onClick={cerrar}
                        className={`block rounded-md px-2 py-2 text-sm ${
                          seccion === item.seccion
                            ? 'bg-jab-panel-2 text-jab-text'
                            : 'text-jab-muted hover:text-jab-text'
                        }`}
                      >
                        {item.etiqueta}
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="px-2 mt-4 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
                  Resultados
                </p>
                <ul className="space-y-0.5">
                  {NAV_RESULTADOS.map((item) => (
                    <li key={item.seccion}>
                      <Link
                        href={item.href}
                        onClick={cerrar}
                        className={`block rounded-md px-2 py-2 text-sm ${
                          seccion === item.seccion
                            ? 'bg-jab-panel-2 text-jab-text'
                            : 'text-jab-muted hover:text-jab-text'
                        }`}
                      >
                        {item.etiqueta}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {mostrarTablero && (
                <div className="-mx-3 px-3 pt-4 pb-1 bg-jab-amber/[0.06] border-t border-jab-border">
                  <p className="px-2 mb-2 text-[11px] font-semibold tracking-widest text-jab-amber/80 uppercase">
                    Interno · equipo JAB
                  </p>
                  <ul className="space-y-0.5">
                    <li>
                      <Link
                        href="/dashboard/tablero"
                        onClick={cerrar}
                        className={`block rounded-md px-2 py-2 text-sm ${
                          seccion === 'tablero'
                            ? 'bg-jab-amber/15 text-jab-amber'
                            : 'text-jab-muted hover:text-jab-text'
                        }`}
                      >
                        Tablero
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/mi-trabajo"
                        onClick={cerrar}
                        className={`block rounded-md px-2 py-2 text-sm ${
                          seccion === 'mi-trabajo'
                            ? 'bg-jab-amber/15 text-jab-amber'
                            : 'text-jab-muted hover:text-jab-text'
                        }`}
                      >
                        Mi trabajo
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </nav>

            <div className="p-4 border-t border-jab-border flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-xs font-semibold text-jab-accent">
                  {iniciales(nombreUsuario)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm truncate">{nombreUsuario}</p>
                  <p className="text-xs text-jab-muted truncate">{rolLabel}</p>
                </div>
              </div>
              <CerrarSesionButton />
            </div>
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch bg-jab-bg-deep border-t border-jab-border pb-[env(safe-area-inset-bottom)]">
        <TabLink
          href="/dashboard"
          activo={seccion === 'trabajo'}
          etiqueta="Inicio"
          icono={<IconoInicio activo={seccion === 'trabajo'} />}
          onClick={cerrar}
        />
        <TabLink
          href="/dashboard/redes"
          activo={enResultados}
          etiqueta="Resultados"
          icono={<IconoResultados activo={enResultados} />}
          onClick={cerrar}
        />
        <TabLink
          href="/dashboard/pedidos"
          activo={seccion === 'pedidos'}
          etiqueta="Pedidos"
          icono={<IconoPedidos activo={seccion === 'pedidos'} />}
          onClick={cerrar}
        />
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${
            abierto ? 'text-jab-accent' : 'text-jab-muted'
          }`}
        >
          <IconoMenu abierto={false} />
          <span className="text-[10px] font-medium">Menú</span>
        </button>
      </nav>
    </>
  );
}
