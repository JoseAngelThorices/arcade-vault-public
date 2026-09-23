// Nombre con el que el jugador firma sus puntuaciones (SPEC 06). Es distinto
// del nick de sesion (`av_user`): se recuerda aunque no haya sesion abierta.

const PLAYER_NAME_KEY = "av_player_name";

export function readPlayerName(): string | null {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    // localStorage bloqueado (navegacion privada): no hay nombre recordado.
    return null;
  }
}

export function writePlayerName(name: string) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // Sin persistencia: la proxima partida no tendra el nombre pre-rellenado.
  }
}
