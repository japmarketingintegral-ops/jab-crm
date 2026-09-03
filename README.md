# Jab CRM

Portal de reportes de marketing para los clientes de Jab Marketing. No es un
CRM de ventas: no gestiona leads, pipeline comercial, vendedores ni
WhatsApp comercial — el objetivo es que cada cliente entre, entienda qué
está haciendo la agencia por su cuenta, vea resultados de redes y pauta,
siga sus pedidos y trabaje con JAB sin depender de WhatsApp para todo.
Separado del sitio comercial (`jabmarketing.site`); pensado para vivir en
`clientes.jabmarketing.site`. No es contenido de marketing — no debe
indexarse (ver "Indexación" abajo).

## Stack

- **Next.js** (App Router, TypeScript) — frontend + backend en el mismo
  proyecto.
- **Supabase** (Postgres + Auth) — la base de datos hace el aislamiento
  entre clientes con Row Level Security (RLS), no el código de la app.
- **Vercel** — hosting. Ya desplegado en producción
  (`https://jab-crm.vercel.app`), funciones ancladas a São Paulo (`gru1`)
  para que la latencia con la base de Supabase (también en `sa-east-1`) sea
  mínima.

## Roles

| Rol | Ve |
|---|---|
| `super_admin` (JAB) | Todo, de cualquier cliente, sin restricción. Da de alta clientes nuevos desde `/admin`, gestiona el equipo de JAB desde `/admin/equipo`, y puede **entrar como cualquier cliente**. |
| `jab_staff` (equipo de JAB) | Nadie hasta que `super_admin` le da acceso a un cliente puntual. Con acceso: Redes/Pauta/Pedidos/Materiales/Tablero de ese cliente. Cada persona ve solo los clientes que le asignaron, nunca todos. |
| `client_admin` | Todo lo de su propia empresa: reportes, pedidos, materiales, equipo y configuración/integraciones. |
| `client_viewer` | Ve reportes, pedidos y materiales de su empresa, y puede comentar pedidos. No administra equipo, configuración ni integraciones (no sincroniza, no sube/elimina materiales, no asigna pedidos). |

El aislamiento entre clientes está en `supabase/schema.sql` (políticas de
Row Level Security), no en el código de las páginas: aunque una consulta
tenga un bug, Postgres rechaza las filas que no le correspondan al usuario
logueado.

## Look and feel

El sidebar es siempre oscuro (marca Jab) y tiene dos grupos: **Cuenta**
(Inicio, Brief, Redes, Pauta, Pedidos, Materiales, Equipo, Configuración) y,
solo para equipo de JAB, **Interno · equipo JAB** (Tablero, Mi trabajo). El
lienzo de adentro cambia según la sección:

- **Cuenta**: claro — fondo gris clarito, tarjetas blancas, badges de
  color. La clase `.jab-canvas-light` en `src/app/globals.css` hace este
  repintado por selector CSS (no por variable — ver la nota técnica al
  final sobre por qué), así que alcanza con ponerle esa clase al `<main>`
  de una pantalla nueva para que herede el tema claro sin tocar el resto
  de los componentes.
- **Tablero interno**: oscuro, estilo ClickUp — columnas con pills de
  color (una identidad por estado) y tarjetas con etiquetas en
  monoespaciada.

## Qué tiene el portal hoy

**Login y acceso**
- Login con panel dividido (diseño de marca Jab), mostrar/ocultar
  contraseña, "Olvidé mi contraseña" funcional de punta a punta.
- Cada rol aterriza en un lugar distinto al entrar: `super_admin` → `/admin`,
  equipo de JAB → `/equipo/clientes` (elegir cliente), cliente → `/dashboard`.

**Inicio** (`/dashboard`, vista por defecto al entrar)
- El reporte real del cliente: KPIs de los últimos 30 días (pedidos
  pendientes, publicaciones, alcance orgánico, inversión en Ads si hay
  cuenta conectada), últimos pedidos, publicación destacada, resumen de
  Pauta con link al detalle, y acceso rápido a los materiales más
  recientes con descarga directa.

**Redes** (`/dashboard/redes`)
- KPIs (publicaciones, alcance total, interacciones totales, interacciones
  por post), publicación destacada, grilla con todas las publicaciones
  cargadas.
- Si el cliente tiene Meta conectado (Configuración), aparece el botón
  "Sincronizar con Meta": trae las últimas publicaciones de la Página de
  Facebook y, si la Página tiene una cuenta de Instagram vinculada, también
  las de Instagram — alcance, me gusta, comentarios (y compartidos en
  Facebook). Se guardan por `external_id`, así sincronizar de nuevo
  actualiza las métricas en vez de duplicar publicaciones.
- Gráficos (con `recharts`): interacciones por publicación en el tiempo,
  alcance por plataforma, y composición de interacciones por plataforma.
  Los colores por plataforma están en `src/lib/social.ts`
  (`PLATAFORMA_HEX`) — una identidad fija, no se ciclan.

**Pauta** (`/dashboard/pauta`)
- Reporte de Meta Ads de los últimos 30 días: inversión, impresiones,
  clics, CPC promedio, conversiones y desglose por campaña.
- Botón "Sincronizar con Meta Ads" (admin de cliente o equipo JAB) trae los datos más
  recientes de la cuenta publicitaria conectada — el ID de esa cuenta se
  carga en Configuración una vez que Meta está conectado. Requiere el
  permiso `ads_read` de Meta (en revisión de la app al momento de este
  README).

**Pedidos** (`/dashboard/pedidos`)
- El cliente pide contenido o piezas nuevas ("+ Pedido": título + detalle)
  y lo sigue en un kanban de 4 columnas: **Pedido → En proceso → Revisión →
  Aprobado**, con drag-and-drop para mover tarjetas. Toggle arriba para
  pasar a vista Calendario.
- Categoría por pedido (Redes / Contenido / Comunicado / Video / Pauta /
  Otro), visible como badge de color en la tarjeta y en la ficha.
- Asignar responsable y fecha programada: quien lo ve es el equipo de JAB
  (`super_admin`/`jab_staff`) — el cliente nunca ve quién lo tiene
  asignado, ni en la tarjeta ni en la ficha. La fecha programada sí la ve
  todo el mundo.
- Vista Calendario: mismo listado de pedidos pero organizado por mes,
  ubicados en el día de su `fecha_programada`, con miniatura si el pedido
  tiene una imagen adjunta y un botón Aprobar de un clic.
- Archivos adjuntos: viven en un bucket privado de Supabase Storage —
  nunca se sirven directo. Cada descarga pasa el **ID** del archivo (nunca
  la ruta de Storage) a un server action que primero busca el registro con
  el cliente de sesión (RLS exige mismo tenant) y recién ahí genera un
  link firmado de 5 minutos. Límite de 20MB por archivo.
- Comentarios: cada pedido tiene su propio hilo, para que el ida y vuelta
  entre el cliente y JAB quede documentado ahí, no en un chat aparte.
- Notificaciones por mail (asignación, comentario nuevo, cambio de estado)
  vía Resend — todo el texto de usuario que entra al HTML del mail pasa
  por `escapeHtml()` (`src/lib/format.ts`) antes de interpolarse.

**Materiales** (`/dashboard/materiales`)
- Repositorio de archivos fijos del cliente (logos, guías de marca,
  manuales). Subir y eliminar es solo para admins (del cliente o JAB);
  cualquiera del equipo puede ver y descargar. Mismo patrón de bucket
  privado + link firmado por ID que los adjuntos de Pedidos.

**Brief** (`/dashboard/brief`)
- Wizard de onboarding: preguntas sobre el negocio del cliente y, si hay
  `ANTHROPIC_API_KEY` configurada, un reporte de negocio generado por IA a
  partir de las respuestas (`src/lib/ai.ts`) para que el equipo de JAB
  tenga un resumen accionable sin releer las respuestas sueltas cada vez.

**Configuración** (`/dashboard/configuracion`, admin del cliente)
- Conectar/desconectar Meta (Facebook/Instagram) — un login que guarda el
  token de la Página (para Redes) y, si el usuario autoriza `ads_read`, el
  token de usuario que necesita Pauta.
- Cargar el ID de la cuenta publicitaria de Meta Ads que usa Pauta.

**Panel Super Admin** (`/admin`, solo JAB)
- Listar clientes, dar de alta uno nuevo (crea el tenant + invita por mail
  al primer `client_admin`).
- "Entrar como cliente": un botón por cada tenant que te mete en su
  `/dashboard` como si fueras su `client_admin`. Mientras estás "adentro"
  de un cliente aparece un aviso amarillo arriba del sidebar ("Viendo como
  JAB") con un link para volver a `/admin`.

**Equipo de JAB** (`/admin/equipo`, solo `super_admin`)
- Invitar gente del equipo (diseñadores, CMs, editores...) por mail — se
  crean como `jab_staff`, sin tenant propio.
- Por cada persona, un checklist de todos los clientes: tildás a cuáles
  tiene acceso. Esto es distinto de `/dashboard/equipo`, que es el equipo
  del *cliente*, no el de JAB.

**Elegir cliente** (`/equipo/clientes`, para `jab_staff`)
- Grilla con los clientes que tiene asignados esa persona (nunca todos —
  solo lo que `super_admin` le dio). Al elegir uno, entra "como equipo" y
  cae en Pedidos.

**Tablero interno** (`/dashboard/tablero`, solo equipo de JAB)
- El tablero interno de JAB por cliente: mezcla tarjetas propias (creadas
  ahí mismo, sin relación a un pedido) con los Pedidos de ese cliente, en
  una sola vista. Los clientes no lo ven — ni existe el link en su
  sidebar.
- Columnas: **Materiales → Pedidos → En proceso → Revisión → Ads → On
  hold → Aprobado**. Las tarjetas que vienen de un pedido llevan la marca
  "↳ pedido del cliente" y abren la misma ficha que en Pedidos; las
  propias abren una ficha más simple (estado, asignado, fecha, etiquetas).

**Base y seguridad**
- Esquema completo en `supabase/schema.sql` con RLS en todas las tablas
  con `tenant_id`.
- `noindex` en tres capas: meta tag, header `X-Robots-Tag`
  (proxy/middleware) y `robots.txt`.
- El acceso de `jab_staff` está en RLS, no confiado al frontend.
- Ningún token de integración (Meta) se selecciona en una página o acción
  que devuelva datos al cliente — se filtra por existencia (`.not(...,
  'is', null)`) en vez de traer el valor.
- El `state` firmado del OAuth de Meta expira a los 10 minutos y su
  verificación de firma chequea el largo antes de comparar (evita un 500
  sin manejar con un `state` malformado).

## Qué falta (necesita que estés vos)

1. **Aprobación de `ads_read` por Meta**: el login y la sincronización de
   Pauta ya funcionan de punta a punta, pero para leer la cuenta
   publicitaria de un cliente que no sea de prueba hace falta que Meta
   apruebe la Revisión de la app (`developers.facebook.com/apps/1382210856675023`
   → Revisar → Revisión de la app).
2. **Google Ads y GA4**: no hay integración todavía. Necesita que crees un
   proyecto en Google Cloud, pidas un Developer Token de Google Ads (lo
   aprueba Google manualmente, puede tardar días) y configures la
   propiedad GA4 por tenant.
3. **Apuntar el dominio final**: hoy vive en `jab-crm.vercel.app`, falta
   apuntar `clientes.jabmarketing.site` (DNS en Cloudflare) cuando quieras.
4. **Insights con IA**: Inicio ya compara el período elegido contra el
   anterior y señala mejor/peor campaña, mejor/peor publicación y la
   tendencia de interacciones — todo calculado directo de los datos, sin
   IA todavía. Falta el sistema de la sección 9 del pivot: insights
   guardados con fecha/fuentes/confianza, revisables y aprobables por JAB
   antes de mostrarse al cliente.
5. **Tests y CI**: hay tests unitarios (Vitest, `npm test`) para permisos y
   cálculo de períodos/variaciones, y un workflow de GitHub Actions
   (`.github/workflows/ci.yml`) que corre lint + tipos + tests + build en
   cada push/PR a `main`. Falta activar la protección de rama en GitHub
   (Settings → Branches) para que ese check bloquee merges — no es algo
   que se configure desde el código. También faltan tests de integración
   (RLS, aislamiento entre tenants) y E2E.

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar con tus claves de Supabase
npm run dev
```

## Notas técnicas (por si algo se ve raro)

- **Ojo si alguna vez tocás `src/proxy.ts`**: esta versión de Next.js
  renombró `middleware.ts` a `proxy.ts` (misma función, mismo lugar en la
  raíz de `src/`, protege todas las rutas). Si buscás "middleware" en el
  repo y no aparece nada, es por esto, no porque no exista.
- El tema claro de Cuenta (`.jab-canvas-light` en `globals.css`) NO usa
  variables CSS reasignables — Tailwind v4 con `@theme inline` vuelca el
  hex literal en cada clase (`bg-jab-panel` compila directo a
  `background-color: #111736`, no a `var(--color-jab-panel)`). Por eso el
  override es por selector (`.jab-canvas-light .bg-jab-panel { ... }`,
  gana por especificidad) y no por redefinir la variable en un wrapper —
  eso último no habría tenido ningún efecto. Si agregás una pantalla
  nueva al lado claro y usa una clase `jab-*` que no está en la lista de
  `globals.css`, hay que sumarle su override ahí.
- `select()` de Supabase: si lo armás concatenando strings con `+`,
  TypeScript infiere `string` en vez del literal, y el cliente tipado lo
  trata como `SelectQueryError` (columnas quedan como `never`). Siempre
  un solo string literal, sin concatenar.
- El rol `salesperson` sigue existiendo como valor sin uso en el enum
  `public.user_role` de la base — Postgres no permite sacar un valor de
  un enum sin recrear el tipo entero (y todo lo que depende de él), así
  que se dejó ahí sin asignarse a nadie en vez de forzar esa migración.
  Ver el comentario en `supabase/schema.sql`.
