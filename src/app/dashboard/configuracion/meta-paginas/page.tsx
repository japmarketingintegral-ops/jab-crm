import { cookies } from 'next/headers';
import Link from 'next/link';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { verificarPayload, type PaginaMeta } from '@/lib/meta';
import { createServiceClient } from '@/lib/supabase/service';
import { COOKIE_CONEXION_PENDIENTE } from '@/app/api/auth/meta/callback/route';
import { elegirPaginaMeta } from './actions';

export default async function MetaPaginasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const params = await searchParams;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_CONEXION_PENDIENTE)?.value;
  const datosToken = token
    ? verificarPayload<{ tenantId: string; conexionId: string }>(token)
    : null;

  let paginas: PaginaMeta[] | null = null;
  if (datosToken && datosToken.tenantId === tenantId) {
    const service = createServiceClient();
    const { data: pendiente } = await service
      .from('meta_conexiones_pendientes')
      .select('paginas')
      .eq('id', datosToken.conexionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    paginas = (pendiente?.paginas as PaginaMeta[] | undefined) ?? null;
  }

  return (
    <main className="jab-canvas-light flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-jab-panel-2 border border-jab-border p-6">
        <h1 className="text-lg font-bold mb-1">Elegí qué página conectar</h1>
        <p className="text-sm text-jab-muted mb-5">
          Tu cuenta de Facebook administra más de una página. Elegí la que corresponde a este
          cliente — sus leads e Instagram vinculado se conectan a este panel.
        </p>

        {params.error && (
          <p className="mb-3 text-sm rounded-lg bg-jab-red/10 text-jab-red px-3 py-2">
            {params.error === 'fallo'
              ? 'No se pudo conectar esa página. Probá de nuevo.'
              : 'La sesión de conexión con Meta expiró.'}
          </p>
        )}

        {!paginas ? (
          <p className="text-sm text-jab-red">
            La sesión de conexión con Meta expiró.{' '}
            <Link href="/dashboard/configuracion" className="underline">
              Volvé a Configuración
            </Link>{' '}
            para intentar de nuevo.
          </p>
        ) : (
          <div className="space-y-2">
            {paginas.map((p) => (
              <form key={p.id} action={elegirPaginaMeta.bind(null, p.id)}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-between rounded-lg bg-jab-bg-deep border border-jab-border px-4 py-3 text-left hover:border-jab-accent"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.instagram_business_account && (
                      <p className="text-xs text-jab-muted">Con Instagram vinculado</p>
                    )}
                  </div>
                  <span className="text-xs text-jab-accent">Conectar →</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
