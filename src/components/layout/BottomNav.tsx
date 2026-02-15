import { Home, Search, PlusSquare, Heart, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { icon: Home, path: "/feed", label: "Feed" },
  { icon: Search, path: "/explore", label: "Explorar" },
  { icon: PlusSquare, path: "/create", label: "Criar" },
  { icon: Heart, path: "/notifications", label: "Notificações" },
  { icon: User, path: "/profile", label: "Perfil" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map(({ icon: Icon, path, label }) => {
          const isActive = location.pathname === path;
          const isCreate = path === "/create";

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 p-2 transition-all duration-200 ${
                isCreate ? "" : isActive ? "text-foreground" : "text-muted-foreground"
              }`}
              aria-label={label}
            >
              {isCreate ? (
                <div className="gradient-brand rounded-lg p-1.5">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.5} />
              )}
              {!isCreate && (
                <span className="text-[10px] font-medium">{label}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
