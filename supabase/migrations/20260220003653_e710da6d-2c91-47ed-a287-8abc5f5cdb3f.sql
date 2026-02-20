
-- Create a secure function to create conversations between two users
CREATE OR REPLACE FUNCTION public.create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid uuid := auth.uid();
  existing_convo_id uuid;
  new_convo_id uuid;
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF current_uid = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  -- Check for existing conversation between these two users
  SELECT cp1.conversation_id INTO existing_convo_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = current_uid AND cp2.user_id = other_user_id
  LIMIT 1;

  IF existing_convo_id IS NOT NULL THEN
    RETURN existing_convo_id;
  END IF;

  -- Create new conversation
  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO new_convo_id;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (new_convo_id, current_uid),
    (new_convo_id, other_user_id);

  RETURN new_convo_id;
END;
$$;
