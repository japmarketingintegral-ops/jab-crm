import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/sidebar';
import { InvitarVendedorForm } from './invitar-form';
import { QuitarButton } from './quitar-button';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  salesperson: 'Vendedor',
};

export default async function EquipoPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = perfil.role === 'client_admin' || perfil.role === 'super_admin';

  const supabase = await createClient();

  const [{ data: tenant }, { data: equipo }, { data: conteos }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase.from('leads').select('assigned_to').eq('tenant_id', tenantId),
  ]);

  const leadsPorPersona = new Map<string, number>();
  for (const l of conteos ?? []) {
    if (!l.assigned_to) continue;
    leadsPorPersona.set(l.assigned_to, (leadsPorPersona.get(l.assigned_to) ?? 0) + 1);
  }

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="equipo"
        esVendedor={perfil.role === 'salesperson'}
        viendoComoJab={perfil.role === 'super_admin'}
      />
      <main className="flex-1 p-6 max-w-2xl w-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Equipo</h1>
          {esAdmin && <InvitarVendedorForm />}
        </div>

        <div className="space-y-2">
          {(equipo ?? []).map((persona) => (
            <div
              key={persona.id}
              className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{persona.full_name ?? persona.email}</p>
                <p className="text-xs text-jab-muted">
                  {ROL_LABEL[persona.role] ?? persona.role} · {leadsPorPersona.get(persona.id) ?? 0}{' '}
                  leads asignados
                </p>
              </div>
              {esAdmin && persona.id !== perfil.id && (
                <QuitarButton userId={persona.id} nombre={persona.full_name ?? persona.email} />
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
