import { createFileRoute } from "@tanstack/react-router";
import { ChessGame } from "@/components/ChessGame";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Voice Chess — Play chess with your voice vs AI" },
      {
        name: "description",
        content:
          "Play chess against an AI opponent using voice commands. Minimax engine with three difficulty levels.",
      },
      { property: "og:title", content: "Voice Chess — Play chess with your voice vs AI" },
      {
        property: "og:description",
        content: "Speak your moves. Outwit the AI. Built with chess.js + Web Speech API.",
      },
    ],
  }),
});

function Index() {
  return <ChessGame />;
}
