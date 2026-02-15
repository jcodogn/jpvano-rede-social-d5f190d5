import AppLayout from "@/components/layout/AppLayout";
import { Edit } from "lucide-react";

const Messages = () => {
  return (
    <AppLayout hideNav>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <h1 className="font-display text-xl font-bold">Mensagens</h1>
        <button className="text-foreground">
          <Edit className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="gradient-brand rounded-2xl p-4 mb-4">
          <Edit className="h-8 w-8 text-primary-foreground" />
        </div>
        <h2 className="font-display text-lg font-semibold">Suas mensagens</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie mensagens privadas para seus amigos
        </p>
      </div>
    </AppLayout>
  );
};

export default Messages;
