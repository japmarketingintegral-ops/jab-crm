import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { entrarComoCliente } from './actions';

export default async function AdminPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false });

  const { data: sources } = await supabase
    .from('lead_sources')
    .select('id, tenant_id, platform, display_name, connected_at');

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Clientes de JAB</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/tenants/nuevo"
            className="text-sm rounded-full bg-jab-lime text-jab-lime-ink px-4 py-1.5 font-bold uppercase tracking-wide"
          >
            + Nuevo cliente
          </Link>
          <CerrarSesionButton />
        </div>
      </div>

      {!tenants || tenants.length === 0 ? (
        <p className="text-sm text-jab-muted">Todavía no diste de alta ningún cliente.</p>
      ) : (
        <div className="space-y-2">
          {tenants.map((tenant) => {
            const fuentesTenant = sources?.filter((s) => s.tenant_id === tenant.id) ?? [];
            return (
              <div
                key={tenant.id}
                className="rounded-md border border-jab-border bg-jab-panel-2 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{tenant.name}</p>
                    <p className="text-xs text-jab-muted mb-2">/{tenant.slug}</p>
                  </div>
                  <form action={entrarComoCliente.bind(null, tenant.id)}>
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-jab-border px-3 py-1.5 text-xs font-medium text-jab-muted hover:text-jab-text hover:border-jab-accent whitespace-nowrap"
                    >
                      Entrar como cliente
                    </button>
                  </form>
                </div>
                {fuentesTenant.length === 0 ? (
                  <p className="text-xs text-jab-amber">
                    Sin integraciones conectadas todavía.
                  </p>
                ) : (
                  <ul className="text-xs text-jab-muted space-y-0.5">
                    {fuentesTenant.map((f) => (
                      <li key={f.id}>
                        {f.platform === 'meta' ? 'Meta' : 'Google'} · {f.display_name} ·{' '}
                        {f.connected_at ? 'conectado' : 'pendiente de conectar'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
