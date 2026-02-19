import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Eye, DollarSign, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BUDGET_OPTIONS = [
  { cents: 500, label: "R$ 5", views: "~500", reach: "Básico" },
  { cents: 1000, label: "R$ 10", views: "~1.000", reach: "Moderado" },
  { cents: 2000, label: "R$ 20", views: "~2.000", reach: "Bom" },
  { cents: 5000, label: "R$ 50", views: "~5.000", reach: "Alto" },
  { cents: 10000, label: "R$ 100", views: "~10.000", reach: "Máximo" },
];

const PromotePost = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("posts")
        .select("id, media_urls, caption, created_at, is_promoted")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPosts(data || []);
      setLoading(false);
    };
    fetch();
  }, [navigate]);

  const handlePromote = async () => {
    if (!selectedPost || !selectedBudget || !userId || submitting) return;
    setSubmitting(true);

    // Call Stripe Checkout via edge function
    const { data, error } = await supabase.functions.invoke("create-promotion-checkout", {
      body: { budget_cents: selectedBudget, post_id: selectedPost },
    });

    if (error || !data?.url) {
      toast.error("Erro ao iniciar pagamento");
      setSubmitting(false);
      return;
    }

    // Redirect to Stripe Checkout
    window.open(data.url, "_blank");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" /></button>
        <h1 className="font-display text-lg font-bold">Promover Post</h1>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Intro */}
        <div className="rounded-xl bg-card p-4 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="gradient-brand rounded-lg p-2">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="font-display font-semibold">Alcance mais pessoas</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Invista um valor e seu post será exibido para mais pessoas no feed. Quanto maior o investimento, maior o alcance.
          </p>
        </div>

        {/* Step 1: Select Post */}
        <div>
          <h3 className="text-sm font-semibold mb-3">1. Escolha o post</h3>
          <div className="grid grid-cols-3 gap-2">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post.id)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selectedPost === post.id
                    ? "border-primary glow"
                    : "border-transparent"
                }`}
              >
                {post.media_urls?.[0] ? (
                  <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-secondary text-xs text-muted-foreground p-2 text-center">
                    {post.caption?.slice(0, 30) || "Post"}
                  </div>
                )}
                {post.is_promoted && (
                  <div className="absolute top-1 right-1 bg-primary/80 rounded px-1 py-0.5">
                    <Zap className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
            {posts.length === 0 && (
              <p className="col-span-3 text-sm text-muted-foreground text-center py-8">
                Você não tem posts para promover
              </p>
            )}
          </div>
        </div>

        {/* Step 2: Select Budget */}
        {selectedPost && (
          <div>
            <h3 className="text-sm font-semibold mb-3">2. Escolha o orçamento</h3>
            <div className="space-y-2">
              {BUDGET_OPTIONS.map((option) => (
                <button
                  key={option.cents}
                  onClick={() => setSelectedBudget(option.cents)}
                  className={`w-full flex items-center justify-between rounded-xl p-4 border transition-all ${
                    selectedBudget === option.cents
                      ? "border-primary bg-primary/10 glow"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <DollarSign className={`h-5 w-5 ${selectedBudget === option.cents ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="text-left">
                      <p className="font-semibold">{option.label}</p>
                      <p className="text-xs text-muted-foreground">Alcance {option.reach}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{option.views}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary & CTA */}
        {selectedPost && selectedBudget && (
          <div className="space-y-4">
            <div className="rounded-xl bg-card p-4 border border-border">
              <h3 className="text-sm font-semibold mb-2">Resumo</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Orçamento</span>
                <span className="font-semibold">{BUDGET_OPTIONS.find((b) => b.cents === selectedBudget)?.label}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Alcance estimado</span>
                <span className="font-semibold">{BUDGET_OPTIONS.find((b) => b.cents === selectedBudget)?.views} pessoas</span>
              </div>
            </div>

            <Button
              onClick={handlePromote}
              disabled={submitting}
              className="w-full gradient-brand text-primary-foreground font-semibold h-12 rounded-xl"
            >
              {submitting ? "Processando..." : "Promover Agora 🚀"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromotePost;
