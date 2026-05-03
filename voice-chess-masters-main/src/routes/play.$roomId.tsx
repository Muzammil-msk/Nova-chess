import { createFileRoute } from "@tanstack/react-router";
import { MultiplayerGame } from "@/components/MultiplayerGame";

export const Route = createFileRoute("/play/$roomId")({
  component: PlayRoomPage,
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.roomId} — Voice Chess Multiplayer` },
      {
        name: "description",
        content: `Live multiplayer chess room ${params.roomId}. Share this URL to invite an opponent.`,
      },
    ],
  }),
});

function PlayRoomPage() {
  const { roomId } = Route.useParams();
  return <MultiplayerGame roomCode={roomId} />;
}