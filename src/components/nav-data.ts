export type Seccion =
  | 'trabajo'
  | 'brief'
  | 'equipo'
  | 'configuracion'
  | 'redes'
  | 'pauta'
  | 'pedidos'
  | 'materiales'
  | 'tablero'
  | 'mi-trabajo';

export const NAV_CUENTA: { seccion: Seccion; etiqueta: string; href: string }[] = [
  { seccion: 'trabajo', etiqueta: 'Inicio', href: '/dashboard' },
  { seccion: 'brief', etiqueta: 'Brief', href: '/dashboard/brief' },
  { seccion: 'pedidos', etiqueta: 'Pedidos', href: '/dashboard/pedidos' },
  { seccion: 'materiales', etiqueta: 'Materiales', href: '/dashboard/materiales' },
  { seccion: 'equipo', etiqueta: 'Equipo', href: '/dashboard/equipo' },
  { seccion: 'configuracion', etiqueta: 'Configuración', href: '/dashboard/configuracion' },
];

/** "Resultados" agrupa las fuentes de reporte del cliente (redes, pauta y,
 * a futuro, web/analítica) bajo un mismo rótulo — ver sección 4 del pivot. */
export const NAV_RESULTADOS: { seccion: Seccion; etiqueta: string; href: string }[] = [
  { seccion: 'redes', etiqueta: 'Redes y contenido', href: '/dashboard/redes' },
  { seccion: 'pauta', etiqueta: 'Pauta', href: '/dashboard/pauta' },
];

export type SidebarProps = {
  tenantNombre: string;
  nombreUsuario: string;
  rolLabel: string;
  seccion: Seccion;
  viendoComoJab?: boolean;
  mostrarTablero?: boolean;
  puedeConfigurar?: boolean;
};
