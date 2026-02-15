import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Send, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  otherUser: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  lastMessage?: string;
  lastMessageAt?: string;
  unread: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

const Messages = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load current user and conversations
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      await loadConversations(user.id);
      setLoading(false);
    };
    init();
  }, []);

  const loadConversations = async (userId: string) => {
    // Get conversations the user participates in
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      setConversations([]);
      return;
    }

    const convoIds = participations.map((p) => p.conversation_id);

    // Get other participants
    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds)
      .neq("user_id", userId);

    if (!allParticipants) return;

    const otherUserIds = [...new Set(allParticipants.map((p) => p.user_id))];

    // Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", otherUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Get latest message per conversation
    const { data: latestMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id, is_read")
      .in("conversation_id", convoIds)
      .order("created_at", { ascending: false });

    const latestByConvo = new Map<string, any>();
    for (const msg of latestMessages || []) {
      if (!latestByConvo.has(msg.conversation_id)) {
        latestByConvo.set(msg.conversation_id, msg);
      }
    }

    const convos: Conversation[] = [];
    for (const p of allParticipants) {
      const profile = profileMap.get(p.user_id);
      if (!profile) continue;
      const latest = latestByConvo.get(p.conversation_id);
      convos.push({
        id: p.conversation_id,
        otherUser: profile,
        lastMessage: latest?.content,
        lastMessageAt: latest?.created_at,
        unread: latest ? !latest.is_read && latest.sender_id !== userId : false,
      });
    }

    convos.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(convos);
  };

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConvo) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, sender_id, created_at")
        .eq("conversation_id", activeConvo.id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    };
    loadMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat-${activeConvo.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConvo.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvo]);

  // Search users for new chat
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .neq("id", currentUserId || "")
        .ilike("username", `%${searchQuery}%`)
        .limit(15);
      setSearchResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const startConversation = async (targetUserId: string, targetProfile: any) => {
    if (!currentUserId) return;

    // Check if conversation already exists
    const existing = conversations.find((c) => c.otherUser.id === targetUserId);
    if (existing) {
      setActiveConvo(existing);
      setShowNewChat(false);
      setSearchQuery("");
      return;
    }

    // Create new conversation
    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({})
      .select("id")
      .single();

    if (error || !convo) return;

    // Add both participants
    await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: currentUserId },
      { conversation_id: convo.id, user_id: targetUserId },
    ]);

    const newConvo: Conversation = {
      id: convo.id,
      otherUser: targetProfile,
      unread: false,
    };

    setConversations((prev) => [newConvo, ...prev]);
    setActiveConvo(newConvo);
    setShowNewChat(false);
    setSearchQuery("");
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConvo || !currentUserId || sending) return;
    const content = newMessage.trim();
    if (content.length > 2000) return;
    
    setSending(true);
    setNewMessage("");

    await supabase.from("messages").insert({
      conversation_id: activeConvo.id,
      sender_id: currentUserId,
      content,
    });

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const Avatar = ({ user, size = "h-12 w-12" }: { user: any; size?: string }) => (
    <div className={`${size} rounded-full bg-secondary overflow-hidden shrink-0`}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
          {user.username?.charAt(0)?.toUpperCase()}
        </div>
      )}
    </div>
  );

  // Chat view
  if (activeConvo) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Chat header */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <button onClick={() => setActiveConvo(null)} className="text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <Avatar user={activeConvo.otherUser} size="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{activeConvo.otherUser.username}</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? "gradient-brand text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={`mt-1 text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem..."
              className="flex-1 rounded-full border-border bg-secondary"
              maxLength={2000}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="text-primary shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // New chat search view
  if (showNewChat) {
    return (
      <AppLayout hideNav>
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <button onClick={() => { setShowNewChat(false); setSearchQuery(""); }} className="text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="font-display text-lg font-bold">Nova mensagem</h1>
        </header>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-secondary border-none pl-10 rounded-xl"
              autoFocus
            />
          </div>
        </div>
        <div className="px-4">
          {searchResults.map((user) => (
            <button
              key={user.id}
              onClick={() => startConversation(user.id, user)}
              className="flex w-full items-center gap-3 py-3 border-b border-border text-left"
            >
              <Avatar user={user} size="h-11 w-11" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.username}</p>
                {user.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{user.display_name}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </AppLayout>
    );
  }

  // Conversation list view
  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/feed")} className="text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="font-display text-xl font-bold">Mensagens</h1>
        </div>
        <button onClick={() => setShowNewChat(true)} className="text-foreground">
          <Edit className="h-5 w-5" />
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="gradient-brand rounded-2xl p-4 mb-4">
            <Edit className="h-8 w-8 text-primary-foreground" />
          </div>
          <h2 className="font-display text-lg font-semibold">Suas mensagens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie mensagens privadas para seus amigos
          </p>
          <Button variant="brand" className="mt-4" onClick={() => setShowNewChat(true)}>
            Iniciar conversa
          </Button>
        </div>
      ) : (
        <div>
          {conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => setActiveConvo(convo)}
              className="flex w-full items-center gap-3 px-4 py-3 border-b border-border text-left hover:bg-secondary/50 transition-colors"
            >
              <Avatar user={convo.otherUser} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate ${convo.unread ? "font-bold" : "font-semibold"}`}>
                    {convo.otherUser.username}
                  </p>
                  {convo.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: false, locale: ptBR })}
                    </span>
                  )}
                </div>
                {convo.lastMessage && (
                  <p className={`text-xs truncate ${convo.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {convo.lastMessage}
                  </p>
                )}
              </div>
              {convo.unread && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default Messages;
