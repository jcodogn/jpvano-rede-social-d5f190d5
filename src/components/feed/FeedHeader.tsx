import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

const FeedHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
      <div className="flex items-center gap-2">
        <img src={logo} alt="JPvano" className="h-8 w-8 rounded-md" />
        <h1 className="font-display text-2xl font-bold">
          <span className="gradient-text">JPvano</span>
        </h1>
      </div>
      <button onClick={() => navigate("/messages")} className="text-foreground" aria-label="Mensagens">
        <MessageCircle className="h-6 w-6" />
      </button>
    </header>
  );
};

export default FeedHeader;
