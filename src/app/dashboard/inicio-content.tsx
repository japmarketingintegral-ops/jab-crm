import Link from 'next/link';
import { KpiCard } from './reportes/kpi-card';
import { PeriodoSelector } from './periodo-selector';
import { CATEGORIA_LABEL, CATEGORIA_COLOR } from './pedidos/pedido-detail-panel';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';
import { fechaCortaSinHora, esImagen } from '@/lib/format';
import { variacion, type Periodo } from '@/lib/periodo';
import { MaterialDescargaButton } from './material-descarga-button';
import { FrescuraDatos } from '@/components/frescura-datos';
import type { PedidoEstado, PedidoCategoria, SocialPlatform } from '@/lib/supabase/types';

export type PedidoResumen = {
  id: string;
  titulo: string;
  estado: PedidoEstado;
  categoria: PedidoCategoria;
  actualizadoEn: string;
};

export type PostResumen = {
  titulo: string | null;
  plataforma: SocialPlatform;
  imagenUrl: string | null;
  url: string | null;
  alcance: number;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  publicadoEn: string;
};

export type PautaResumen = {
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
};

export type CampanaResumen = {
  nombre: string;
  gasto: number;
  conversiones: number;
};

export type SaludFuente = {
  nombre: string;
  conectado: boolean;
  ultimaActualizacion: string | null;
  alerta: string | null;
  /** Hora UTC del cron diario que sincroniza esta fuente (ver vercel.json). */
  horaCronUtc: number;
};

export type MaterialResumen = {
  id: string;
  nombre: string;
  creadoEn: string;
};

const ESTADO_PEDIDO_LABEL: Record<PedidoEstado, string> = {
  pedido: 'Recibido',
  en_preparacion: 'En preparación',
  en_proceso: 'En proceso',
  revision: 'Esperando tu revisión',
  aprobado: 'Aprobado / finalizado',
  pausado: 'Pausado',
};

function PublicacionMini({ post, titulo }: { post: PostResumen; titulo: string }) {
  return (
    <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 flex gap-4">
      {post.imagenUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imagenUrl} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-1">{titulo}</p>
        <div className="flex items-center gap-2 mb-1">
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[post.plataforma]}`}>
            {PLATAFORMA_LABEL[post.plataforma]}
          </span>
          <span className="text-xs text-jab-muted">{fechaCortaSinHora(post.publicadoEn)}</span>
        </div>
        <p className="font-medium truncate">{post.titulo ?? 'Sin título'}</p>
        <p className="text-sm text-jab-muted mt-1">
          {interaccionesPost({ me_gusta: post.meGusta, comentarios: post.comentarios, compartidos: post.compartidos }).toLocaleString(
            'es-AR',
          )}{' '}
          interacciones · {post.alcance.toLocaleString('es-AR')} de alcance
        </p>
      </div>
    </div>
  );
}

export function InicioContent({
  periodo,
  pedidosPendientes,
  pedidosEnRevision,
  proximasFechas,
  pedidosRecientes,
  totalPublicaciones,
  totalPublicacionesAnterior,
  alcanceTotal,
  alcanceAnterior,
  interaccionesTotal,
  interaccionesAnterior,
  mejorPost,
  contenidoBajoRendimiento,
  pautaResumen,
  pautaGastoAnterior,
  mejorCampana,
  campanaOportunidad,
  salud,
  materiales,
}: {
  periodo: Periodo;
  pedidosPendientes: number;
  pedidosEnRevision: number;
  proximasFechas: { id: string; titulo: string; fecha: string }[];
  pedidosRecientes: PedidoResumen[];
  totalPublicaciones: number;
  totalPublicacionesAnterior: number;
  alcanceTotal: number;
  alcanceAnterior: number;
  interaccionesTotal: number;
  interaccionesAnterior: number;
  mejorPost: PostResumen | null;
  contenidoBajoRendimiento: PostResumen | null;
  pautaResumen: PautaResumen | null;
  pautaGastoAnterior: number | null;
  mejorCampana: CampanaResumen | null;
  campanaOportunidad: CampanaResumen | null;
  salud: SaludFuente[];
  materiales: MaterialResumen[];
}) {
  const variacionPublicaciones = variacion(totalPublicaciones, totalPublicacionesAnterior);
  const variacionAlcance = variacion(alcanceTotal, alcanceAnterior);
  const variacionInteracciones = variacion(interaccionesTotal, interaccionesAnterior);
  const variacionGasto =
    pautaResumen && pautaGastoAnterior !== null ? variacion(pautaResumen.gasto, pautaGastoAnterior) : null;

  const alertasSalud = salud.filter((s) => s.alerta);
  const interaccionesSubieron = variacionInteracciones !== null && variacionInteracciones >= 0;
  const interaccionesBajaron = variacionInteracciones !== null && variacionInteracciones < 0;
  const hayFunciona = Boolean(mejorCampana || mejorPost || interaccionesSubieron);
  const hayAtencion = Boolean(campanaOportunidad || contenidoBajoRendimiento || interaccionesBajaron || alertasSalud.length > 0);

  return (
    <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="text-xl font-bold">Inicio</h1>
        <PeriodoSelector actual={periodo.valor} desde={periodo.desde} hasta={periodo.hasta} />
      </div>
      <p className="text-sm text-jab-muted mb-6">
        Lo que está pasando con tu marketing · {periodo.etiqueta.toLowerCase()} · comparado con el período anterior
        equivalente.
      </p>

      {/* Bloque 1: Resultados destacados */}
      <p className="text-sm font-semibold mb-3">Resultados destacados</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <KpiCard etiqueta="Pedidos pendientes" valor={String(pedidosPendientes)} ayuda="Pedidos que todavía no llegaron a Aprobado, ahora mismo." />
        <KpiCard
          etiqueta="Publicaciones"
          valor={String(totalPublicaciones)}
          ayuda="Publicaciones de Instagram/Facebook en el período elegido."
          tendencia={
            variacionPublicaciones !== null ? { valor: variacionPublicaciones, positivoEsBueno: true } : null
          }
        />
        <KpiCard
          etiqueta="Alcance orgánico"
          valor={alcanceTotal.toLocaleString('es-AR')}
          ayuda="Cuentas únicas que vieron tus publicaciones en el período."
          tendencia={variacionAlcance !== null ? { valor: variacionAlcance, positivoEsBueno: true } : null}
        />
        {pautaResumen && (
          <KpiCard
            etiqueta="Inversión en Ads"
            valor={`$${pautaResumen.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
            ayuda="Gasto total en Meta Ads en el período."
            tendencia={variacionGasto !== null ? { valor: variacionGasto, positivoEsBueno: true } : null}
          />
        )}
      </div>

      {/* Bloque 2: Qué está funcionando */}
      {hayFunciona && (
        <div className="mb-8">
          <p className="text-sm font-semibold mb-3">Qué está funcionando</p>
          <div className="grid lg:grid-cols-2 gap-3">
            {interaccionesSubieron && (
              <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4 text-sm">
                Las interacciones subieron <span className="font-bold">{variacionInteracciones}%</span> frente al
                período anterior ({interaccionesAnterior.toLocaleString('es-AR')} →{' '}
                {interaccionesTotal.toLocaleString('es-AR')}).
              </div>
            )}
            {mejorCampana && (
              <div className="rounded-lg bg-jab-panel-2 border border-jab-accent/40 p-4 text-sm">
                <span className="text-[11px] font-semibold tracking-widest text-jab-accent uppercase">Mejor campaña</span>
                <p className="mt-1">
                  <span className="font-medium">{mejorCampana.nombre}</span> — {mejorCampana.conversiones.toLocaleString('es-AR')}{' '}
                  conversiones con ${mejorCampana.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })} de inversión.
                </p>
              </div>
            )}
            {mejorPost && <PublicacionMini post={mejorPost} titulo="Mejor publicación" />}
          </div>
        </div>
      )}

      {/* Bloque 3: Qué necesita atención */}
      {hayAtencion && (
        <div className="mb-8">
          <p className="text-sm font-semibold mb-3">Qué necesita atención</p>
          <div className="grid lg:grid-cols-2 gap-3">
            {interaccionesBajaron && (
              <div className="rounded-lg bg-jab-panel-2 border border-jab-amber/40 p-4 text-sm">
                Las interacciones bajaron{' '}
                <span className="font-bold">{Math.abs(variacionInteracciones!)}%</span> frente al período anterior
                ({interaccionesAnterior.toLocaleString('es-AR')} → {interaccionesTotal.toLocaleString('es-AR')}).
              </div>
            )}
            {campanaOportunidad && (
              <div className="rounded-lg bg-jab-panel-2 border border-jab-amber/40 p-4 text-sm">
                <span className="text-[11px] font-semibold tracking-widest text-jab-amber uppercase">
                  Oportunidad de mejora
                </span>
                <p className="mt-1">
                  <span className="font-medium">{campanaOportunidad.nombre}</span> gastó $
                  {campanaOportunidad.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })} con{' '}
                  {campanaOportunidad.conversiones === 0 ? 'ninguna conversión' : `solo ${campanaOportunidad.conversiones} conversiones`} —
                  vale la pena revisarla.
                </p>
              </div>
            )}
            {contenidoBajoRendimiento && (
              <PublicacionMini post={contenidoBajoRendimiento} titulo="Contenido con oportunidad de mejora" />
            )}
            {alertasSalud.map((s) => (
              <div key={s.nombre} className="rounded-lg bg-jab-panel-2 border border-jab-amber/40 p-4 text-sm">
                <span className="text-[11px] font-semibold tracking-widest text-jab-amber uppercase">{s.nombre}</span>
                <p className="mt-1">{s.alerta}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Bloque 4: Tus próximas acciones */}
        <div>
          <p className="text-sm font-semibold mb-3">Tus próximas acciones</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Link
              href="/dashboard/redes"
              className="rounded-full bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-xs font-medium hover:border-jab-accent"
            >
              Ver contenido
            </Link>
            <Link
              href="/dashboard/pauta"
              className="rounded-full bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-xs font-medium hover:border-jab-accent"
            >
              Ver pauta
            </Link>
            <Link
              href="/dashboard/pedidos"
              className="rounded-full bg-jab-panel-2 border border-jab-border px-3 py-1.5 text-xs font-medium hover:border-jab-accent"
            >
              Ver pedidos pendientes
            </Link>
            <Link
              href="/dashboard/pedidos"
              className="rounded-full bg-jab-lime text-jab-lime-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
            >
              Crear pedido
            </Link>
          </div>
          <div className="space-y-2">
            {pedidosEnRevision > 0 && (
              <Link
                href="/dashboard/pedidos"
                className="block rounded-lg bg-jab-amber/10 border border-jab-amber/30 px-4 py-2.5 text-sm hover:border-jab-amber"
              >
                <span className="font-medium">{pedidosEnRevision}</span> pedido{pedidosEnRevision === 1 ? '' : 's'} esperando tu
                aprobación
              </Link>
            )}
            {proximasFechas.map((p) => (
              <Link
                key={p.id}
                href="/dashboard/pedidos"
                className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 hover:border-jab-accent"
              >
                <p className="text-sm font-medium truncate">{p.titulo}</p>
                <p className="text-xs text-jab-muted shrink-0">📅 {fechaCortaSinHora(p.fecha)}</p>
              </Link>
            ))}
            {pedidosEnRevision === 0 && proximasFechas.length === 0 && (
              <p className="text-sm text-jab-muted">No hay nada pendiente de tu parte por ahora.</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-5 mb-3">
            <p className="text-sm font-semibold">Últimos pedidos</p>
            <Link href="/dashboard/pedidos" className="text-xs text-jab-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {pedidosRecientes.length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay pedidos.</p>
          ) : (
            <div className="space-y-2">
              {pedidosRecientes.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href="/dashboard/pedidos"
                  className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 hover:border-jab-accent"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${CATEGORIA_COLOR[p.categoria]}`}
                    >
                      {CATEGORIA_LABEL[p.categoria]}
                    </span>
                    <p className="text-sm font-medium truncate">{p.titulo}</p>
                  </div>
                  <p className="text-xs text-jab-muted shrink-0">{ESTADO_PEDIDO_LABEL[p.estado]}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Salud de la cuenta */}
        <div>
          <p className="text-sm font-semibold mb-3">Salud de la cuenta</p>
          <div className="space-y-2">
            {salud.map((s) => (
              <div key={s.nombre} className="rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
                <p className="text-sm font-medium mb-1.5">{s.nombre}</p>
                <FrescuraDatos
                  fuente={s.nombre}
                  conectado={s.conectado}
                  ultimaSync={s.ultimaActualizacion}
                  horaCronUtc={s.horaCronUtc}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-5 mb-3">
            <p className="text-sm font-semibold">Materiales</p>
            <Link href="/dashboard/materiales" className="text-xs text-jab-accent hover:underline">
              Ver todos
            </Link>
          </div>
          {materiales.length === 0 ? (
            <p className="text-sm text-jab-muted">Todavía no hay materiales.</p>
          ) : (
            <div className="space-y-2">
              {materiales.map((m) => (
                <MaterialDescargaButton key={m.id} materialId={m.id}>
                  <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-2.5 hover:border-jab-accent w-full cursor-pointer">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="shrink-0">{esImagen(m.nombre) ? '🖼️' : '📄'}</span>
                      <p className="text-sm font-medium truncate">{m.nombre}</p>
                    </div>
                    <p className="text-xs text-jab-muted shrink-0">{fechaCortaSinHora(m.creadoEn.slice(0, 10))}</p>
                  </div>
                </MaterialDescargaButton>
              ))}
            </div>
          )}
        </div>
      </div>

      {pautaResumen && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Pauta</p>
            <Link href="/dashboard/pauta" className="text-xs text-jab-accent hover:underline">
              Ver reporte completo
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              etiqueta="Inversión"
              valor={`$${pautaResumen.gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
              ayuda="Gasto total en Meta Ads en el período."
            />
            <KpiCard
              etiqueta="Impresiones"
              valor={pautaResumen.impresiones.toLocaleString('es-AR')}
              ayuda="Veces que se mostró algún anuncio, sin descontar repeticiones a la misma persona."
            />
            <KpiCard
              etiqueta="Clics"
              valor={pautaResumen.clics.toLocaleString('es-AR')}
              ayuda="Clics en los anuncios en el período."
            />
            <KpiCard
              etiqueta="Conversiones"
              valor={pautaResumen.conversiones.toLocaleString('es-AR')}
              ayuda="Mensajes, leads, compras y otras acciones de valor que Meta atribuye a los anuncios."
            />
          </div>
        </div>
      )}

      {!pautaResumen && (
        <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
          <p className="text-sm text-jab-muted">
            Todavía no hay una cuenta publicitaria conectada.{' '}
            <Link href="/dashboard/pauta" className="text-jab-accent hover:underline">
              Ir a Pauta
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
