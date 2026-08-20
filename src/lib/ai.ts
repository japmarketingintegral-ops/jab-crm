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

export type RespuestasBrief = {
  empresaDescripcion: string | null;
  queVende: string | null;
  clienteIdeal: string | null;
  competenciaDiferencial: string | null;
  objetivos: string | null;
  notas: string | null;
};

/**
 * Convierte las respuestas sueltas del brief de onboarding en un reporte
 * corto y accionable para que el equipo de JAB no tenga que releer las 6
 * respuestas cada vez que arranca a trabajar la cuenta.
 */
export async function generarReporteBrief(
  respuestas: RespuestasBrief,
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const anthropic = obtenerCliente();
  if (!anthropic) {
    return { ok: false, error: 'La IA no está configurada todavía (falta la clave de Anthropic).' };
  }
  if (Object.values(respuestas).every((v) => !v?.trim())) {
    return { ok: false, error: 'Todavía no hay respuestas cargadas en el brief.' };
  }

  const systemPrompt = [
    'Sos un estratega de marketing senior de una agencia. Te paso las respuestas que un cliente cargó en un formulario de onboarding y tenés que devolver un reporte breve para el equipo que va a trabajar su cuenta.',
    'Estructura EXACTA a devolver (respetá los títulos, en mayúsculas, sin markdown ni asteriscos):',
    'SITUACIÓN ACTUAL\n(2-3 líneas: qué es la empresa, qué vende, en qué etapa está)',
    '\nPÚBLICO OBJETIVO\n(1-2 líneas sobre a quién le tiene que hablar la marca)',
    '\nDIFERENCIAL\n(1-2 líneas: por qué elegirla a ella y no a la competencia)',
    '\nA DÓNDE APUNTA\n(1-2 líneas: qué objetivo declaró y qué significa en la práctica)',
    '\nFOCO SUGERIDO PARA JAB\n(2-3 líneas con una recomendación concreta de por dónde arrancar — no repitas "generar más leads" sin más: pensá en marca, contenido, retención u otra palanca según lo que cargó el cliente)',
    'Español rioplatense, directo, sin relleno. Si una respuesta vino vacía o muy pobre, decilo en esa sección en vez de inventar información.',
  ].join('\n');

  const mensajeUsuario = [
    `La empresa: ${respuestas.empresaDescripcion || '(sin responder)'}`,
    `Qué vende: ${respuestas.queVende || '(sin responder)'}`,
    `Cliente ideal: ${respuestas.clienteIdeal || '(sin responder)'}`,
    `Competencia y diferencial: ${respuestas.competenciaDiferencial || '(sin responder)'}`,
    `Objetivos con JAB: ${respuestas.objetivos || '(sin responder)'}`,
    `Notas adicionales: ${respuestas.notas || '(sin responder)'}`,
  ].join('\n');

  try {
    const respuesta = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: mensajeUsuario }],
    });
    const bloque = respuesta.content.find((b) => b.type === 'text');
    if (!bloque || bloque.type !== 'text') return { ok: false, error: 'La IA no devolvió texto.' };
    return { ok: true, texto: bloque.text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido consultando la IA' };
  }
}
