import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, UserPlus, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const Explore = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      if (user) {
        const { data: follows } = await supabase
          .from("followers")
          .select("following_id")
          .eq("follower_id", user.id)
          .eq("status", "accepted");
        setFollowingIds(new Set((follows || []).map((f) => f.following_id)));
      }

      const { data } = await supabase
        .from("posts")
        .select("id, media_urls, likes_count, media_type")
        .order("likes_count", { ascending: false })
        .limit(30);
      setPosts(data || []);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${query}%`)
        .limit(20);
      setResults(data || []);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleFollow = async (targetId: string) => {
    if (!currentUserId || targetId === currentUserId) return;
    setToggling(targetId);

    const isFollowing = followingIds.has(targetId);

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetId);
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      toast.success("Deixou de seguir");
    } else {
      await supabase.from("followers").insert({
        follower_id: currentUserId,
        following_id: targetId,
        status: "accepted",
      });
      setFollowingIds((prev) => new Set(prev).add(targetId));
      toast.success("Seguindo!");
    }
    setToggling(null);
  };

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 bg-secondary border-none pl-10 text-sm placeholder:text-muted-foreground rounded-xl"
          />
        </div>
      </div>

      {query.trim() ? (
        <div className="px-4">
          {results.map((user) => (
            <div key={user.id} className="flex items-center gap-3 py-3 border-b border-border">
              <button onClick={() => navigate(`/user/${user.id}`)} className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-11 w-11 rounded-full bg-secondary overflow-hidden shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {user.username?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-left">{user.username}</p>
                  {user.display_name && (
                    <p className="text-xs text-muted-foreground truncate text-left">{user.display_name}</p>
                  )}
                </div>
              </button>
              {currentUserId && user.id !== currentUserId && (
                <Button
                  size="sm"
                  variant={followingIds.has(user.id) ? "secondary" : "brand"}
                  disabled={toggling === user.id}
                  onClick={(e) => { e.stopPropagation(); toggleFollow(user.id); }}
                  className="gap-1.5 text-xs"
                >
                  {followingIds.has(user.id) ? (
                    <><UserCheck className="h-3.5 w-3.5" /> Seguindo</>
                  ) : (
                    <><UserPlus className="h-3.5 w-3.5" /> Seguir</>
                  )}
                </Button>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-px">
          {loading ? (
            Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-secondary animate-pulse" />
            ))
          ) : posts.length === 0 ? (
            <div className="col-span-3 py-20 text-center text-sm text-muted-foreground">
              Nenhuma publicação ainda
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="aspect-square bg-secondary overflow-hidden">
                {post.media_urls?.[0] && (
                  <img src={post.media_urls[0]} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </AppLayout>
  );
};

export default Explore;
