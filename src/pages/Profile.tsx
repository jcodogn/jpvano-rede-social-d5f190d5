import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Settings, Grid3X3, Bookmark, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "saved">("posts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", user.id).eq("status", "accepted"),
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", user.id).eq("status", "accepted"),
      ]);

      setProfile(profileRes.data);
      setPosts(postsRes.data || []);
      setStats({
        posts: postsRes.data?.length || 0,
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
      });
      setLoading(false);
    };
    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-display text-lg font-bold">{profile?.username}</h2>
        <button onClick={() => navigate("/settings")} className="text-foreground">
          <Settings className="h-6 w-6" />
        </button>
      </header>

      {/* Profile Info */}
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

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => navigate("/edit-profile")}>Editar perfil</Button>
          <Button variant="secondary" size="sm" onClick={handleLogout}>Sair</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-t border-border">
        {[
          { key: "posts" as const, icon: Grid3X3 },
          { key: "reels" as const, icon: Film },
          { key: "saved" as const, icon: Bookmark },
        ].map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex justify-center py-3 border-b-2 transition-colors ${
              activeTab === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>

      {/* Grid */}
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

export default Profile;
