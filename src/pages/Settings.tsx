import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, User, Bell, Shield, Lock, HelpCircle, LogOut, BarChart3, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";

const settingsItems = [
  { icon: User, label: "Editar perfil", path: "/edit-profile" },
  { icon: BarChart3, label: "Insights", path: "/insights" },
  { icon: Bell, label: "Notificações", path: "/notifications" },
  { icon: ShieldCheck, label: "Painel Admin", path: "/admin" },
  { icon: Shield, label: "Privacidade", path: "#" },
  { icon: Lock, label: "Segurança", path: "#" },
  { icon: HelpCircle, label: "Ajuda", path: "#" },
];

const SettingsPage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-background px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="font-display text-xl font-bold">Configurações</h1>
      </header>

      <div className="py-2">
        {settingsItems.map(({ icon: Icon, label, path }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-foreground hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">{label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}

        <div className="my-2 border-t border-border" />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-destructive hover:bg-secondary/50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sair da conta</span>
        </button>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
