
-- Create storage bucket for post media
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true);

-- Allow authenticated users to upload files to the posts bucket
CREATE POLICY "Authenticated users can upload post media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'posts' AND auth.uid() IS NOT NULL);

-- Allow everyone to view post media (public bucket)
CREATE POLICY "Post media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
