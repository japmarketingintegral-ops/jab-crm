import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM_EMAIL || 'Jab Marketing <notificaciones@jabmarketing.site>';

let cliente: Resend | null = null;
function obtenerCliente(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!cliente) cliente = new Resend(process.env.RESEND_API_KEY);
  return cliente;
}

/**
 * Envía un mail transaccional vía Resend. Si no hay RESEND_API_KEY
 * configurada (todavía no se dio de alta la cuenta), no rompe el flujo que
 * la llama — solo lo deja registrado en el log del servidor.
 */
export async function enviarEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = obtenerCliente();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY no configurada — se omitió el envío de "${subject}" a ${to}`);
    return { ok: false, error: 'Resend no configurado' };
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html: envolverPlantilla(html) });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido enviando el mail' };
  }
}

/** Envoltorio visual común — navy + lima, igual al resto del panel. */
function envolverPlantilla(contenidoHtml: string): string {
  return `
    <div style="background:#f4f5f9;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dde1f0;">
        <div style="background:#0a0e27;padding:20px 24px;">
          <span style="color:#f4f5fb;font-weight:700;font-size:15px;letter-spacing:-0.01em;">Jab Marketing</span>
        </div>
        <div style="padding:24px;color:#1b2038;font-size:14px;line-height:1.6;">
          ${contenidoHtml}
        </div>
      </div>
    </div>
  `;
}
