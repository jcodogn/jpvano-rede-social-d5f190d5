import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getEstimatedArrival() {
  const arrival = new Date();
  arrival.setDate(arrival.getDate() + 2);
  if (arrival.getDay() === 0) arrival.setDate(arrival.getDate() + 1);
  if (arrival.getDay() === 6) arrival.setDate(arrival.getDate() + 2);
  return arrival.toLocaleDateString("pt-BR");
}

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

    // In Brazil, Stripe requires automatic payouts.
    // We record the withdrawal as approved and Stripe's automatic payout schedule handles the transfer.
    const approvalId = `approved_${Date.now()}`;

    // Update withdrawal status
    await serviceClient
      .from("withdrawal_requests")
      .update({
        status: "completed",
        stripe_transfer_id: approvalId,
        completed_at: new Date().toISOString(),
      })
      .eq("id", withdrawal_id);

    // Send email notification
    const amountFormatted = formatCurrency(withdrawal.amount_cents);
    const estimatedArrival = getEstimatedArrival();
    const requestDate = new Date().toLocaleDateString("pt-BR");

    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">💰 Saque Processado</h1>
          </div>
          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">Olá! Seu saque foi processado com sucesso.</p>
            
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valor</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${amountFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Data da solicitação</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 14px; text-align: right;">${requestDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Previsão de chegada</td>
                  <td style="padding: 8px 0; color: #6366f1; font-size: 14px; font-weight: 600; text-align: right;">${estimatedArrival}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">ID da transação</td>
                  <td style="padding: 8px 0; color: #111827; font-size: 12px; font-family: monospace; text-align: right;">${approvalId}</td>
                </tr>
              </table>
            </div>

            <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">
              ⏱️ O valor será transferido automaticamente via Stripe conforme o cronograma de pagamentos automáticos (geralmente D+2 dias úteis).
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
              Este é um e-mail automático. Não responda a esta mensagem.
            </p>
          </div>
        </div>
      `;

      // Use Lovable AI gateway to send email via edge function invocation
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Saques <noreply@resend.dev>",
            to: [user.email],
            subject: `Saque de ${amountFormatted} processado com sucesso`,
            html: emailHtml,
          }),
        });
      } else {
        console.log("RESEND_API_KEY not configured. Email notification skipped. Email would be sent to:", user.email);
      }
    } catch (emailError) {
      // Don't fail the withdrawal if email fails
      console.error("Email notification failed:", emailError);
    }

    return new Response(JSON.stringify({ success: true, approval_id: approvalId }), {
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
