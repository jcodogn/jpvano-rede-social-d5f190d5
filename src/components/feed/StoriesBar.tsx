import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

const StoriesBar = () => {
  const [stories, setStories] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setCurrentUser(profile);
      }
      // Fetch distinct users who have active stories
      const { data } = await supabase
        .from("stories")
        .select("user_id, profiles(username, avatar_url)")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      
      // Deduplicate by user
      const seen = new Set();
      const unique = (data || []).filter((s: any) => {
        if (seen.has(s.user_id)) return false;
        seen.add(s.user_id);
        return true;
      });
      setStories(unique);
    };
    fetchData();
  }, []);

  return (
    <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4 py-3">
      {/* Your story */}
      <div className="flex flex-col items-center gap-1">
        <div className="relative h-16 w-16 rounded-full bg-secondary">
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary text-muted-foreground text-lg font-semibold">
              {currentUser?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 gradient-brand rounded-full p-0.5">
            <Plus className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </div>
        <span className="w-16 truncate text-center text-[10px] text-muted-foreground">Seu story</span>
      </div>

      {/* Other stories */}
      {stories.map((story) => (
        <div key={story.user_id} className="flex flex-col items-center gap-1">
          <div className="gradient-border rounded-full p-[2px]">
            <div className="h-[60px] w-[60px] rounded-full bg-background p-[2px]">
              {story.profiles?.avatar_url ? (
                <img src={story.profiles.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-secondary text-muted-foreground text-sm font-semibold">
                  {story.profiles?.username?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
            </div>
          </div>
          <span className="w-16 truncate text-center text-[10px] text-muted-foreground">
            {story.profiles?.username}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StoriesBar;
