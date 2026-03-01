import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallModalProps {
  conversationId: string;
  currentUserId: string;
  otherUser: { id: string; username: string; avatar_url: string | null };
  callType: "voice" | "video";
  isIncoming?: boolean;
  onClose: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const CallModal = ({
  conversationId,
  currentUserId,
  otherUser,
  callType,
  isIncoming = false,
  onClose,
}: CallModalProps) => {
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected" | "ended">(
    isIncoming ? "ringing" : "ringing"
  );
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const sendSignal = useCallback(
    async (signalType: string, signalData: any = {}) => {
      await supabase.from("call_signals").insert({
        conversation_id: conversationId,
        caller_id: currentUserId,
        callee_id: otherUser.id,
        signal_type: signalType,
        signal_data: signalData,
        call_type: callType,
      });
    },
    [conversationId, currentUserId, otherUser.id, callType]
  );

  const setupPeerConnection = useCallback(async () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });
    localStreamRef.current = stream;

    if (localVideoRef.current && callType === "video") {
      localVideoRef.current.srcObject = stream;
    }

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Remote stream
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0] || remoteStream;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", { candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      }
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        endCall();
      }
    };

    return pc;
  }, [callType, sendSignal]);

  const createOffer = useCallback(async () => {
    setStatus("connecting");
    const pc = await setupPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("offer", { sdp: offer });
  }, [setupPeerConnection, sendSignal]);

  const handleOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      setStatus("connecting");
      const pc = await setupPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process queued ICE candidates
      for (const candidate of iceCandidatesQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidatesQueue.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal("answer", { sdp: answer });
    },
    [setupPeerConnection, sendSignal]
  );

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    for (const candidate of iceCandidatesQueue.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    iceCandidatesQueue.current = [];
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      iceCandidatesQueue.current.push(candidate);
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const endCall = useCallback(() => {
    sendSignal("call-ended");
    setStatus("ended");
    cleanup();
    setTimeout(onClose, 500);
  }, [sendSignal, cleanup, onClose]);

  const acceptCall = useCallback(() => {
    sendSignal("call-accepted");
    // The caller will then send an offer
  }, [sendSignal]);

  const rejectCall = useCallback(() => {
    sendSignal("call-rejected");
    setStatus("ended");
    cleanup();
    setTimeout(onClose, 500);
  }, [sendSignal, cleanup, onClose]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsVideoOff(!isVideoOff);
  };

  // Listen for signals via Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`call-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const signal = payload.new as any;
          // Only process signals from the other user
          if (signal.caller_id === currentUserId) return;

          switch (signal.signal_type) {
            case "call-accepted":
              createOffer();
              break;
            case "call-rejected":
            case "call-ended":
              setStatus("ended");
              cleanup();
              setTimeout(onClose, 500);
              break;
            case "offer":
              handleOffer(signal.signal_data.sdp);
              break;
            case "answer":
              handleAnswer(signal.signal_data.sdp);
              break;
            case "ice-candidate":
              handleIceCandidate(signal.signal_data.candidate);
              break;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, createOffer, handleOffer, handleAnswer, handleIceCandidate, cleanup, onClose]);

  // Initiate call if outgoing
  useEffect(() => {
    if (!isIncoming) {
      sendSignal("call-request");
    }
  }, []);

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      {/* Video views */}
      {callType === "video" && status === "connected" && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-4 right-4 h-32 w-24 rounded-xl object-cover border-2 border-background shadow-lg z-10"
          />
        </>
      )}

      {/* Overlay content */}
      <div className="relative z-20 flex flex-col items-center gap-6 text-center">
        {/* Avatar (show when not in video call or not connected) */}
        {(callType === "voice" || status !== "connected") && (
          <>
            <div className="h-24 w-24 rounded-full bg-secondary overflow-hidden ring-4 ring-primary/20">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                  {otherUser.username?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{otherUser.username}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {status === "ringing" && (isIncoming ? "Chamada recebida..." : "Chamando...")}
                {status === "connecting" && "Conectando..."}
                {status === "connected" && fmtDuration(duration)}
                {status === "ended" && "Chamada encerrada"}
              </p>
            </div>
          </>
        )}

        {/* Connected duration overlay for video */}
        {callType === "video" && status === "connected" && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2">
            <p className="text-sm font-medium text-foreground bg-background/60 px-3 py-1 rounded-full backdrop-blur-sm">
              {fmtDuration(duration)}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-6 z-30">
        {status === "ringing" && isIncoming ? (
          <>
            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={rejectCall}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
            <Button
              size="icon"
              className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white"
              onClick={acceptCall}
            >
              {callType === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </Button>
          </>
        ) : status === "connected" || status === "connecting" ? (
          <>
            <Button
              size="icon"
              variant={isMuted ? "destructive" : "secondary"}
              className="h-14 w-14 rounded-full"
              onClick={toggleMute}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>

            {callType === "video" && (
              <Button
                size="icon"
                variant={isVideoOff ? "destructive" : "secondary"}
                className="h-14 w-14 rounded-full"
                onClick={toggleVideo}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </Button>
            )}

            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={endCall}
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
          </>
        ) : status === "ringing" && !isIncoming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-16 w-16 rounded-full"
            onClick={endCall}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        ) : null}
      </div>

      {/* Close button for ended state */}
      {status === "ended" && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-4 right-4 z-30"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
      )}

      {/* Hidden audio element for voice calls */}
      {callType === "voice" && (
        <audio ref={remoteVideoRef as any} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
};

export default CallModal;
