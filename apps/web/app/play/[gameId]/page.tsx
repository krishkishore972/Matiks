import { notFound } from "next/navigation";
import { GAMES } from "../../../lib/catalog";
import { GameHost } from "../../../components/GameHost";
import type { GameId } from "../../../lib/types";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ daily?: string }>;
}) {
  const { gameId } = await params;
  const { daily } = await searchParams;

  if (!(gameId in GAMES)) notFound();

  return <GameHost gameId={gameId as GameId} daily={daily === "1"} />;
}
