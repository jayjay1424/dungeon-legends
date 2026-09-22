import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


export async function updateSession(request: NextRequest) {

  let response = NextResponse.next({
    request,
  });


  const supabase = createServerClient(

    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      "placeholder-key",

    {
      cookies: {

        getAll() {
          return request.cookies.getAll();
        },


        setAll(cookiesToSet) {

          cookiesToSet.forEach(
            ({ name, value }) =>
              request.cookies.set(name, value)
          );


          response = NextResponse.next({
            request,
          });


          cookiesToSet.forEach(
            ({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                options
              )
          );

        },

      },

    }

  );


  const {
    data: {
      user,
    },

  } = await supabase.auth.getUser();



  if (
    !user &&
    request.nextUrl.pathname.startsWith("/dashboard")
  ) {

    return NextResponse.redirect(
      new URL("/login", request.url)
    );

  }


  return response;

}