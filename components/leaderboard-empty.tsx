// Leaderboard sin puntuaciones: el puesto #01 aparece libre y debajo la
// invitacion a jugar. Sin estado ni efectos, vale en servidor y en cliente.

import Link from "next/link";

export default function LeaderboardEmpty({ gameId }: { gameId: string }) {
  return (
    <>
      <div className="lb-row top1 lb-vacant">
        <div className="rk">#01</div>
        <div className="pl">???</div>
        <div className="sc">0</div>
      </div>
      <div className="lb-empty">
        <p>Sé el primero en entrar al salón de la fama.</p>
        <Link className="btn" href={`/jugar/${gameId}`}>
          ▶ JUGAR AHORA
        </Link>
      </div>
    </>
  );
}
