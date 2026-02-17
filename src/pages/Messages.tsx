import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Send, Search, Mic, Square, Play, Pause } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Conversation {
  id: string;
  otherUser: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageType?: string;
  unread: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  media_url: string | null;
}

const AudioPlayer = ({ url }: { url: string }) => {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => setCurrent(audio.currentTime));
    audio.addEventListener("ended", () => { setPlaying(false); setCurrent(0); });
    return () => { audio.pause(); audio.src = ""; };
  }, [url]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className="shrink-0">
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex-1 h-1 bg-current/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-current rounded-full transition-all"
          style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
        />
      </div>
      <span className="text-[10px] tabular-nums shrink-0">{fmt(current || duration)}</span>
    </div>
  );
};

const Messages = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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

  // Handle opening a conversation from UserProfile navigation
  useEffect(() => {
    const state = location.state as { openConvoWith?: string } | null;
    if (state?.openConvoWith && currentUserId && conversations.length > 0) {
      const existing = conversations.find((c) => c.otherUser.id === state.openConvoWith);
      if (existing) {
        setActiveConvo(existing);
        // Clear the state
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, currentUserId, conversations]);

  const loadConversations = async (userId: string) => {
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      setConversations([]);
      return;
    }

    const convoIds = participations.map((p) => p.conversation_id);

    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convoIds)
      .neq("user_id", userId);

    if (!allParticipants) return;

    const otherUserIds = [...new Set(allParticipants.map((p) => p.user_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", otherUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const { data: latestMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at, sender_id, is_read, message_type")
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
        lastMessage: latest?.message_type === "audio" ? "🎤 Áudio" : latest?.content,
        lastMessageAt: latest?.created_at,
        lastMessageType: latest?.message_type,
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

  useEffect(() => {
    if (!activeConvo) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("id, content, sender_id, created_at, message_type, media_url")
        .eq("conversation_id", activeConvo.id)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    };
    loadMessages();

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

    const existing = conversations.find((c) => c.otherUser.id === targetUserId);
    if (existing) {
      setActiveConvo(existing);
      setShowNewChat(false);
      setSearchQuery("");
      return;
    }

    const { data: convo, error } = await supabase
      .from("conversations")
      .insert({})
      .select("id")
      .single();

    if (error || !convo) return;

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
      message_type: "text",
    });

    setSending(false);
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) return; // Too short

        await sendAudioMessage(blob);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const sendAudioMessage = async (blob: Blob) => {
    if (!activeConvo || !currentUserId) return;
    setSending(true);

    const fileName = `${currentUserId}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from("audio-messages")
      .upload(fileName, blob, { contentType: "audio/webm" });

    if (uploadError) {
      toast.error("Erro ao enviar áudio");
      setSending(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("audio-messages")
      .getPublicUrl(fileName);

    await supabase.from("messages").insert({
      conversation_id: activeConvo.id,
      sender_id: currentUserId,
      content: "🎤 Áudio",
      message_type: "audio",
      media_url: urlData.publicUrl,
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

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Chat view
  if (activeConvo) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <button onClick={() => setActiveConvo(null)} className="text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <button onClick={() => navigate(`/user/${activeConvo.otherUser.id}`)} className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar user={activeConvo.otherUser} size="h-9 w-9" />
            <p className="text-sm font-semibold truncate">{activeConvo.otherUser.username}</p>
          </button>
        </header>

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
                  {msg.message_type === "audio" && msg.media_url ? (
                    <AudioPlayer url={msg.media_url} />
                  ) : (
                    <p className="break-words">{msg.content}</p>
                  )}
                  <p className={`mt-1 text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3">
          {isRecording ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">Gravando {fmtTime(recordingTime)}</span>
              </div>
              <Button size="icon" variant="destructive" onClick={stopRecording} className="shrink-0 rounded-full h-10 w-10">
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Mensagem..."
                className="flex-1 rounded-full border-border bg-secondary"
                maxLength={2000}
              />
              {newMessage.trim() ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={sendMessage}
                  disabled={sending}
                  className="text-primary shrink-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={startRecording}
                  disabled={sending}
                  className="text-primary shrink-0"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
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
