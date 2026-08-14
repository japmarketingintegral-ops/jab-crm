import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rutas que no requieren sesión.
// /auth cubre el callback de invitación (procesa el token en el cliente,
// todavía no hay sesión en el primer request al servidor) y la pantalla de
// elegir contraseña.
const RUTAS_PUBLICAS = ['/login', '/api/webhooks', '/api/cron', '/auth'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname =
      profile?.role === 'super_admin'
        ? '/admin'
        : profile?.role === 'jab_staff'
          ? '/equipo/clientes'
          : '/dashboard';
    return NextResponse.redirect(url);
  }

  // Cinturón de seguridad extra sobre el robots.txt: ninguna respuesta de
  // este subdominio debe indexarse, la sirva quien la sirva.
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');

  return response;
}

export const config = {
  // El negativo-lookahead excluye archivos estáticos de public/ (logos,
  // imágenes, robots.txt) además de lo interno de Next — cualquier ruta
  // con un "." en el último segmento no pasa por acá, así no la termina
  // redirigiendo a /login por no tener sesión.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
