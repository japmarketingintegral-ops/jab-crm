import type { WASocket } from '@whiskeysockets/baileys';

/** Manda un mensaje de texto saliente por una sesión de Baileys ya
 * conectada. `to` viene en E.164 (con "+") desde src/lib/whatsapp.ts. */
export async function enviarMensajeSaliente(
  sock: WASocket,
  to: string,
  text: string,
): Promise<{ waMessageId?: string; error?: string }> {
  const numero = to.replace(/^\+/, '');
  const jid = `${numero}@s.whatsapp.net`;

  try {
    const [resultado] = (await sock.onWhatsApp(jid)) ?? [];
    if (!resultado?.exists) {
      return { error: 'Ese número no tiene WhatsApp.' };
    }
    const enviado = await sock.sendMessage(resultado.jid, { text });
    return { waMessageId: enviado?.key.id ?? undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo enviar el mensaje.' };
  }
}
