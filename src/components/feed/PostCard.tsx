import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostCardProps {
  post: any;
}

const PostCard = ({ post }: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const profile = post.profiles;

  return (
    <article className="border-b border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
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
            {post.location && (
              <p className="text-[11px] text-muted-foreground">{post.location}</p>
            )}
          </div>
        </div>
        {post.is_promoted && (
          <span className="text-[10px] font-medium text-muted-foreground">Patrocinado</span>
        )}
        <button className="text-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="aspect-square bg-secondary">
          <img
            src={post.media_urls[0]}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setLiked(!liked)} className="transition-transform active:scale-125">
            <Heart
              className={`h-6 w-6 ${liked ? "fill-primary text-primary" : "text-foreground"}`}
            />
          </button>
          <button>
            <MessageCircle className="h-6 w-6 text-foreground" />
          </button>
          <button>
            <Send className="h-6 w-6 text-foreground" />
          </button>
        </div>
        <button onClick={() => setSaved(!saved)}>
          <Bookmark className={`h-6 w-6 ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} />
        </button>
      </div>

      {/* Likes & Caption */}
      <div className="px-4 pb-3">
        {post.likes_count > 0 && (
          <p className="text-sm font-semibold">{post.likes_count.toLocaleString()} curtidas</p>
        )}
        {post.caption && (
          <p className="mt-1 text-sm">
            <span className="font-semibold">{profile?.username} </span>
            {post.caption}
          </p>
        )}
        {post.comments_count > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ver todos os {post.comments_count} comentários
          </p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </article>
  );
};

export default PostCard;
