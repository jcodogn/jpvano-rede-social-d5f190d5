import { Home, Search, PlusSquare, Heart, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotificationCount } from "@/hooks/useNotificationCount";

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
  const { count } = useNotificationCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map(({ icon: Icon, path, label }) => {
          const isActive = location.pathname === path;
          const isCreate = path === "/create";
          const isNotif = path === "/notifications";

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`relative flex flex-col items-center gap-0.5 p-2 transition-all duration-200 ${
                isCreate ? "" : isActive ? "text-foreground" : "text-muted-foreground"
              }`}
              aria-label={label}
            >
              {isCreate ? (
                <div className="gradient-brand rounded-lg p-1.5">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <div className="relative">
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.5} />
                  {isNotif && count > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </div>
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
