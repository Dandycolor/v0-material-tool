/**
 * Supabase server client — used in Server Components, API routes
 * Uncomment when NEXT_PUBLIC_SUPABASE_URL is set in .env.local
 */

// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'
//
// export async function createClient() {
//   const cookieStore = await cookies()
//   return createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         getAll() { return cookieStore.getAll() },
//         setAll(cookiesToSet) {
//           cookiesToSet.forEach(({ name, value, options }) =>
//             cookieStore.set(name, value, options)
//           )
//         },
//       },
//     }
//   )
// }

export {}
