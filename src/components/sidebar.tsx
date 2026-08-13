import Link from 'next/link';
import Image from 'next/image';
import { iniciales } from '@/lib/format';
import { CerrarSesionButton } from './cerrar-sesion-button';
import { NotificationBell } from './notification-bell';
import { salirDeCliente } from '@/app/admin/actions';

type Vista = 'inicio' | 'bandeja' | 'mios' | 'vencidos' | 'pipeline' | 'archivo';
type Seccion =
  | 'trabajo'
  | 'reportes'
  | 'equipo'
  | 'configuracion'
  | 'mi-panel'
  | 'redes'
  | 'pedidos'
  | 'materiales'
  | 'tablero';

const NAV_TRABAJO: { vista: Vista; etiqueta: string }[] = [
  { vista: 'inicio', etiqueta: 'Inicio' },
  { vista: 'bandeja', etiqueta: 'Bandeja' },
  { vista: 'mios', etiqueta: 'Míos' },
  { vista: 'vencidos', etiqueta: 'Vencidos' },
  { vista: 'pipeline', etiqueta: 'Pipeline' },
  { vista: 'archivo', etiqueta: 'Archivo' },
];

const NAV_CUENTA: { seccion: Seccion; etiqueta: string; href: string }[] = [
  { seccion: 'reportes', etiqueta: 'Reportes', href: '/dashboard/reportes' },
  { seccion: 'redes', etiqueta: 'Redes', href: '/dashboard/redes' },
  { seccion: 'pedidos', etiqueta: 'Pedidos', href: '/dashboard/pedidos' },
  { seccion: 'materiales', etiqueta: 'Materiales', href: '/dashboard/materiales' },
  { seccion: 'equipo', etiqueta: 'Equipo', href: '/dashboard/equipo' },
  { seccion: 'configuracion', etiqueta: 'Configuración', href: '/dashboard/configuracion' },
];

export function Sidebar({
  tenantNombre,
  nombreUsuario,
  rolLabel,
  seccion,
  vistaActiva,
  conteos,
  esVendedor,
  viendoComoJab,
  mostrarTablero,
}: {
  tenantNombre: string;
  nombreUsuario: string;
  rolLabel: string;
  seccion: Seccion;
  vistaActiva?: Vista;
  conteos?: Record<Vista, number>;
  esVendedor?: boolean;
  viendoComoJab?: boolean;
  mostrarTablero?: boolean;
}) {
  return (
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-jab-panel-2 text-xs font-semibold">
              {iniciales(tenantNombre)}
            </span>
            <span className="text-sm font-medium truncate">{tenantNombre}</span>
          </div>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-2 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
            CRM
          </p>
          <ul className="space-y-0.5">
            {esVendedor && (
              <li>
                <Link
                  href="/dashboard/mi-panel"
                  className={`block rounded-md px-2 py-1.5 text-sm ${
                    seccion === 'mi-panel' ? 'bg-jab-panel-2 text-jab-text' : 'text-jab-muted hover:text-jab-text'
                  }`}
                >
                  Mi panel
                </Link>
              </li>
            )}
            {NAV_TRABAJO.map((item) => (
              <li key={item.vista}>
                <Link
                  href={`/dashboard?vista=${item.vista}`}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${
                    seccion === 'trabajo' && vistaActiva === item.vista
                      ? 'bg-jab-panel-2 text-jab-text'
                      : 'text-jab-muted hover:text-jab-text'
                  }`}
                >
                  {item.etiqueta}
                  {conteos && item.vista !== 'inicio' && (
                    <span className="text-xs text-jab-muted">{conteos[item.vista]}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="px-2 mb-2 text-[11px] font-semibold tracking-widest text-jab-muted uppercase">
            Cuentas
          </p>
          <ul className="space-y-0.5">
            {NAV_CUENTA.map((item) => (
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
  );
}
