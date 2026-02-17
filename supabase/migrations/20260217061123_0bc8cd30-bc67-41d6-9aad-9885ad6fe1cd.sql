
-- 1. Fix profiles: require authentication for SELECT
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles FOR SELECT TO authenticated
USING (true);

-- 2. Fix posts: require authentication and respect privacy
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts viewable by authenticated users"
ON public.posts FOR SELECT TO authenticated
USING (true);

-- 3. Fix comments: require authentication
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments viewable by authenticated users"
ON public.comments FOR SELECT TO authenticated
USING (true);

-- 4. Fix followers: require authentication
DROP POLICY IF EXISTS "Followers viewable by everyone" ON public.followers;
CREATE POLICY "Followers viewable by authenticated users"
ON public.followers FOR SELECT TO authenticated
USING (true);

-- 5. Fix hashtags: require authentication for SELECT
DROP POLICY IF EXISTS "Hashtags viewable by everyone" ON public.hashtags;
CREATE POLICY "Hashtags viewable by authenticated users"
ON public.hashtags FOR SELECT TO authenticated
USING (true);

-- 6. Fix post_hashtags: require authentication
DROP POLICY IF EXISTS "Post hashtags viewable" ON public.post_hashtags;
CREATE POLICY "Post hashtags viewable by authenticated users"
ON public.post_hashtags FOR SELECT TO authenticated
USING (true);

-- 7. Fix likes: require authentication
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "Likes viewable by authenticated users"
ON public.likes FOR SELECT TO authenticated
USING (true);

-- 8. Fix stories: require authentication
DROP POLICY IF EXISTS "Stories viewable by everyone" ON public.stories;
CREATE POLICY "Stories viewable by authenticated users"
ON public.stories FOR SELECT TO authenticated
USING (expires_at > now());
