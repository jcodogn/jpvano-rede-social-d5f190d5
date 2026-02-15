import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Image, Film, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const CreatePost = () => {
  const navigate = useNavigate();
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "reel">("image");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isVideo = selected.type.startsWith("video/");
    const isImage = selected.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Selecione uma imagem ou vídeo válido");
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 50MB)");
      return;
    }

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    if (isVideo) setMediaType("video");
  };

  const handleCreate = async () => {
    if (!file) {
      toast.error("Selecione uma foto ou vídeo primeiro");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("posts")
        .getPublicUrl(filePath);

      const { error: postError } = await supabase.from("posts").insert({
        user_id: user.id,
        media_urls: [publicUrl],
        media_type: mediaType,
        caption: caption || null,
        location: location || null,
      });

      if (postError) throw postError;

      toast.success("Publicado com sucesso!");
      navigate("/feed");
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar");
    } finally {
      setLoading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-lg font-bold">Nova publicação</h1>
        <Button variant="ghost" size="sm" onClick={handleCreate} disabled={loading || !file} className="text-primary font-semibold">
          {loading ? "Enviando..." : "Publicar"}
        </Button>
      </header>

      <div className="p-4 space-y-4">
        {/* Media type selector */}
        <div className="flex gap-2">
          {[
            { key: "image" as const, icon: Image, label: "Foto" },
            { key: "video" as const, icon: Film, label: "Vídeo" },
            { key: "reel" as const, icon: Film, label: "Reel" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setMediaType(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                mediaType === key ? "gradient-brand text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Upload area */}
        <input
          ref={fileInputRef}
          type="file"
          accept={mediaType === "image" ? "image/*" : "video/*"}
          className="hidden"
          onChange={handleFileSelect}
        />

        {preview ? (
          <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
            <button onClick={clearFile} className="absolute top-2 right-2 z-10 rounded-full bg-background/80 p-1.5">
              <X className="h-4 w-4" />
            </button>
            {file?.type.startsWith("video/") ? (
              <video src={preview} className="h-full w-full object-cover" controls />
            ) : (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/50"
          >
            <div className="text-center">
              <Image className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Toque para selecionar mídia</p>
            </div>
          </button>
        )}

        <Textarea
          placeholder="Escreva uma legenda..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="min-h-[80px] border-border bg-secondary placeholder:text-muted-foreground resize-none"
        />

        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Adicionar localização"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-11 border-border bg-secondary pl-10 placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default CreatePost;
