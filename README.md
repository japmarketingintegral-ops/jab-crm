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
- **Vercel** — hosting. Ya desplegado en producción
  (`https://jab-crm.vercel.app`), funciones ancladas a São Paulo (`gru1`)
  para que la latencia con la base de Supabase (también en `sa-east-1`) sea
  mínima.

## Roles

| Rol | Ve |
|---|---|
| `super_admin` (JAB) | Todo, de cualquier cliente, sin restricción. Da de alta clientes nuevos desde `/admin`, gestiona el equipo de JAB desde `/admin/equipo`, y puede **entrar como cualquier cliente**. |
| `jab_staff` (equipo de JAB) | Nadie hasta que `super_admin` le da acceso a un cliente puntual. Con acceso: CRM/Cuentas/Tablero de ese cliente — salvo el CRM (leads), que necesita un permiso aparte (`puede_ver_crm`). Cada persona ve solo los clientes que le asignaron, nunca todos. |
| `client_admin` | Todos los leads de su empresa, equipo, redes, pedidos, reportes y configuración — de su propio tenant. |
| `salesperson` | Solo los leads que tiene asignados. Aterriza en "Mi panel". |

El aislamiento entre clientes está en `supabase/schema.sql`, no en el
código de las páginas: aunque una consulta tenga un bug, Postgres rechaza
las filas que no le correspondan al usuario logueado.

## Look and feel

El sidebar es siempre oscuro (marca Jab) y tiene dos grupos: **CRM**
(leads) y **Cuentas** (Redes, Pedidos, Materiales, Equipo,
Configuración). El lienzo de adentro cambia según la sección:

- **CRM y Cuentas**: claro, estilo Kommo — fondo gris clarito, tarjetas
  blancas, badges de color. La clase `.jab-canvas-light` en
  `src/app/globals.css` hace este repintado por selector CSS (no por
  variable — ver la nota técnica al final sobre por qué), así que alcanza
  con ponerle esa clase al `<main>` de una pantalla nueva para que herede
  el tema claro sin tocar el resto de los componentes.
- **Tablero interno**: oscuro, estilo ClickUp — columnas con pills de
  color (una identidad por estado) y tarjetas con etiquetas en
  monoespaciada. Ver sección "Tablero interno" abajo.

## Qué tiene el CRM hoy

**Login y acceso**
- Login con panel dividido (diseño de marca Jab), mostrar/ocultar
  contraseña, "Olvidé mi contraseña" funcional de punta a punta.
- Cada rol aterriza en un lugar distinto al entrar: `super_admin` → `/admin`,
  equipo de JAB → `/equipo/clientes` (elegir cliente), vendedor →
  `/dashboard/mi-panel`, admin de cliente → `/dashboard`.

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
- **Gráficos** (con `recharts`): interacciones por publicación en el
  tiempo, alcance por plataforma, y composición de interacciones (me
  gusta / comentarios / compartidos) por plataforma. Los colores por
  plataforma están en `src/lib/social.ts` (`PLATAFORMA_HEX`) — una
  identidad fija, no se ciclan.

**Pedidos** (`/dashboard/pedidos`)
- El cliente pide contenido o piezas nuevas ("+ Pedido": título + detalle)
  y lo sigue en un kanban de 4 columnas: **Pedido → En proceso → Revisión →
  Aprobado**, con drag-and-drop para mover tarjetas (mismo mecanismo que el
  Pipeline de leads). Toggle arriba para pasar a **vista Calendario**.
- Cualquiera del equipo del cliente puede pedir; cualquiera puede mover el
  estado por ahora (no hay un paso de aprobación restringido a admin
  todavía — ver "Qué falta").
- **Semáforo de SLA** en cada tarjeta (igual que en la Bandeja, con umbrales
  más laxos: verde <24h, ámbar 24–72h, rojo >72h desde el último cambio) —
  para que salte a la vista qué pedido lleva demasiado tiempo sin moverse.
  No se muestra en los que ya están Aprobados.
- **Categoría** por pedido (Redes / Contenido / Comunicado / Video / Pauta /
  Otro), visible como badge de color en la tarjeta y en la ficha.
- **Asignar responsable y fecha programada**: quien lo ve es el equipo de
  JAB (`super_admin`/`jab_staff`) — el cliente (`client_admin`/
  `salesperson`) nunca ve quién lo tiene asignado, ni en la tarjeta ni en
  la ficha. Es información interna de gestión, no algo que le sirva al
  cliente. La fecha programada sí la ve todo el mundo (le sirve para saber
  cuándo sale la pieza).
- **Vista Calendario**: mismo listado de pedidos pero organizado por mes,
  ubicados en el día de su `fecha_programada`. Cada celda muestra una
  miniatura (si el pedido tiene una imagen adjunta), categoría, título y un
  botón **Aprobar** de un clic para los que todavía no están en ese estado
  — pensado para que el cliente vea de un vistazo qué se publica cada día y
  lo apruebe sin tener que abrir la ficha. Los pedidos sin fecha programada
  no aparecen acá (siguen viéndose en el Kanban).
- **Archivos adjuntos**: se pueden subir al crear el pedido o después, desde
  su ficha (clic en la tarjeta). Los archivos viven en un bucket privado de
  Supabase Storage — nunca se sirven directo, cada descarga genera un link
  firmado de 5 minutos a través de un server action que ya validó sesión y
  tenant. Límite de 20MB por archivo.
- **Comentarios**: cada pedido tiene su propio hilo, para que el ida y
  vuelta entre el cliente y JAB quede documentado ahí — no en un chat de
  WhatsApp aparte que nadie puede rastrear después.

**Materiales** (`/dashboard/materiales`)
- Repositorio de archivos fijos del cliente (logos, guías de marca,
  manuales) — separado de Pedidos porque esto no tiene un flujo ni un
  estado, es simplemente "lo que ya existe y cualquiera puede necesitar
  bajar en cualquier momento".
- Subir y eliminar es solo para admins (del cliente o JAB); cualquiera del
  equipo puede ver y descargar. Mismo patrón de bucket privado + link
  firmado que los adjuntos de Pedidos.
- Las imágenes muestran una miniatura en la grilla; el resto de los
  archivos, un ícono genérico.

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

**Equipo de JAB** (`/admin/equipo`, solo `super_admin`)
- Invitar gente del equipo (diseñadores, CMs, editores...) por mail — se
  crean como `jab_staff`, sin tenant propio.
- Por cada persona, un checklist de todos los clientes: tildás a cuáles
  tiene acceso, y un toggle aparte "Ve CRM" por cliente (son dos permisos
  independientes — alguien puede tener Cuentas + Tablero de un cliente sin
  ver sus leads).
- Esto es distinto de `/dashboard/equipo`, que es el equipo del *cliente*
  (sus propios vendedores), no el de JAB.

**Elegir cliente** (`/equipo/clientes`, para `jab_staff`)
- Grilla estilo Trello con los clientes que tiene asignados esa persona
  (nunca todos — solo lo que `super_admin` le dio). Al elegir uno, entra
  "como equipo" (no como el cliente — no hay banner de impersonación) y
  cae en Pedidos. Tiene acceso a Cuentas + Tablero de ese cliente; al CRM
  (leads) solo si tiene el permiso `puede_ver_crm` para ese cliente en
  particular.

**Tablero interno** (`/dashboard/tablero`, solo equipo de JAB)
- El Trello interno de JAB por cliente: mezcla tarjetas propias (creadas
  ahí mismo, sin relación a un pedido) con los Pedidos de ese cliente, en
  una sola vista. `client_admin` y `salesperson` no lo ven — ni existe
  el link en su sidebar.
- Columnas: **Materiales → Pedidos → En proceso → Revisión → Ads → On
  hold → Aprobado**. "Pedidos" es exclusiva de tarjetas que vienen de un
  pedido real del cliente (se arrastran entre los mismos 4 estados que ve
  el cliente); "Materiales", "Ads" y "On hold" son exclusivas de tarjetas
  propias de JAB — un pedido no se puede soltar ahí porque ese estado ni
  existe para la tabla `pedidos`. Las tarjetas que vienen de un pedido
  llevan la marca "↳ pedido del cliente" y abren la misma ficha que en
  Pedidos (comentarios, archivos, aprobar); las propias abren una ficha
  más simple (estado, asignado, fecha, etiquetas).
- Asignación acá es al equipo de JAB con acceso a ese cliente
  (`super_admin` + los `jab_staff` con acceso), no al equipo del cliente.

**Webhooks** (`/api/webhooks/meta`, `/api/webhooks/google`)
- Estructura lista para recibir leads de Meta Lead Ads y Google Lead Form
  Extensions, ya con reparto automático por round robin si está activado.
  Con TODOs explícitos donde falta la integración real (ver "Qué falta").

**Base y seguridad**
- Esquema completo en `supabase/schema.sql` con RLS en todas las tablas.
- `noindex` en tres capas: meta tag, header `X-Robots-Tag` (proxy/middleware)
  y `robots.txt`.
- El acceso de `jab_staff` está en RLS, no confiado al frontend: las
  funciones `tiene_acceso_tenant(tenant)` y `staff_tiene_acceso(tenant,
  requerir_crm)` en `supabase/schema.sql` deciden fila por fila si esa
  persona puede ver/escribir un registro de ese cliente. Lo probé
  directo contra Postgres (no solo con la UI): una cuenta de equipo sin
  `puede_ver_crm` consulta `leads` y le devuelve 0 filas, sin error — el
  dato está bloqueado en la base, no oculto en la pantalla.

## Qué falta (necesita que estés vos)

1. **Conectar Meta Ads**: requiere crear y verificar una App en Meta for
   Developers (proceso externo de varios días) y guardar el Page Access
   Token del cliente. Los TODOs están marcados en
   `src/app/api/webhooks/meta/route.ts`.
2. **Conectar Google Ads**: requiere configurar el webhook de "Lead form
   assets" en la cuenta de Google Ads del cliente. TODOs en
   `src/app/api/webhooks/google/route.ts`.
3. **Apuntar el dominio final**: hoy vive en `jab-crm.vercel.app`, falta
   apuntar `clientes.jabmarketing.site` (DNS en Cloudflare) cuando quieras.
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
9. El Tablero interno no tiene time tracking a propósito (me lo pediste
   explícitamente así: "sin... trackin"). Si en algún momento lo querés
   sumar, la tabla `tareas_internas` está lista para agregarle columnas
   sin romper nada de lo que ya existe.

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
   comentarios, asignale un responsable y una fecha, después mirá cómo se
   ve en la vista **Calendario**) → **Materiales** (subí un logo de
   prueba) → **Reportes** (probá el filtro por fuente) →
   **Configuración** (activá el switch de auto-asignación) → la
   **campanita** arriba a la izquierda del sidebar.
5. Si querés ver la vista de un vendedor, invitalo desde **Equipo** o
   entrá con una cuenta que ya tenga rol `salesperson` — cae directo en
   **Mi panel**. (No hace falta "entrar como cliente" para probar esto si
   ya tenés una cuenta de vendedor real.)
6. Para probar el **equipo de JAB**: desde `/admin` entrá a **"Equipo de
   JAB"**, invitá a alguien, dale acceso a "Jab Marketing" (con o sin "Ve
   CRM"). Esa persona entra por su cuenta, cae en **elegir cliente**
   (`/equipo/clientes`), lo elige, y termina en Pedidos — sin CRM en el
   sidebar salvo que le hayas dado ese permiso. Desde ahí puede abrir el
   **Tablero** (franja "Interno · equipo JAB" abajo del sidebar) y ver sus
   pedidos mezclados con tarjetas propias.

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
- **Ojo si alguna vez tocás `src/proxy.ts`**: esta versión de Next.js
  renombró `middleware.ts` a `proxy.ts` (misma función, mismo lugar en la
  raíz de `src/`, protege todas las rutas). Si buscás "middleware" en el
  repo y no aparece nada, es por esto, no porque no exista.
- Cuando crees una cuenta a mano contra Supabase (para pruebas o soporte),
  el perfil en `profiles` se crea con **`insert`, no `update`** — la fila
  no existe todavía después de `auth.admin.createUser`, a diferencia de
  otros sistemas que la crean sola con un trigger. Los flujos reales de la
  app (invitar desde Equipo o desde `/admin`) ya lo hacen bien; esto es
  solo si alguna vez armás una cuenta de prueba directo por script.
- Agregar `jab_staff` al enum `user_role` necesitó correrse en **dos
  pasos**: `alter type ... add value` no se puede usar en la misma
  transacción en la que se referencia el valor nuevo. Si en el futuro hay
  que sumar otro valor a un enum, mismo cuento — primero el `add value`
  solo, confirmar, y recién ahí el resto de la migración que lo usa.
- El tema claro de CRM/Cuentas (`.jab-canvas-light` en `globals.css`) NO
  usa variables CSS reasignables — Tailwind v4 con `@theme inline` vuelca
  el hex literal en cada clase (`bg-jab-panel` compila directo a
  `background-color: #111736`, no a `var(--color-jab-panel)`). Por eso el
  override es por selector (`.jab-canvas-light .bg-jab-panel { ... }`,
  gana por especificidad) y no por redefinir la variable en un wrapper —
  eso último no habría tenido ningún efecto. Si agregás una pantalla
  nueva al lado claro y usa una clase `jab-*` que no está en la lista de
  `globals.css`, hay que sumarle su override ahí.
- `select()` de Supabase: si lo armás concatenando strings con `+`,
  TypeScript infiere `string` en vez del literal, y el cliente tipado lo
  trata como `SelectQueryError` (columnas quedan como `never`). Siempre
  un solo string literal, sin concatenar — pasó varias veces esta sesión
  y siempre se arregla así.
