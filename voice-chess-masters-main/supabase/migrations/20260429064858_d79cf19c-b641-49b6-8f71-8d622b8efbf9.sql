
DROP POLICY IF EXISTS "Players in room can update" ON public.game_rooms;
CREATE POLICY "Public can update rooms" ON public.game_rooms FOR UPDATE USING (true) WITH CHECK (true);
