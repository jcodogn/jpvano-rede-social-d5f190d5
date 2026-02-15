import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";

const Explore = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExplorePosts = async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, media_urls, likes_count, media_type")
        .order("likes_count", { ascending: false })
        .limit(30);
      setPosts(data || []);
      setLoading(false);
    };
    fetchExplorePosts();
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
              <div className="h-11 w-11 rounded-full bg-secondary overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {user.username?.charAt(0)?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.username}</p>
                {user.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{user.display_name}</p>
                )}
              </div>
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
