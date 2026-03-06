import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Send, Music, Bookmark, MoreHorizontal, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Reels = () => {
  const navigate = useNavigate();
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, display_name)")
        .eq("media_type", "reel")
        .order("created_at", { ascending: false })
        .limit(50);

      setReels(data || []);

      if (user && data) {
        const postIds = data.map((r: any) => r.id);
        const [likesRes, savesRes] = await Promise.all([
          supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
          supabase.from("saved_posts").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        ]);
        setLiked(new Set((likesRes.data || []).map((l: any) => l.post_id)));
        setSaved(new Set((savesRes.data || []).map((s: any) => s.post_id)));
      }

      setLoading(false);
    };
    fetch();
  }, []);

  const toggleLike = async (postId: string, ownerId: string) => {
    if (!currentUserId) return;
    const isLiked = liked.has(postId);
    setLiked((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId); else next.add(postId);
      return next;
    });

    if (isLiked) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
    } else {
      await supabase.from("likes").insert({ post_id: postId, user_id: currentUserId });
      if (ownerId !== currentUserId) {
        await supabase.from("notifications").insert({ user_id: ownerId, actor_id: currentUserId, type: "like", post_id: postId });
      }
    }
  };

  const toggleSave = async (postId: string) => {
    if (!currentUserId) return;
    const isSaved = saved.has(postId);
    setSaved((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(postId); else next.add(postId);
      return next;
    });

    if (isSaved) {
      await supabase.from("saved_posts").delete().eq("post_id", postId).eq("user_id", currentUserId);
    } else {
      await supabase.from("saved_posts").insert({ post_id: postId, user_id: currentUserId });
      toast.success("Salvo!");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background">
      <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-50 text-foreground bg-background/50 rounded-full p-2 backdrop-blur-sm">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="absolute top-4 left-1/2 -translate-x-1/2 z-50 font-display text-lg font-bold">Reels</h1>

      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
      >
        {reels.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Nenhum reel ainda</p>
          </div>
        ) : (
          reels.map((reel) => (
            <div key={reel.id} className="relative h-screen w-full snap-start snap-always">
              {/* Video */}
              <video
                src={reel.media_urls?.[0]}
                className="h-full w-full object-cover"
                loop
                playsInline
                muted
                autoPlay
                onClick={(e) => {
                  const v = e.currentTarget;
                  v.muted ? (v.muted = false) : v.paused ? v.play() : v.pause();
                }}
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/30 pointer-events-none" />

              {/* Right actions */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                <button onClick={() => toggleLike(reel.id, reel.user_id)} className="flex flex-col items-center gap-1">
                  <Heart className={`h-7 w-7 ${liked.has(reel.id) ? "fill-primary text-primary" : "text-foreground"}`} />
                  <span className="text-xs font-medium">{reel.likes_count || 0}</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                  <MessageCircle className="h-7 w-7 text-foreground" />
                  <span className="text-xs font-medium">{reel.comments_count || 0}</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                  <Send className="h-7 w-7 text-foreground" />
                </button>
                <button onClick={() => toggleSave(reel.id)} className="flex flex-col items-center gap-1">
                  <Bookmark className={`h-7 w-7 ${saved.has(reel.id) ? "fill-foreground text-foreground" : "text-foreground"}`} />
                </button>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-6 left-4 right-16">
                <button onClick={() => navigate(`/user/${reel.user_id}`)} className="flex items-center gap-2 mb-2">
                  <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden">
                    {reel.profiles?.avatar_url ? (
                      <img src={reel.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                        {reel.profiles?.username?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold">{reel.profiles?.username}</span>
                </button>
                {reel.caption && <p className="text-sm line-clamp-2">{reel.caption}</p>}
                {reel.spotify_track_name && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Music className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs truncate">{reel.spotify_track_name} • {reel.spotify_artist_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Reels;
