import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Image, Film, MapPin } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";

const CreatePost = () => {
  const navigate = useNavigate();
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "reel">("image");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    toast.info("Para publicar, primeiro faça upload de mídia no armazenamento.");
  };

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-lg font-bold">Nova publicação</h1>
        <Button variant="ghost" size="sm" onClick={handleCreate} disabled={loading} className="text-primary font-semibold">
          Publicar
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
        <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/50">
          <div className="text-center">
            <Image className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Toque para selecionar mídia</p>
          </div>
        </div>

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
