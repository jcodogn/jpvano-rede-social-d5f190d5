import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization")!;
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");

    // Verify admin role
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) throw new Error("Not authorized");

    const { withdrawal_id } = await req.json();
    if (!withdrawal_id) throw new Error("withdrawal_id required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get withdrawal request using service role to bypass RLS
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: withdrawal, error: wErr } = await serviceClient
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawal_id)
      .eq("admin_id", user.id)
      .eq("status", "pending")
      .single();

    if (wErr || !withdrawal) throw new Error("Withdrawal not found or already processed");

    // Create a Stripe payout (requires Stripe account to have balance)
    // Using transfer to connected account or payout depending on setup
    const amountInCents = withdrawal.amount_cents;

    const payout = await stripe.payouts.create({
      amount: amountInCents,
      currency: "brl",
      description: `Admin withdrawal - ${user.email}`,
      metadata: {
        withdrawal_id,
        admin_id: user.id,
      },
    });

    // Update withdrawal status
    await serviceClient
      .from("withdrawal_requests")
      .update({
        status: "completed",
        stripe_transfer_id: payout.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    return new Response(JSON.stringify({ success: true, payout_id: payout.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
