
-- User roles table (security best practice)
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'creator', 'business', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can view own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Story highlights table
CREATE TABLE public.story_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Destaque',
  cover_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlights viewable by authenticated" ON public.story_highlights
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own highlights" ON public.story_highlights
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Story highlight items (link stories to highlights)
CREATE TABLE public.story_highlight_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id uuid NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(highlight_id, story_id)
);

ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Highlight items viewable by authenticated" ON public.story_highlight_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own highlight items" ON public.story_highlight_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.story_highlights WHERE id = highlight_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_highlights WHERE id = highlight_id AND user_id = auth.uid()));

-- Pinned posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Admin balance table for real withdrawal tracking  
CREATE TABLE public.admin_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_id)
);

ALTER TABLE public.admin_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own balance" ON public.admin_balance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

CREATE POLICY "Admins can update own balance" ON public.admin_balance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

CREATE POLICY "Admins can insert own balance" ON public.admin_balance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_transfer_id text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

CREATE POLICY "Admins can create withdrawals" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);

CREATE POLICY "Admins can update own withdrawals" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND auth.uid() = admin_id);
