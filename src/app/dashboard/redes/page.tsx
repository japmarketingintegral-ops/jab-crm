import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { fechaCortaSinHora } from '@/lib/format';
import { KpiCard } from '../reportes/kpi-card';
import { AgregarPostForm } from './agregar-post-form';
import { EliminarPostButton } from './eliminar-post-button';
import { PLATAFORMA_LABEL, PLATAFORMA_COLOR, interaccionesPost } from '@/lib/social';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

export default async function RedesPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = perfil.role === 'client_admin' || perfil.role === 'super_admin';

  const supabase = await createClient();

  const [{ data: tenant }, { data: posts }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('publicado_en', { ascending: false }),
  ]);

  const lista = posts ?? [];
  const totalAlcance = lista.reduce((acc, p) => acc + p.alcance, 0);
  const totalInteracciones = lista.reduce((acc, p) => acc + interaccionesPost(p), 0);
  const promedioInteracciones = lista.length ? Math.round(totalInteracciones / lista.length) : 0;

  const mejor = lista.length
    ? [...lista].sort((a, b) => interaccionesPost(b) - interaccionesPost(a) || b.alcance - a.alcance)[0]
    : null;

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="redes"
        esVendedor={perfil.role === 'salesperson'}
        viendoComoJab={perfil.role === 'super_admin'}
      />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Redes</h1>
            <p className="text-sm text-jab-muted">Lo que publicamos y cómo funcionó.</p>
          </div>
          {esAdmin && <AgregarPostForm />}
        </div>

        {lista.length === 0 ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-6">
            <p className="text-sm text-jab-muted">
              Todavía no hay publicaciones cargadas. Apenas JAB suba la primera, vas a ver acá las
              métricas y cuál es la que mejor funcionó.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <KpiCard etiqueta="Publicaciones" valor={String(lista.length)} />
              <KpiCard etiqueta="Alcance total" valor={totalAlcance.toLocaleString('es-AR')} />
              <KpiCard etiqueta="Interacciones totales" valor={totalInteracciones.toLocaleString('es-AR')} />
              <KpiCard etiqueta="Interacciones por post" valor={String(promedioInteracciones)} />
            </div>

            {mejor && (
              <div className="mb-8">
                <p className="text-sm font-semibold mb-3">Mejor publicación</p>
                <div className="rounded-lg bg-jab-panel-2 border border-jab-accent/40 p-4 flex gap-4">
                  {mejor.imagen_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mejor.imagen_url}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[mejor.plataforma]}`}
                      >
                        {PLATAFORMA_LABEL[mejor.plataforma]}
                      </span>
                      <span className="text-xs text-jab-muted">{fechaCortaSinHora(mejor.publicado_en)}</span>
                    </div>
                    <p className="font-medium truncate">{mejor.titulo ?? 'Sin título'}</p>
                    <p className="text-sm text-jab-muted mt-1">
                      {interaccionesPost(mejor).toLocaleString('es-AR')} interacciones ·{' '}
                      {mejor.alcance.toLocaleString('es-AR')} de alcance
                    </p>
                    {mejor.url && (
                      <a
                        href={mejor.url}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-jab-accent hover:underline"
                      >
                        Ver publicación ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-3">Todas las publicaciones</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lista.map((p) => (
                  <div key={p.id} className="rounded-lg bg-jab-panel-2 border border-jab-border p-4">
                    {p.imagen_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imagen_url} alt="" className="h-32 w-full rounded-lg object-cover mb-3" />
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${PLATAFORMA_COLOR[p.plataforma]}`}
                      >
                        {PLATAFORMA_LABEL[p.plataforma]}
                      </span>
                      <span className="text-xs text-jab-muted">{fechaCortaSinHora(p.publicado_en)}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{p.titulo ?? 'Sin título'}</p>
                    <p className="text-xs text-jab-muted mt-1">
                      {p.alcance.toLocaleString('es-AR')} alcance · {p.me_gusta} me gusta ·{' '}
                      {p.comentarios} com. · {p.compartidos} comp.
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener"
                          className="text-xs text-jab-accent hover:underline"
                        >
                          Ver ↗
                        </a>
                      ) : (
                        <span />
                      )}
                      {esAdmin && <EliminarPostButton postId={p.id} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
