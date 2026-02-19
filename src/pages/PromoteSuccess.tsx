import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PromoteSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("post_id");
  const budgetCents = Number(searchParams.get("budget") || 0);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    const activate = async () => {
      if (!postId || processed) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maxViews = Math.floor(budgetCents / 1);

      // Create campaign
      const { data: campaign } = await supabase
        .from("ad_campaigns")
        .insert({
          advertiser_id: user.id,
          post_id: postId,
          budget_cents: budgetCents,
          max_views: maxViews,
          cost_per_view_cents: 1,
        })
        .select()
        .single();

      if (campaign) {
        // Payment record
        await supabase.from("payments").insert({
          user_id: user.id,
          campaign_id: campaign.id,
          amount_cents: budgetCents,
          status: "completed",
        });

        // Mark post promoted
        await supabase.from("posts").update({ is_promoted: true }).eq("id", postId);
      }

      setProcessed(true);
    };
    activate();
  }, [postId, budgetCents, processed]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="gradient-brand rounded-full p-4 w-fit mx-auto">
          <CheckCircle className="h-10 w-10 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold">Pagamento confirmado! 🎉</h1>
        <p className="text-sm text-muted-foreground">
          Seu post está sendo promovido. Acompanhe os resultados nas suas campanhas.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={() => navigate("/campaigns")} className="gradient-brand text-primary-foreground">
            Ver Campanhas
          </Button>
          <Button variant="secondary" onClick={() => navigate("/feed")}>
            Voltar ao Feed
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PromoteSuccess;
