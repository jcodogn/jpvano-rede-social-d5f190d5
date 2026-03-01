import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import CallModal from "./CallModal";

interface IncomingCall {
  conversationId: string;
  callerId: string;
  callerUsername: string;
  callerAvatar: string | null;
  callType: "voice" | "video";
}

const IncomingCallListener = ({ currentUserId }: { currentUserId: string | null }) => {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`incoming-calls-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `callee_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          if (signal.signal_type !== "call-request") return;
          if (incomingCall) return; // Already in a call

          // Fetch caller profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", signal.caller_id)
            .single();

          if (!profile) return;

          setIncomingCall({
            conversationId: signal.conversation_id,
            callerId: signal.caller_id,
            callerUsername: profile.username,
            callerAvatar: profile.avatar_url,
            callType: signal.call_type || "voice",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, incomingCall]);

  if (!incomingCall || !currentUserId) return null;

  return (
    <CallModal
      conversationId={incomingCall.conversationId}
      currentUserId={currentUserId}
      otherUser={{
        id: incomingCall.callerId,
        username: incomingCall.callerUsername,
        avatar_url: incomingCall.callerAvatar,
      }}
      callType={incomingCall.callType}
      isIncoming
      onClose={() => setIncomingCall(null)}
    />
  );
};

export default IncomingCallListener;
