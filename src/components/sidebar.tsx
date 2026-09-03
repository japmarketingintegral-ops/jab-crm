import Link from 'next/link';
import Image from 'next/image';
import { iniciales } from '@/lib/format';
import { CerrarSesionButton } from './cerrar-sesion-button';
import { salirDeCliente } from '@/app/admin/actions';
import { MobileNav } from './mobile-nav';
import { NAV_CUENTA, NAV_RESULTADOS, type SidebarProps } from './nav-data';

export function Sidebar(props: SidebarProps) {
  const { tenantNombre, nombreUsuario, rolLabel, seccion, viendoComoJab, mostrarTablero, puedeConfigurar = true } =
    props;
  const navCuenta = puedeConfigurar
    ? NAV_CUENTA
    : NAV_CUENTA.filter((item) => item.seccion !== 'configuracion');

  return (
    <>
      <MobileNav {...props} />
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-jab-bg-deep border-r border-jab-border">
        <div className="p-5">
          <Image src="/brand/isologo-horizontal-blanco.svg" alt="Jab" width={80} height={20} />
        </div>

        {viendoComoJab && (
          <div className="px-5 py-2 bg-jab-amber/10 border-b border-jab-border flex items-center justify-between gap-2">
            <p className="text-[11px] text-jab-amber font-medium">Viendo como JAB</p>
            <form action={salirDeCliente}>
              <button type="submit" className="text-[11px] text-jab-amber underline hover:no-underline">
                Volver a admin
              </button>
            </form>
          </div>
        )}

        <div className="px-5 pb-5 border-b border-jab-border">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-jab-panel-2 text-xs font-semibold">
              {iniciales(tenantNombre)}
            </span>
            <span className="text-sm font-medium truncate">{tenantNombre}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <div>
            <p className="px-2 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
              Cuenta
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={NAV_CUENTA[0].href}
                  className={`block rounded-md px-2 py-1.5 text-sm ${
                    seccion === NAV_CUENTA[0].seccion
                      ? 'bg-jab-panel-2 text-jab-text'
                      : 'text-jab-muted hover:text-jab-text'
                  }`}
                >
                  {NAV_CUENTA[0].etiqueta}
                </Link>
              </li>
              <li>
                <Link
                  href={NAV_CUENTA[1].href}
                  className={`block rounded-md px-2 py-1.5 text-sm ${
                    seccion === NAV_CUENTA[1].seccion
                      ? 'bg-jab-panel-2 text-jab-text'
                      : 'text-jab-muted hover:text-jab-text'
                  }`}
                >
                  {NAV_CUENTA[1].etiqueta}
                </Link>
              </li>
            </ul>

            <p className="px-2 mt-4 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
              Resultados
            </p>
            <ul className="space-y-0.5">
              {NAV_RESULTADOS.map((item) => (
                <li key={item.seccion}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-2 py-1.5 text-sm ${
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

            <ul className="space-y-0.5 mt-4">
              {navCuenta.slice(2).map((item) => (
                <li key={item.seccion}>
                  <Link
                    href={item.href}
                    className={`block rounded-md px-2 py-1.5 text-sm ${
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
                    className={`block rounded-md px-2 py-1.5 text-sm ${
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
                    className={`block rounded-md px-2 py-1.5 text-sm ${
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
      </aside>
    </>
  );
}
