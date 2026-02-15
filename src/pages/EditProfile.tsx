import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const EditProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setAvatarUrl(data.avatar_url);
        setUsername(data.username || "");
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 104857600) {
      toast({ title: "Arquivo muito grande", description: "Máximo 100 MB", variant: "destructive" });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast({ title: "Username obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let newAvatarUrl = avatarUrl;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
        newAvatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase.from("profiles").update({
        username: username.trim().toLowerCase().replace(/\s/g, "_"),
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
        avatar_url: newAvatarUrl,
      }).eq("id", userId);

      if (error) throw error;

      toast({ title: "Perfil atualizado!" });
      navigate("/profile");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout hideNav>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  const displayAvatar = avatarPreview || avatarUrl;

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-foreground">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="font-display text-lg font-bold">Editar perfil</h1>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative h-24 w-24 rounded-full bg-secondary overflow-hidden group"
          >
            {displayAvatar ? (
              <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
                {username?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm font-medium text-primary"
          >
            Alterar foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="seu_username" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nome</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte sobre você..." rows={3} maxLength={300} />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/300</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Website</label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://seusite.com" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EditProfile;
