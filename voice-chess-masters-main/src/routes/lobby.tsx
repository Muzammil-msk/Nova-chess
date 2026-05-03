import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, Users, Plus, LogIn, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, getPlayerId } from "@/lib/player-id";

export const Route = createFileRoute("/lobby")({
  component: LobbyPage,
  head: () => ({
    meta: [
      { title: "Multiplayer Lobby — Voice Chess" },
      {
        name: "description",
        content:
          "Create or join an AI-free chess match using a 6-character room code. Realtime multiplayer with no login required.",
      },
      { property: "og:title", content: "Multiplayer Lobby — Voice Chess" },
      {
        property: "og:description",
        content: "Create or join a chess room and play live against a friend.",
      },
    ],
  }),
});

function LobbyPage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setError(null);
    setCreating(true);
    try {
      const code = generateRoomCode();
      const playerId = getPlayerId();
      // Creator takes the white seat.
      const { error } = await supabase
        .from("game_rooms")
        .insert({ code, white_player_id: playerId, status: "waiting" });
      if (error) throw error;
      navigate({ to: "/play/$roomId", params: { roomId: code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create room");
      setCreating(false);
    }
  }

  async function joinRoom() {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter a valid room code.");
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .select("code")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setError("Room not found. Double-check the code.");
        setJoining(false);
        return;
      }
      navigate({ to: "/play/$roomId", params: { roomId: code } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to single player
          </Link>
        </div>

        <header className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-md bg-gradient-primary grid place-items-center glow">
              <Crown className="size-4 text-primary-foreground" />
            </div>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Multiplayer Lobby
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="text-neon">Play</span>
            <span className="text-foreground"> a friend</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            No account, no AI. Create a room and share the code, or join one a friend sent you.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Create */}
          <div className="rounded-2xl p-[1px] bg-gradient-to-br from-[var(--neon-mint)]/40 via-transparent to-[var(--neon-magenta)]/30">
            <div className="rounded-2xl bg-card/80 backdrop-blur p-6 h-full flex flex-col">
              <div className="size-10 rounded-lg bg-primary/10 grid place-items-center mb-4">
                <Plus className="size-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Create a room</h2>
              <p className="text-sm text-muted-foreground mb-6">
                You'll play as White. Share the generated code so a friend can join.
              </p>
              <Button
                onClick={createRoom}
                disabled={creating}
                className="mt-auto bg-gradient-primary text-primary-foreground glow"
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Users className="size-4 mr-1.5" /> Create room
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Join */}
          <div className="rounded-2xl p-[1px] bg-gradient-to-br from-[var(--neon-magenta)]/40 via-transparent to-[var(--neon-mint)]/30">
            <div className="rounded-2xl bg-card/80 backdrop-blur p-6 h-full flex flex-col">
              <div className="size-10 rounded-lg bg-accent/10 grid place-items-center mb-4">
                <LogIn className="size-5 text-accent" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Join a room</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Paste the 6-character code your friend shared.
              </p>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7QF2P"
                maxLength={8}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinRoom();
                }}
                className="font-mono tracking-[0.3em] text-center text-lg uppercase mb-4"
              />
              <Button
                onClick={joinRoom}
                disabled={joining || joinCode.length < 4}
                variant="outline"
                className="mt-auto"
              >
                {joining ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" /> Joining…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4 mr-1.5" /> Join room
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  );
}