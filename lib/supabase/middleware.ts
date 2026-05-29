import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const secureOpts = { ...options, sameSite: 'none' as const, secure: true };
            request.cookies.set({ name, value, ...secureOpts });
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const secureOpts = { ...options, sameSite: 'none' as const, secure: true };
            response.cookies.set({ name, value, ...secureOpts });
          });
        },
      },
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      }
    }
  );

  // This will refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  
  // Protected routes
  const isProtected = 
    url.pathname.startsWith('/dashboard') || 
    url.pathname.startsWith('/pomodoro') || 
    url.pathname.startsWith('/tasks') || 
    url.pathname.startsWith('/settings');

  // Auth routes
  const isAuth =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/register') ||
    url.pathname.startsWith('/forgot-password');

  if (!user && isProtected) {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuth) {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (url.pathname === '/') {
    url.pathname = user ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
