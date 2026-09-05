import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { Sidebar } from '@/components/sidebar';
import { iniciales } from '@/lib/format';
import { InvitarMiembroForm } from './invitar-form';
import { QuitarButton } from './quitar-button';
import { RolSelect } from './rol-select';

const ROL_LABEL: Record<string, string> = {
  super_admin: 'JAB',
  client_admin: 'Administradora',
  client_viewer: 'Solo lectura',
};

function ultimoAcceso(iso: string | null | undefined): string {
  if (!iso) return 'Todavía no entró';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default async function EquipoPage() {
  const perfil = await requerirPerfil();
  const tenantId = await requerirTenantActivo(perfil);
  const esAdmin = perfil.role === 'client_admin' || perfil.role === 'super_admin';

  const supabase = await createClient();

  const [{ data: tenant }, { data: equipoRaw }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
  ]);

  // Último acceso vive en auth.users, no en profiles -- se pide con el
  // service role (admin API), nunca es visible via RLS de sesión normal.
  const service = createServiceClient();
  const equipo = await Promise.all(
    (equipoRaw ?? []).map(async (persona) => {
      const { data } = await service.auth.admin.getUserById(persona.id);
      return { ...persona, ultimoAcceso: data.user?.last_sign_in_at ?? null };
    }),
  );

  const administradores = equipo.filter((p) => p.role === 'client_admin' || p.role === 'super_admin');
  const lectores = equipo.filter((p) => p.role === 'client_viewer');

  function Fila({ persona }: { persona: (typeof equipo)[number] }) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-jab-panel-2 border border-jab-border px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jab-accent/20 text-xs font-semibold text-jab-accent">
            {iniciales(persona.full_name ?? persona.email)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{persona.full_name ?? persona.email}</p>
            <p className="text-xs text-jab-muted truncate">
              {persona.email} · {ultimoAcceso(persona.ultimoAcceso)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {esAdmin && persona.id !== perfil.id && persona.role !== 'super_admin' ? (
            <RolSelect userId={persona.id} rolActual={persona.role} nombre={persona.full_name ?? persona.email} />
          ) : (
            <span className="text-xs text-jab-muted">{ROL_LABEL[persona.role] ?? persona.role}</span>
          )}
          {esAdmin && persona.id !== perfil.id && (
            <QuitarButton userId={persona.id} nombre={persona.full_name ?? persona.email} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
      <Sidebar
        tenantNombre={tenant?.name ?? '—'}
        nombreUsuario={perfil.full_name ?? perfil.email}
        rolLabel={ROL_LABEL[perfil.role] ?? perfil.role}
        seccion="equipo"
        viendoComoJab={perfil.role === 'super_admin'}
        mostrarTablero={perfil.role === 'super_admin' || perfil.role === 'jab_staff'}
      />
      <main className="jab-canvas-light flex-1 p-4 pb-24 lg:p-6 overflow-y-auto">
       <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Equipo</h1>
            <p className="text-sm text-jab-muted">Quién de tu lado accede al portal y qué puede hacer.</p>
          </div>
          {esAdmin && <InvitarMiembroForm />}
        </div>

        {equipo.length <= 1 ? (
          <div className="rounded-lg bg-jab-panel-2 border border-jab-border p-8 text-center mb-6">
            <div className="text-3xl mb-2">👥</div>
            <p className="text-sm font-medium mb-1">Todavía sos el único con acceso</p>
            <p className="text-sm text-jab-muted">
              Invitá a tu equipo para que puedan seguir pedidos y resultados sin depender de vos.
            </p>
          </div>
        ) : null}

        {administradores.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
              Administradores
            </p>
            <div className="space-y-2">
              {administradores.map((persona) => (
                <Fila key={persona.id} persona={persona} />
              ))}
            </div>
          </div>
        )}

        {lectores.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-2">
              Solo lectura
            </p>
            <div className="space-y-2">
              {lectores.map((persona) => (
                <Fila key={persona.id} persona={persona} />
              ))}
            </div>
          </div>
        )}
       </div>
      </main>
    </div>
  );
}
