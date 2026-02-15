import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/feed");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6">
      <div className="flex items-center pt-12 pb-8">
        <button onClick={() => navigate("/")} className="text-muted-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Bem-vindo de <span className="gradient-text">volta</span>
        </h1>
        <p className="mt-2 text-muted-foreground">Entre na sua conta para continuar</p>

        <form onSubmit={handleLogin} className="mt-10 space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 border-border bg-secondary pl-11 text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 border-border bg-secondary pl-11 pr-11 text-foreground placeholder:text-muted-foreground"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <button onClick={() => navigate("/register")} className="font-semibold text-primary">
            Criar conta
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
