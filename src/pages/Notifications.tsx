import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Heart, UserPlus, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Notifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*, profiles!notifications_actor_id_fkey(username, avatar_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications(data || []);
      setLoading(false);
    };
    fetchNotifications();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return <Heart className="h-4 w-4 text-primary" />;
      case "follow": return <UserPlus className="h-4 w-4 text-accent" />;
      case "comment": return <MessageCircle className="h-4 w-4 text-foreground" />;
      default: return <Heart className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMessage = (type: string, username: string) => {
    switch (type) {
      case "like": return <><span className="font-semibold">{username}</span> curtiu sua publicação</>;
      case "follow": return <><span className="font-semibold">{username}</span> começou a seguir você</>;
      case "comment": return <><span className="font-semibold">{username}</span> comentou na sua publicação</>;
      default: return <><span className="font-semibold">{username}</span> interagiu com você</>;
    }
  };

  return (
    <AppLayout>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <h1 className="font-display text-xl font-bold">Notificações</h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <Heart className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-display text-lg font-semibold">Nenhuma notificação</h2>
          <p className="mt-1 text-sm text-muted-foreground">Quando alguém interagir com você, aparecerá aqui</p>
        </div>
      ) : (
        <div>
          {notifications.map((n) => (
            <div key={n.id} className={`flex items-center gap-3 px-4 py-3 ${!n.is_read ? "bg-secondary/50" : ""}`}>
              <div className="h-10 w-10 rounded-full bg-secondary overflow-hidden shrink-0">
                {n.profiles?.avatar_url ? (
                  <img src={n.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                    {n.profiles?.username?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {getMessage(n.type, n.profiles?.username || "alguém")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div>{getIcon(n.type)}</div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Notifications;
