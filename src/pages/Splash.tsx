import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

const Splash = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-background px-6 py-16">
      <div />

      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="gradient-brand rounded-2xl p-4 glow">
          <Camera className="h-12 w-12 text-primary-foreground" />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight">
          <span className="gradient-text">JPvano</span>
        </h1>
        <p className="max-w-[260px] text-center text-sm text-muted-foreground leading-relaxed">
          Compartilhe momentos, conecte-se com pessoas e descubra o que está acontecendo.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button variant="brand" size="lg" className="w-full" onClick={() => navigate("/register")}>
          Criar conta
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => navigate("/login")}>
          Entrar
        </Button>
      </div>
    </div>
  );
};

export default Splash;
