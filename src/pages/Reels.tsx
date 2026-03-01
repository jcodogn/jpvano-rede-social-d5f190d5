import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Send, Music, Bookmark, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const Reels = () => {
  const navigate = useNavigate();
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReels = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, display_name)")
        .eq("media_type", "reel")
        .order("created_at", { ascending: false })
        .limit(50);
      setReels(data || []);
      setLoading(false);
    };
    fetchReels();
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const idx = Math.round(scrollTop / height);
    setCurrentIndex(idx);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <Music className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-lg font-semibold">Nenhum Reel ainda</h2>
        <p className="text-sm text-muted-foreground mt-1">Crie o primeiro reel da plataforma!</p>
        <button onClick={() => navigate("/create")} className="mt-4 gradient-brand rounded-xl px-6 py-2.5 text-sm font-semibold text-primary-foreground">
          Criar Reel
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={() => navigate(-1)} className="text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-lg font-bold text-white">Reels</h1>
        <div className="w-6" />
      </div>

      {/* Vertical scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
      >
        {reels.map((reel, idx) => (
          <ReelItem key={reel.id} reel={reel} isActive={idx === currentIndex} />
        ))}
      </div>
    </div>
  );
};

const ReelItem = ({ reel, isActive }: { reel: any; isActive: boolean }) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const [saved, setSaved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const profile = reel.profiles;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const [likeRes, saveRes] = await Promise.all([
        supabase.from("likes").select("id").eq("post_id", reel.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("saved_posts").select("id").eq("post_id", reel.id).eq("user_id", user.id).maybeSingle(),
      ]);
      setLiked(!!likeRes.data);
      setSaved(!!saveRes.data);
    };
    init();
  }, [reel.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const toggleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      setLiked(false);
      setLikesCount((c: number) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("post_id", reel.id).eq("user_id", currentUserId);
    } else {
      setLiked(true);
      setLikesCount((c: number) => c + 1);
      await supabase.from("likes").insert({ post_id: reel.id, user_id: currentUserId });
      if (reel.user_id !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: reel.user_id, actor_id: currentUserId, type: "like", post_id: reel.id,
        });
      }
    }
  };

  const toggleSave = async () => {
    if (!currentUserId) return;
    if (saved) {
      setSaved(false);
      await supabase.from("saved_posts").delete().eq("post_id", reel.id).eq("user_id", currentUserId);
    } else {
      setSaved(true);
      await supabase.from("saved_posts").insert({ post_id: reel.id, user_id: currentUserId });
      toast.success("Salvo!");
    }
  };

  return (
    <div className="relative h-screen w-full snap-start flex items-center justify-center bg-black">
      {/* Video */}
      {reel.media_urls?.[0] && (
        <video
          ref={videoRef}
          src={reel.media_urls[0]}
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
        />
      )}

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          <span className="text-xs text-white font-medium">{likesCount}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-xs text-white font-medium">{reel.comments_count || 0}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Send className="h-7 w-7 text-white" />
        </button>
        <button onClick={toggleSave} className="flex flex-col items-center gap-1">
          <Bookmark className={`h-7 w-7 ${saved ? "fill-white text-white" : "text-white"}`} />
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-4 right-16 z-10">
        <button onClick={() => navigate(`/user/${reel.user_id}`)} className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-full bg-secondary overflow-hidden border-2 border-white/50">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white bg-muted">
                {profile?.username?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-sm font-bold text-white drop-shadow">{profile?.username}</span>
        </button>
        {reel.caption && (
          <p className="text-sm text-white drop-shadow line-clamp-2">{reel.caption}</p>
        )}
        {reel.spotify_track_name && (
          <div className="flex items-center gap-2 mt-2">
            <Music className="h-3.5 w-3.5 text-white shrink-0" />
            <p className="text-xs text-white/80 truncate">
              {reel.spotify_track_name} • {reel.spotify_artist_name}
            </p>
          </div>
        )}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
};

export default Reels;
