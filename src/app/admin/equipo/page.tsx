import Link from 'next/link';
import { requerirSuperAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { InvitarStaffForm } from './invitar-form';
import { StaffAccesos, type Staff, type AccesoFila } from './staff-accesos';

export default async function AdminEquipoPage() {
  await requerirSuperAdmin();
  const supabase = await createClient();

  const [{ data: staff }, { data: tenants }, { data: accesos }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'jab_staff')
      .order('created_at', { ascending: true }),
    supabase.from('tenants').select('id, name').order('name', { ascending: true }),
    supabase.from('staff_acceso_clientes').select('usuario_id, tenant_id'),
  ]);

  const staffList: Staff[] = (staff ?? []).map((s) => ({
    id: s.id,
    nombre: s.full_name ?? s.email,
  }));
  const accesosList: AccesoFila[] = accesos ?? [];

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin" className="text-xs text-jab-muted hover:text-jab-text">
            ← Clientes
          </Link>
          <h1 className="text-lg font-semibold mt-1">Equipo de JAB</h1>
          <p className="text-xs text-jab-muted mt-0.5">
            Cada persona ve solo los clientes que le asignes acá.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <InvitarStaffForm />
          <CerrarSesionButton />
        </div>
      </div>

      {staffList.length === 0 ? (
        <p className="text-sm text-jab-muted">Todavía no invitaste a nadie del equipo.</p>
      ) : (
        <StaffAccesos staff={staffList} tenants={tenants ?? []} accesos={accesosList} />
      )}
    </main>
  );
}
