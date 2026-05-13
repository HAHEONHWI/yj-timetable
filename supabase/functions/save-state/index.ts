import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { password, state } = await req.json().catch(() => ({ password: "", state: null }));
  const adminPassword = Deno.env.get("ADMIN_PASSWORD");

  if (!adminPassword) {
    return new Response(JSON.stringify({ ok: false, error: "ADMIN_PASSWORD secret is not set" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (password !== adminPassword) {
    return new Response(JSON.stringify({ ok: false, error: "Incorrect password" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!state || typeof state !== "object") {
    return new Response(JSON.stringify({ error: "Invalid state" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabaseAdmin
    .from("app_state")
    .upsert({ id: "main", data: state, updated_at: new Date().toISOString() });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
