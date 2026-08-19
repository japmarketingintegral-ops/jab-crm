import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requerirPerfil, requerirTenantActivo } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { QrPanel } from './qr-panel';

export default async function WhatsappPage() {
  const perfil = await requerirPerfil();
  if (perfil.role !== 'super_admin' && perfil.role !== 'jab_staff') {
    redirect('/dashboard/configuracion');
  }
  const tenantId = await requerirTenantActivo(perfil);
  const supabase = await createClient();

  const { data } = await supabase
    .from('whatsapp_conexiones')
    .select('estado, numero_whatsapp, qr, ultimo_error')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return (
    <main className="jab-canvas-light flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-jab-panel-2 border border-jab-border p-6">
        <Link href="/dashboard/configuracion" className="text-xs text-jab-muted hover:underline">
          ← Configuración
        </Link>
        <h1 className="text-lg font-bold mt-2 mb-1">Conectar WhatsApp</h1>
        <p className="text-sm text-jab-muted mb-5">
          Se vincula como un dispositivo más de WhatsApp — el celular del cliente sigue
          funcionando normal, y las conversaciones también van a poder contestarse desde acá.
        </p>
        <QrPanel
          inicial={{
            estado: data?.estado ?? 'desconectado',
            numero: data?.numero_whatsapp ?? null,
            qr: data?.qr ?? null,
            error: data?.ultimo_error ?? null,
          }}
        />
      </div>
    </main>
  );
}
