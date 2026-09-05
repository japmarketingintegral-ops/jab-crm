import { cookies } from 'next/headers';
import Link from 'next/link';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { verificarPayload, type ActivoPagina, type ActivoCuentaPublicitaria, type NegocioMeta } from '@/lib/meta';
import { createServiceClient } from '@/lib/supabase/service';
import { COOKIE_CONEXION_PENDIENTE } from '@/app/api/auth/meta/callback/route';
import { SelectorActivos } from './selector-activos';

const ERROR_LABEL: Record<string, string> = {
  fallo: 'No se pudo conectar lo elegido. Probá de nuevo.',
  expirado: 'La sesión de conexión con Meta expiró.',
  nada_elegido: 'Elegí al menos una página o cuenta publicitaria, o volvé a Configuración.',
};

export default async function MetaActivosPage({
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

  let paginas: ActivoPagina[] | null = null;
  let cuentas: ActivoCuentaPublicitaria[] = [];
  let negocios: NegocioMeta[] = [];
  if (datosToken && datosToken.tenantId === tenantId) {
    const service = createServiceClient();
    const { data: pendiente } = await service
      .from('meta_conexiones_pendientes')
      .select('paginas, cuentas_publicitarias, negocios')
      .eq('id', datosToken.conexionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (pendiente) {
      paginas = (pendiente.paginas as ActivoPagina[] | undefined) ?? [];
      cuentas = (pendiente.cuentas_publicitarias as ActivoCuentaPublicitaria[] | undefined) ?? [];
      negocios = (pendiente.negocios as NegocioMeta[] | undefined) ?? [];
    }
  }

  return (
    <main className="jab-canvas-light flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-jab-panel-2 border border-jab-border p-6">
        <h1 className="text-lg font-bold mb-1">Elegí qué conectar</h1>
        <p className="text-sm text-jab-muted mb-5">
          Encontramos varios activos disponibles. Elegí la página y/o la cuenta publicitaria que
          corresponden a este cliente — no hace falta elegir ambas.
        </p>

        {params.error && (
          <p className="mb-3 text-sm rounded-lg bg-jab-red/10 text-jab-red px-3 py-2">
            {ERROR_LABEL[params.error] ?? 'Algo falló. Probá de nuevo.'}
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
          <SelectorActivos paginas={paginas} cuentas={cuentas} negocios={negocios} />
        )}
      </div>
    </main>
  );
}
