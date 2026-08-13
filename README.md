# Jab CRM

Panel interno de gestión de leads para los clientes de Jab Marketing.
Separado del sitio comercial (`jabmarketing.site`); pensado para vivir en
`clientes.jabmarketing.site`. No es contenido de marketing — no debe
indexarse (ver "Indexación" abajo).

## Stack

- **Next.js** (App Router, TypeScript) — frontend + backend en el mismo
  proyecto.
- **Supabase** (Postgres + Auth) — la base de datos hace el aislamiento
  entre clientes con Row Level Security (RLS), no el código de la app.
- **Vercel** — hosting recomendado (soporte nativo de Next.js). Todavía no
  desplegado (ver "Qué falta" abajo).

## Roles

| Rol | Ve |
|---|---|
| `super_admin` (JAB) | Todo. Da de alta clientes nuevos desde `/admin` y puede **entrar como cualquier cliente** para gestionar su cuenta directamente (ver abajo). |
| `client_admin` | Todos los leads de su empresa, equipo, redes, pedidos, reportes y configuración. |
| `salesperson` | Solo los leads que tiene asignados. Aterriza en "Mi panel". |

El aislamiento entre clientes está en `supabase/schema.sql`, no en el
código de las páginas: aunque una consulta tenga un bug, Postgres rechaza
las filas que no le correspondan al usuario logueado.

## Qué tiene el CRM hoy

**Login y acceso**
- Login con panel dividido (diseño de marca Jab), mostrar/ocultar
  contraseña, "Olvidé mi contraseña" funcional de punta a punta.
- Cada rol aterriza en un lugar distinto al entrar: `super_admin` → `/admin`,
  vendedor → `/dashboard/mi-panel`, admin de cliente → `/dashboard`.

**Inicio** (`/dashboard`, vista por defecto al entrar)
- Pantalla resumen que junta las tres patas del servicio en un vistazo: KPIs
  (leads activos, leads calientes, pedidos pendientes, publicaciones),
  lista de leads calientes, últimos pedidos, y la publicación con mejor
  rendimiento — cada bloque linkea a su sección completa. Antes el cliente
  tenía que entrar pestaña por pestaña para armarse el panorama; ahora lo
  tiene todo apenas entra.

**Bandeja de leads** (`/dashboard?vista=bandeja`)
- Sidebar con contadores en vivo (Bandeja / Míos / Vencidos / Pipeline /
  Archivo), búsqueda, filtros por estado y por fuente (Meta/Google), semáforo
  de SLA sobre `updated_at` (verde <4h, ámbar 4–24h, rojo >24h), vista mobile
  con botones directos de WhatsApp y Llamar.
- Estado vacío con CTA a Configuración cuando todavía no llegó ningún lead.

**Ficha del lead** (panel lateral al hacer click en una fila)
- Cambiar estado, con **etiquetas rápidas** (Urgente, Sin presupuesto, No
  contesta, Interesado, Reagendar).
- Al marcar un lead como **Ganado**, pide el monto de la venta (opcional) y
  lo guarda con la fecha de cierre — alimenta el ranking y los reportes.
- Reasignar vendedor (solo admin), programar seguimiento, agregar notas,
  timeline completo de toda la actividad del lead.
- Loading con skeleton en vez de spinner genérico mientras carga la ficha.

**Pipeline** (`/dashboard?vista=pipeline`)
- Vista Kanban (Nuevo / Contactado / Con visita) con drag-and-drop para
  cambiar de etapa.

**Mi panel** (`/dashboard/mi-panel`, solo vendedores)
- Vista personal: leads activos, leads calientes (+24h sin tocar),
  seguimientos de hoy, tasa de conversión propia.

**Equipo** (`/dashboard/equipo`, admin del cliente)
- Invitar vendedores por mail, ver leads asignados por persona, quitar del
  equipo (libera sus leads en vez de borrar el historial).

**Reportes** (`/dashboard/reportes`)
- KPIs (total, sin contactar, tasa de respuesta, tiempo de 1ª respuesta,
  tasa de conversión), gráfico de leads por día (14 días), **filtro por
  fuente** (Meta/Google), **feed de actividad reciente** de todo el equipo,
  ranking de vendedores.

**Configuración** (`/dashboard/configuracion`, admin del cliente)
- **Auto-asignación round robin**: activás un switch y cada lead nuevo que
  llega por Meta o Google se reparte automáticamente entre los vendedores,
  uno por uno, en vez de quedar sin asignar.
- Estado de las integraciones (Meta Ads / Google Ads): muestra conectado o
  no, y por qué (ver "Qué falta" abajo — esa parte la conecta JAB).

**Notificaciones**
- Campanita en el sidebar (arriba a la derecha, siempre visible en
  desktop): avisa de leads sin primera respuesta hace +24h, seguimientos
  vencidos, y leads recién asignados. Se recalculan solas, no hay que
  marcarlas como leídas.

**Redes** (`/dashboard/redes`)
- El servicio de JAB para estos clientes no es solo leads, también gestiona
  sus redes sociales — esta pantalla es donde el cliente ve ese valor.
- KPIs (publicaciones, alcance total, interacciones totales, interacciones
  por post), **publicación destacada** (la de mejor rendimiento), grilla con
  todas las publicaciones cargadas.
- Todavía no hay integración en vivo con Instagram/Meta — las publicaciones
  las carga JAB (o el admin del cliente) a mano con el botón "+
  Publicación". El día que haya integración real, esta pantalla no cambia,
  solo cambia quién carga los datos.

**Pedidos** (`/dashboard/pedidos`)
- El cliente pide contenido o piezas nuevas ("+ Pedido": título + detalle)
  y lo sigue en un kanban de 4 columnas: **Pedido → En proceso → Revisión →
  Aprobado**, con drag-and-drop para mover tarjetas (mismo mecanismo que el
  Pipeline de leads).
- Cualquiera del equipo del cliente puede pedir; cualquiera puede mover el
  estado por ahora (no hay un paso de aprobación restringido a admin
  todavía — ver "Qué falta").
- **Semáforo de SLA** en cada tarjeta (igual que en la Bandeja, con umbrales
  más laxos: verde <24h, ámbar 24–72h, rojo >72h desde el último cambio) —
  para que salte a la vista qué pedido lleva demasiado tiempo sin moverse.
  No se muestra en los que ya están Aprobados.
- **Categoría** por pedido (Redes / Contenido / Comunicado / Video / Pauta /
  Otro), visible como badge de color en la tarjeta y en la ficha.
- **Archivos adjuntos**: se pueden subir al crear el pedido o después, desde
  su ficha (clic en la tarjeta). Los archivos viven en un bucket privado de
  Supabase Storage — nunca se sirven directo, cada descarga genera un link
  firmado de 5 minutos a través de un server action que ya validó sesión y
  tenant. Límite de 20MB por archivo.
- **Comentarios**: cada pedido tiene su propio hilo, para que el ida y
  vuelta entre el cliente y JAB quede documentado ahí — no en un chat de
  WhatsApp aparte que nadie puede rastrear después.

**Panel Super Admin** (`/admin`, solo JAB)
- Listar clientes, dar de alta uno nuevo (crea el tenant + invita por mail
  al primer `client_admin`).
- **"Entrar como cliente"**: un botón por cada tenant que te mete en su
  `/dashboard` como si fueras su `client_admin` — podés gestionarle los
  leads, cargarle publicaciones en Redes, mover sus Pedidos, cambiar su
  Configuración, todo. Mientras estás "adentro" de un cliente aparece un
  aviso amarillo arriba del sidebar ("Viendo como JAB") con un link para
  volver a `/admin`. Esto es justamente lo que resuelve el pedido de que
  vos (`japmarketingintegral@gmail.com`) puedas acceder a los clientes.

**Webhooks** (`/api/webhooks/meta`, `/api/webhooks/google`)
- Estructura lista para recibir leads de Meta Lead Ads y Google Lead Form
  Extensions, ya con reparto automático por round robin si está activado.
  Con TODOs explícitos donde falta la integración real (ver "Qué falta").

**Base y seguridad**
- Esquema completo en `supabase/schema.sql` con RLS en todas las tablas.
- `noindex` en tres capas: meta tag, header `X-Robots-Tag` (proxy/middleware)
  y `robots.txt`.

## Qué falta (necesita que estés vos)

1. **Conectar Meta Ads**: requiere crear y verificar una App en Meta for
   Developers (proceso externo de varios días) y guardar el Page Access
   Token del cliente. Los TODOs están marcados en
   `src/app/api/webhooks/meta/route.ts`.
2. **Conectar Google Ads**: requiere configurar el webhook de "Lead form
   assets" en la cuenta de Google Ads del cliente. TODOs en
   `src/app/api/webhooks/google/route.ts`.
3. **Desplegar en Vercel**: crear el proyecto en vercel.com, conectarlo a
   este repo, cargar las mismas variables de `.env.local`, y apuntar
   `clientes.jabmarketing.site` (DNS en Cloudflare). Los webhooks de Meta y
   Google necesitan una URL pública para poder configurarse — esto es un
   prerequisito de los dos puntos anteriores.
4. **Marca blanca por cliente** (branding personalizado por tenant) — está
   en el plan original pero todavía no se construyó la pantalla para
   subir/configurarlo.
5. **Bandeja estilo WhatsApp Web** (chat unificado de DMs de Instagram +
   WhatsApp) — depende de tener las integraciones de Meta conectadas
   primero (punto 1). La tabla `lead_activities` ya está diseñada para poder
   extenderse a mensajes sin rehacer nada.
6. La campanita de notificaciones y la navegación lateral hoy solo se ven en
   desktop (`hidden lg:flex`) — falta una versión mobile del header con
   acceso a notificaciones para vendedores que trabajan desde el celular.
7. En **Pedidos**, cualquiera del equipo del cliente puede mover una
   tarjeta a "Aprobado" — no hay todavía un paso donde eso quede reservado
   solo al admin del cliente. Si eso te importa (que "aprobado" sea una
   decisión del dueño de la cuenta, no de cualquier vendedor), decímelo y
   lo restrinjo.
8. Los archivos de Pedidos tienen un tope de 20MB cada uno (el propio
   `next.config.ts` limita el total del request a 25MB). Para algo más
   pesado (un video largo, por ejemplo) hoy conviene subirlo a Drive y
   pegar el link en un comentario — si esto se vuelve común, se puede
   subir el límite o mandar los adjuntos pesados directo a Storage desde
   el navegador en vez de pasar por el servidor.

## Cómo ver lo que se hizo hoy

1. Corré el proyecto local (ver abajo) o entrá a donde ya lo tengas
   desplegado.
2. Entrá con tu usuario `super_admin` de siempre (`japmarketingintegral@…`)
   — vas a caer en `/admin`, la lista de clientes de JAB.
3. Al lado de "Jab Marketing" (el tenant demo) apretá **"Entrar como
   cliente"** — esto es lo nuevo: te mete directo en su `/dashboard` como si
   fueras su admin, con un aviso amarillo arriba que dice "Viendo como JAB"
   y un link para volver a `/admin` cuando quieras salir.
4. Vas a caer directo en **Inicio** — el nuevo resumen con KPIs, leads
   calientes, últimos pedidos y la publicación destacada, todo en una
   pantalla. Recorrido sugerido desde ahí: **Bandeja** → abrí un lead y
   probá una etiqueta y marcarlo "Ganado" con un monto → **Pipeline** (vista
   Kanban) → **Redes** (cargá una publicación de prueba con "+ Publicación"
   y mirá cómo se arma la "mejor publicación") → **Pedidos** (creá uno con
   "+ Pedido", elegile una categoría, adjuntale un archivo, arrastralo entre
   columnas y hacé click en la tarjeta para ver su ficha completa con
   comentarios) → **Reportes** (probá el filtro por fuente) →
   **Configuración** (activá el switch de auto-asignación) → la
   **campanita** arriba a la izquierda del sidebar.
5. Si querés ver la vista de un vendedor, invitalo desde **Equipo** o
   entrá con una cuenta que ya tenga rol `salesperson` — cae directo en
   **Mi panel**. (No hace falta "entrar como cliente" para probar esto si
   ya tenés una cuenta de vendedor real.)

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local   # completar con tus claves de Supabase
npm run dev
```

## Notas técnicas de esta sesión (por si algo se ve raro)

- La migración de `tags`, `valor`, `cerrado_en` (leads) y `auto_asignacion`,
  `round_robin_ultimo_id` (tenants) tuvo que correrse dos veces: la primera
  vez el editor de Supabase mostró "Success" pero el pegado no había
  quedado bien y la migración real no se aplicó. Quedó verificada por
  segunda vez consultando directamente `information_schema.columns` — hoy
  las columnas existen y la app las usa sin problema.
- Se probaron todos los flujos nuevos con cuentas y datos de prueba
  (`QA TEMP —...`, `qa-admin-temp@...`, `qa-vendedor-temp@...`,
  `qa-superadmin-temp@...`) creados y después **borrados** al terminar — no
  debería quedar ningún rastro en tu cuenta demo real.
- La impersonación ("Entrar como cliente") funciona con una cookie
  (`jab_tenant_activo`) que guarda qué cliente eligió ver JAB — la sesión
  real sigue siendo la de JAB en todo momento, la cookie solo le dice a las
  páginas qué tenant mostrar. Al apretar "Volver a admin" se borra.
- Ojo con RLS acá: para vos (`client_admin`) o un vendedor, Postgres ya
  filtra solo a tu propio tenant sin que el código tenga que pedirlo. Para
  JAB (`super_admin`), Postgres te deja ver *todos* los tenants — así que
  cada pantalla nueva tiene que filtrar explícitamente por el tenant
  elegido en el código, si no JAB vería todo mezclado. Si en el futuro se
  agrega una pantalla nueva, hay que acordarse de este detalle (está
  documentado como comentario en `src/lib/auth.ts`, función
  `obtenerTenantActivo`).
- Reinicié tu `npm run dev` en algún momento de esta sesión (el cambio en
  `next.config.ts` para permitir subir archivos más grandes no se aplica
  con hot-reload, necesita un restart). Si ves algo raro en el navegador
  después de esto, probá un hard refresh (Cmd+Shift+R).
- Los archivos de Pedidos se probaron con un archivo real subido
  directamente contra Supabase Storage (mismo bucket, misma API que usa la
  app) — la subida, el registro en `pedido_archivos`, el link firmado de
  descarga y el contenido descargado coincidieron byte a byte con el
  original. Lo único que no pude probar automatizado fue el selector de
  archivo del formulario en sí (los navegadores no dejan que se simule ese
  click por seguridad) — probalo vos una vez cuando puedas, aunque el resto
  de la cadena ya está verificado.
