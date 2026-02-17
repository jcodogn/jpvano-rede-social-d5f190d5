
-- Add message_type and media_url to messages for audio support
ALTER TABLE public.messages ADD COLUMN message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN media_url text;

-- Create audio-messages storage bucket (100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('audio-messages', 'audio-messages', false, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio messages
CREATE POLICY "Auth users can upload audio" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'audio-messages' AND auth.uid() IS NOT NULL
);

CREATE POLICY "Auth users can read audio" ON storage.objects
FOR SELECT USING (
  bucket_id = 'audio-messages' AND auth.uid() IS NOT NULL
);
