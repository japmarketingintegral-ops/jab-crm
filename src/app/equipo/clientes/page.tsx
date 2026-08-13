import { requerirPerfil } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CerrarSesionButton } from '@/components/cerrar-sesion-button';
import { iniciales } from '@/lib/format';
import { entrarComoEquipo } from './actions';

const COLORES_THUMB = [
  'bg-jab-meta',
  'bg-jab-accent',
  'bg-jab-lime text-jab-lime-ink',
  'bg-jab-green',
  'bg-jab-amber text-jab-bg-deep',
  'bg-jab-google',
];

export default async function ElegirClientePage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'jab_staff') redirect('/dashboard');

  const supabase = await createClient();
  const { data: accesos } = await supabase
    .from('staff_acceso_clientes')
    .select('tenant:tenants(id, name)')
    .eq('usuario_id', perfil.id);

  const clientes = (accesos ?? [])
    .map((a) => a.tenant)
    .filter((t): t is { id: string; name: string } => t !== null);

  return (
    <main className="min-h-screen bg-jab-bg-deep px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-jab-lime text-jab-lime-ink text-base font-bold">
              J
            </span>
            <div>
              <h1 className="text-base font-bold text-jab-text">Equipo Jab Marketing</h1>
              <p className="text-xs text-jab-muted">
                {perfil.full_name ?? perfil.email} · elegí el cliente en el que vas a trabajar
              </p>
            </div>
          </div>
          <CerrarSesionButton />
        </div>

        {clientes.length === 0 ? (
          <div className="rounded-lg bg-jab-panel border border-jab-border p-6">
            <p className="text-sm text-jab-muted">
              Todavía no tenés ningún cliente asignado. Pedíselo a quien administre el equipo.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold tracking-widest text-jab-muted uppercase mb-3">
              Tus clientes
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {clientes.map((cliente, i) => (
                <form key={cliente.id} action={entrarComoEquipo.bind(null, cliente.id)}>
                  <button
                    type="submit"
                    className="w-full text-left rounded-lg overflow-hidden bg-jab-panel-2 border border-jab-border hover:border-jab-accent"
                  >
                    <span
                      className={`flex h-16 items-center justify-center text-xl font-bold ${COLORES_THUMB[i % COLORES_THUMB.length]}`}
                    >
                      {iniciales(cliente.name)}
                    </span>
                    <span className="block px-2.5 py-2 text-xs font-semibold text-jab-text truncate">
                      {cliente.name}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
