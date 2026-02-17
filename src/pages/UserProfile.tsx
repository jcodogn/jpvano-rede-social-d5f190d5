import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { ArrowLeft, Grid3X3, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // If viewing own profile, redirect
      if (user?.id === userId) {
        navigate("/profile", { replace: true });
        return;
      }

      const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", userId).eq("status", "accepted"),
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", userId).eq("status", "accepted"),
      ]);

      if (!profileRes.data) {
        navigate("/explore", { replace: true });
        return;
      }

      setProfile(profileRes.data);
      setPosts(postsRes.data || []);
      setStats({
        posts: postsRes.data?.length || 0,
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
      });

      // Check if current user follows this user
      if (user) {
        const { data: followData } = await supabase
          .from("followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .eq("status", "accepted")
          .maybeSingle();
        setIsFollowing(!!followData);
      }

      setLoading(false);
    };
    fetch();
  }, [userId, navigate]);

  const toggleFollow = async () => {
    if (!currentUserId || !userId || toggling) return;
    setToggling(true);

    if (isFollowing) {
      await supabase.from("followers").delete().eq("follower_id", currentUserId).eq("following_id", userId);
      setIsFollowing(false);
      setStats((s) => ({ ...s, followers: Math.max(0, s.followers - 1) }));
      toast.success("Deixou de seguir");
    } else {
      await supabase.from("followers").insert({ follower_id: currentUserId, following_id: userId, status: "accepted" });
      setIsFollowing(true);
      setStats((s) => ({ ...s, followers: s.followers + 1 }));
      toast.success("Seguindo!");
    }
    setToggling(false);
  };

  const startMessage = async () => {
    if (!currentUserId || !userId) return;

    // Check for existing conversation
    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (myConvos && myConvos.length > 0) {
      const convoIds = myConvos.map((c) => c.conversation_id);
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId)
        .in("conversation_id", convoIds);

      if (shared && shared.length > 0) {
        navigate("/messages", { state: { openConvoWith: userId } });
        return;
      }
    }

    // Create new conversation
    const { data: convo } = await supabase.from("conversations").insert({}).select("id").single();
    if (!convo) return;

    await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: currentUserId },
      { conversation_id: convo.id, user_id: userId },
    ]);

    navigate("/messages", { state: { openConvoWith: userId } });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="font-display text-lg font-bold">{profile?.username}</h2>
      </header>

      <div className="px-4 py-4">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 shrink-0 rounded-full bg-secondary overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {profile?.username?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-1 justify-around text-center">
            <div>
              <p className="text-lg font-bold">{stats.posts}</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.followers}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.following}</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm font-semibold">{profile?.display_name}</p>
          {profile?.bio && <p className="mt-0.5 text-sm text-muted-foreground">{profile.bio}</p>}
          {profile?.website && (
            <a href={profile.website} className="text-sm text-primary font-medium" target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          )}
        </div>

        {currentUserId && (
          <div className="mt-4 flex gap-2">
            <Button
              variant={isFollowing ? "secondary" : "brand"}
              size="sm"
              className="flex-1 gap-1.5"
              onClick={toggleFollow}
              disabled={toggling}
            >
              {isFollowing ? (
                <><UserCheck className="h-4 w-4" /> Seguindo</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Seguir</>
              )}
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={startMessage}>
              <MessageCircle className="h-4 w-4" /> Mensagem
            </Button>
          </div>
        )}
      </div>

      <div className="flex border-t border-border">
        <div className="flex-1 flex justify-center py-3 border-b-2 border-foreground text-foreground">
          <Grid3X3 className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px">
        {posts.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
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
    </AppLayout>
  );
};

export default UserProfile;
