
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP POLICY "Anyone can update rooms" ON public.game_rooms;

-- Players identify themselves with a generated token stored client-side.
-- They send it via the request header `x-player-id`. Updates are allowed
-- only when that header matches one of the player slots, OR when the row
-- still has an open slot for that color (joining flow).
CREATE POLICY "Players in room can update"
ON public.game_rooms
FOR UPDATE
USING (
  white_player_id IS NULL
  OR black_player_id IS NULL
  OR white_player_id = current_setting('request.headers', true)::json->>'x-player-id'
  OR black_player_id = current_setting('request.headers', true)::json->>'x-player-id'
);
