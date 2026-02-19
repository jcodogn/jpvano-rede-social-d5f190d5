import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get IDs the user follows
      const { data: follows } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id)
        .eq("status", "accepted");

      const followingIds = (follows || []).map((f) => f.following_id);
      // Include user's own posts
      const ids = [...followingIds, user.id];

      // Fetch followed posts
      const { data: followedPosts } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, display_name)")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch active promoted posts (not from followed users, to add variety)
      const { data: promotedPosts } = await supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, display_name)")
        .eq("is_promoted", true)
        .not("user_id", "in", `(${ids.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Merge: insert a promoted post every 3 regular posts
      const regular = followedPosts || [];
      const promoted = promotedPosts || [];
      const merged: any[] = [];
      let promoIdx = 0;
      for (let i = 0; i < regular.length; i++) {
        merged.push(regular[i]);
        if ((i + 1) % 3 === 0 && promoIdx < promoted.length) {
          merged.push(promoted[promoIdx]);
          promoIdx++;
        }
      }
      // Add remaining promoted posts
      while (promoIdx < promoted.length) {
        merged.push(promoted[promoIdx]);
        promoIdx++;
      }

      setPosts(merged);
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

export default Feed;
