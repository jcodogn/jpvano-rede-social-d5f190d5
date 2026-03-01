
-- Table for WebRTC call signaling
CREATE TABLE public.call_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles(id),
  callee_id uuid NOT NULL REFERENCES public.profiles(id),
  signal_type text NOT NULL, -- 'offer', 'answer', 'ice-candidate', 'call-request', 'call-accepted', 'call-rejected', 'call-ended'
  signal_data jsonb DEFAULT '{}'::jsonb,
  call_type text NOT NULL DEFAULT 'voice', -- 'voice' or 'video'
  created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view signals in their conversations"
  ON public.call_signals FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can create signals"
  ON public.call_signals FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can delete own signals"
  ON public.call_signals FOR DELETE
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Index for fast lookups
CREATE INDEX idx_call_signals_conversation ON public.call_signals(conversation_id);
CREATE INDEX idx_call_signals_callee ON public.call_signals(callee_id, signal_type);
