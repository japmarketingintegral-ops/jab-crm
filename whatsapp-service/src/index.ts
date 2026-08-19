import 'dotenv/config';
import express from 'express';
import { createServiceClient } from './supabase.js';
import { iniciarSesion, cerrarSesion, obtenerSesion, reconectarTodos } from './sessions.js';
import { enviarMensajeSaliente } from './send.js';

const app = express();
app.use(express.json());

const supabase = createServiceClient();

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.WHATSAPP_SERVICE_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
});

app.post('/sessions/:tenantId/start', async (req, res) => {
  try {
    await iniciarSesion(supabase, req.params.tenantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Falló el inicio de sesión.' });
  }
});

app.post('/sessions/:tenantId/logout', async (req, res) => {
  try {
    await cerrarSesion(supabase, req.params.tenantId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Falló el cierre de sesión.' });
  }
});

app.post('/sessions/:tenantId/send', async (req, res) => {
  const { to, text } = req.body as { to?: string; text?: string };
  if (!to || !text) return res.status(400).json({ error: 'Faltan to/text.' });

  const sock = obtenerSesion(req.params.tenantId);
  if (!sock) return res.status(409).json({ error: 'WhatsApp no está conectado.' });

  const resultado = await enviarMensajeSaliente(sock, to, text);
  if (resultado.error) return res.status(502).json(resultado);
  res.json(resultado);
});

const PORT = process.env.PORT ?? 3100;
app.listen(PORT, () => {
  console.log(`whatsapp-service escuchando en :${PORT}`);
  void reconectarTodos(supabase);
});
