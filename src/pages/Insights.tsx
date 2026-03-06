import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { ArrowLeft, TrendingUp, Heart, MessageCircle, Users, Eye, BarChart3 } from "lucide-react";

const Insights = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLikes: 0,
    totalComments: 0,
    followers: 0,
    following: 0,
    postsCount: 0,
    weeklyFollowers: 0,
    topPosts: [] as any[],
  });

  useEffect(() => {
    const fetchInsights = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [postsRes, followersRes, followingRes, weeklyFollowersRes] = await Promise.all([
        supabase.from("posts").select("id, likes_count, comments_count, media_urls, caption, created_at").eq("user_id", user.id).order("likes_count", { ascending: false }).limit(50),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id).eq("status", "accepted"),
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id).eq("status", "accepted"),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id).eq("status", "accepted").gte("created_at", weekAgo),
      ]);

      const posts = postsRes.data || [];
      const totalLikes = posts.reduce((sum, p) => sum + (p.likes_count || 0), 0);
      const totalComments = posts.reduce((sum, p) => sum + (p.comments_count || 0), 0);

      setStats({
        totalLikes,
        totalComments,
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        postsCount: posts.length,
        weeklyFollowers: weeklyFollowersRes.count || 0,
        topPosts: posts.slice(0, 6),
      });

      setLoading(false);
    };
    fetchInsights();
  }, [navigate]);

  const engagementRate = stats.followers > 0
    ? (((stats.totalLikes + stats.totalComments) / (stats.postsCount || 1)) / stats.followers * 100).toFixed(1)
    : "0.0";

  if (loading) {
    return (
      <AppLayout hideNav>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Insights</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: "Seguidores", value: stats.followers.toLocaleString(), sub: `+${stats.weeklyFollowers} esta semana` },
            { icon: TrendingUp, label: "Engajamento", value: `${engagementRate}%`, sub: "Taxa média" },
            { icon: Heart, label: "Curtidas Totais", value: stats.totalLikes.toLocaleString(), sub: `Em ${stats.postsCount} posts` },
            { icon: MessageCircle, label: "Comentários", value: stats.totalComments.toLocaleString(), sub: "Total acumulado" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <Icon className="h-5 w-5 text-primary mb-2" />
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-[10px] text-primary mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Overview */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-display font-semibold mb-3">Resumo da Conta</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total de publicações</span>
              <span className="font-semibold">{stats.postsCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seguidores</span>
              <span className="font-semibold">{stats.followers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seguindo</span>
              <span className="font-semibold">{stats.following}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Média de curtidas/post</span>
              <span className="font-semibold">{stats.postsCount > 0 ? Math.round(stats.totalLikes / stats.postsCount) : 0}</span>
            </div>
          </div>
        </div>

        {/* Top Posts */}
        <div>
          <h3 className="font-display font-semibold mb-3">Posts com Melhor Desempenho</h3>
          <div className="grid grid-cols-3 gap-1">
            {stats.topPosts.map((post) => (
              <div key={post.id} className="relative aspect-square bg-secondary overflow-hidden rounded-md">
                {post.media_urls?.[0] && (
                  <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{post.likes_count || 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.comments_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Insights;
