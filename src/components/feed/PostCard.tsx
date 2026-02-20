import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface PostCardProps {
  post: any;
}

const PostCard = ({ post }: PostCardProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const profile = post.profiles;
  const inputRef = useRef<HTMLInputElement>(null);

  // Init: check if user liked/saved this post
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const [likeRes, saveRes] = await Promise.all([
        supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
        supabase.from("saved_posts").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
      ]);
      setLiked(!!likeRes.data);
      setSaved(!!saveRes.data);
    };
    init();
  }, [post.id]);

  // Realtime likes
  useEffect(() => {
    const channel = supabase
      .channel(`likes-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, (payload) => {
        if (payload.eventType === "INSERT") setLikesCount((c: number) => c + 1);
        if (payload.eventType === "DELETE") setLikesCount((c: number) => Math.max(0, c - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id]);

  // Realtime comments
  useEffect(() => {
    if (!showComments) return;
    const channel = supabase
      .channel(`comments-${post.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` }, async (payload) => {
        const newC = payload.new as any;
        if (comments.some((c) => c.id === newC.id)) return;
        const { data: prof } = await supabase.from("profiles").select("username, avatar_url").eq("id", newC.user_id).single();
        setComments((prev) => [...prev, { ...newC, profiles: prof }]);
        setCommentsCount((c: number) => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [post.id, showComments, comments]);

  const toggleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      setLiked(false);
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      setLiked(true);
      await supabase.from("likes").insert({ post_id: post.id, user_id: currentUserId });
      // Send notification to post owner
      if (post.user_id !== currentUserId) {
        await supabase.from("notifications").insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: "like",
          post_id: post.id,
        });
      }
    }
  };

  const toggleSave = async () => {
    if (!currentUserId) return;
    if (saved) {
      setSaved(false);
      await supabase.from("saved_posts").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      toast.success("Removido dos salvos");
    } else {
      setSaved(true);
      await supabase.from("saved_posts").insert({ post_id: post.id, user_id: currentUserId });
      toast.success("Salvo!");
    }
  };

  const loadComments = async () => {
    setShowComments(true);
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setComments(data || []);
  };

  const submitComment = async () => {
    if (!newComment.trim() || !currentUserId || sending) return;
    const content = newComment.trim();
    if (content.length > 500) return;
    setSending(true);
    setNewComment("");
    await supabase.from("comments").insert({ post_id: post.id, user_id: currentUserId, content });
    // Send notification to post owner
    if (post.user_id !== currentUserId) {
      await supabase.from("notifications").insert({
        user_id: post.user_id,
        actor_id: currentUserId,
        type: "comment",
        post_id: post.id,
      });
    }
    setSending(false);
  };

  return (
    <article className="border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(`/user/${post.user_id}`)} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {profile?.username?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{profile?.username}</p>
            {post.location && <p className="text-[11px] text-muted-foreground">{post.location}</p>}
          </div>
        </button>
        {post.is_promoted && <span className="text-[10px] font-medium text-muted-foreground">Patrocinado</span>}
        <button className="text-foreground"><MoreHorizontal className="h-5 w-5" /></button>
      </div>

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="aspect-square bg-secondary">
          {post.media_type === "video" || post.media_type === "reel" ? (
            <video src={post.media_urls[0]} className="h-full w-full object-cover" controls />
          ) : (
            <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike} className="transition-transform active:scale-125">
            <Heart className={`h-6 w-6 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
          </button>
          <button onClick={() => { if (!showComments) loadComments(); else setShowComments(false); inputRef.current?.focus(); }}>
            <MessageCircle className="h-6 w-6 text-foreground" />
          </button>
          <button><Send className="h-6 w-6 text-foreground" /></button>
        </div>
        <button onClick={toggleSave}>
          <Bookmark className={`h-6 w-6 ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} />
        </button>
      </div>

      {/* Likes & Caption */}
      <div className="px-4 pb-3">
        {likesCount > 0 && <p className="text-sm font-semibold">{likesCount.toLocaleString()} curtidas</p>}
        {post.caption && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">{profile?.username} </span>{post.caption}
          </p>
        )}
        {commentsCount > 0 && !showComments && (
          <button onClick={loadComments} className="mt-1 text-xs text-muted-foreground">
            Ver todos os {commentsCount} comentários
          </button>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-border">
          <div className="max-h-64 overflow-y-auto px-4 py-2 space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-secondary overflow-hidden shrink-0 mt-0.5">
                  {c.profiles?.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-muted-foreground">
                      {c.profiles?.username?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{c.profiles?.username} </span>
                    <span className="break-words">{c.content}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda</p>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-4 py-2">
            <Input
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
              placeholder="Adicione um comentário..."
              className="flex-1 border-none bg-transparent text-sm h-9 px-0 focus-visible:ring-0"
              maxLength={500}
            />
            <button
              onClick={submitComment}
              disabled={!newComment.trim() || sending}
              className="text-sm font-semibold text-primary disabled:opacity-40"
            >
              Publicar
            </button>
          </div>
        </div>
      )}
    </article>
  );
};

export default PostCard;
