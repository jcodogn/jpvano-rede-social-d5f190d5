import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Eye, DollarSign, TrendingUp, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ spent: 0, views: 0, campaigns: 0 });

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data } = await supabase
        .from("ad_campaigns")
        .select("*, posts(media_urls, caption)")
        .eq("advertiser_id", user.id)
        .order("created_at", { ascending: false });

      const list = data || [];
      setCampaigns(list);
      setTotals({
        spent: list.reduce((s, c) => s + (c.spent_cents || 0), 0),
        views: list.reduce((s, c) => s + (c.total_views || 0), 0),
        campaigns: list.length,
      });
      setLoading(false);
    };
    fetch();
  }, [navigate]);

  const toggleStatus = async (campaign: any) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await supabase.from("ad_campaigns").update({ status: newStatus }).eq("id", campaign.id);
    setCampaigns((prev) => prev.map((c) => c.id === campaign.id ? { ...c, status: newStatus } : c));
    toast.success(newStatus === "active" ? "Campanha ativada" : "Campanha pausada");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
          <h1 className="font-display text-lg font-bold">Minhas Campanhas</h1>
        </div>
        <Button size="sm" onClick={() => navigate("/promote")} className="gradient-brand text-primary-foreground">
          <Plus className="h-4 w-4 mr-1" /> Nova
        </Button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4">
        {[
          { icon: DollarSign, label: "Investido", value: `R$ ${(totals.spent / 100).toFixed(2)}` },
          { icon: Eye, label: "Visualizações", value: totals.views.toLocaleString() },
          { icon: TrendingUp, label: "Campanhas", value: totals.campaigns.toString() },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-card border border-border p-3 text-center">
            <Icon className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Campaign List */}
      <div className="px-4 space-y-3">
        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha ainda</p>
            <Button size="sm" onClick={() => navigate("/promote")} className="mt-4 gradient-brand text-primary-foreground">
              Criar primeira campanha
            </Button>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const progress = campaign.max_views > 0
              ? Math.min(100, Math.round(((campaign.total_views || 0) / campaign.max_views) * 100))
              : 0;

            return (
              <div key={campaign.id} className="rounded-xl bg-card border border-border p-4">
                <div className="flex gap-3">
                  {/* Post thumbnail */}
                  <div className="h-16 w-16 rounded-lg bg-secondary overflow-hidden shrink-0">
                    {campaign.posts?.media_urls?.[0] ? (
                      <img src={campaign.posts.media_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Post</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        campaign.status === "active"
                          ? "bg-green-500/20 text-green-400"
                          : campaign.status === "paused"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {campaign.status === "active" ? "Ativa" : campaign.status === "paused" ? "Pausada" : "Concluída"}
                      </span>
                      <button onClick={() => toggleStatus(campaign)} className="text-muted-foreground hover:text-foreground">
                        {campaign.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    </div>

                    <p className="text-sm truncate mt-1">{campaign.posts?.caption || "Post promovido"}</p>

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        R$ {((campaign.spent_cents || 0) / 100).toFixed(2)} / {(campaign.budget_cents / 100).toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {(campaign.total_views || 0).toLocaleString()} / {campaign.max_views.toLocaleString()}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-brand transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Campaigns;
