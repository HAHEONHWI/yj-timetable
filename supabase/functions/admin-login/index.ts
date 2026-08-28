Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  return new Response(JSON.stringify({ ok: false, error: "This endpoint has been retired. Sign in with Supabase Auth." }), {
    status: 410,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
