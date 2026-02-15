import { MessageCircle, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FeedHeader = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
      <h1 className="font-display text-2xl font-bold">
        <span className="gradient-text">JPvano</span>
      </h1>
      <div className="flex items-center gap-3">
        <button className="text-foreground" aria-label="Novo story">
          <Camera className="h-6 w-6" />
        </button>
        <button onClick={() => navigate("/messages")} className="text-foreground" aria-label="Mensagens">
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
};

export default FeedHeader;
