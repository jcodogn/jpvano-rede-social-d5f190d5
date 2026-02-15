import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import StoriesBar from "@/components/feed/StoriesBar";
import PostCard from "@/components/feed/PostCard";
import FeedHeader from "@/components/feed/FeedHeader";

const Feed = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, display_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts(data || []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  return (
    <AppLayout>
      <FeedHeader />
      <StoriesBar />
      <div className="border-t border-border">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="gradient-brand rounded-2xl p-4 mb-4">
              <Camera className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-lg font-semibold">Seu feed está vazio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Siga pessoas para ver suas publicações aqui
            </p>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </AppLayout>
  );
};

import { Camera } from "lucide-react";
export default Feed;
