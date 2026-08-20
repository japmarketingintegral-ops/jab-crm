import Anthropic from '@anthropic-ai/sdk';

let cliente: Anthropic | null = null;
function obtenerCliente(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!cliente) cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cliente;
}

export type MensajeHistorial = { autor: 'cliente' | 'nosotros'; texto: string };

/**
 * Redacta una sugerencia de respuesta de WhatsApp para que el vendedor la
 * revise y mande — nunca se envía sola. Si no hay ANTHROPIC_API_KEY
 * configurada (todavía no se dio de alta la cuenta) no rompe el flujo que
 * la llama, igual que enviarEmail() sin RESEND_API_KEY.
 */
export async function sugerirRespuestaWhatsapp({
  personalidad,
  nombreAsistente,
  historial,
}: {
  personalidad: string | null;
  nombreAsistente: string | null;
  historial: MensajeHistorial[];
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const anthropic = obtenerCliente();
  if (!anthropic) {
    return { ok: false, error: 'La IA no está configurada todavía (falta la clave de Anthropic).' };
  }
  if (historial.length === 0) {
    return { ok: false, error: 'Todavía no hay mensajes en la conversación.' };
  }

  // La API de Anthropic exige roles alternados (user/assistant) — un chat
  // real de WhatsApp tiene tandas de varios mensajes seguidos del mismo
  // lado, así que hay que fusionarlos antes de armar los turnos.
  const historialFusionado: MensajeHistorial[] = [];
  for (const m of historial) {
    const anterior = historialFusionado[historialFusionado.length - 1];
    if (anterior && anterior.autor === m.autor) {
      anterior.texto += '\n' + m.texto;
    } else {
      historialFusionado.push({ ...m });
    }
  }
  // Y debe arrancar en 'user' (cliente) — si la conversación empezó con un
  // mensaje nuestro (ej. saludo inicial), se descarta para la sugerencia.
  while (historialFusionado.length > 0 && historialFusionado[0].autor !== 'cliente') {
    historialFusionado.shift();
  }
  if (historialFusionado.length === 0) {
    return { ok: false, error: 'Todavía no hay mensajes del cliente para responder.' };
  }

  const systemPrompt = [
    `Sos ${nombreAsistente || 'el asistente'} y respondés por WhatsApp en nombre de una empresa.`,
    personalidad?.trim()
      ? `Instrucciones específicas de esta empresa: ${personalidad.trim()}`
      : 'No hay instrucciones específicas — respondé de forma cordial y profesional.',
    'Redactá SOLO el próximo mensaje que mandaría un vendedor humano, en español rioplatense, corto (2-4 líneas como mucho), sin firmar y sin comillas ni explicaciones alrededor — el texto que devuelvas se pega directo en el chat.',
  ].join('\n\n');

  try {
    const respuesta = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 300,
      system: systemPrompt,
      messages: historialFusionado.map((m) => ({
        role: m.autor === 'cliente' ? ('user' as const) : ('assistant' as const),
        content: m.texto,
      })),
    });
    const bloque = respuesta.content.find((b) => b.type === 'text');
    if (!bloque || bloque.type !== 'text') return { ok: false, error: 'La IA no devolvió texto.' };
    return { ok: true, texto: bloque.text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido consultando la IA' };
  }
}
