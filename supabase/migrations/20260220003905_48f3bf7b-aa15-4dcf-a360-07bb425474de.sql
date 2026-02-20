
-- Add spotify track fields to posts
ALTER TABLE public.posts
ADD COLUMN spotify_track_id text,
ADD COLUMN spotify_track_name text,
ADD COLUMN spotify_artist_name text,
ADD COLUMN spotify_preview_url text;

-- Add spotify track fields to stories
ALTER TABLE public.stories
ADD COLUMN spotify_track_id text,
ADD COLUMN spotify_track_name text,
ADD COLUMN spotify_artist_name text,
ADD COLUMN spotify_preview_url text;
