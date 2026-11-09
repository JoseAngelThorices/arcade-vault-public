// Borra los bots y todo lo que dejaron. Sin --si solo muestra lo que borraria.
// Orden: primero las puntuaciones (scores.user_id es `on delete set null`, asi
// que borrar la cuenta antes dejaria filas huerfanas en los rankings), despues
// las cuentas; el perfil cae en cascada.
//
//   npm run bots:limpiar          # simulacion
//   npm run bots:limpiar -- --si  # borra de verdad

import { adminClient, fail, fmt, listBots, parseArgs, pool } from "./common.mjs";

const args = parseArgs();
const admin = adminClient();
const bots = await listBots(admin);
const ids = bots.map((b) => b.id);

let scoreCount = 0;
for (let k = 0; k < ids.length; k += 100) {
  const { count, error } = await admin
    .from("scores")
    .select("id", { count: "exact", head: true })
    .in("user_id", ids.slice(k, k + 100));
  if (error) fail(`No se pudieron contar las puntuaciones: ${error.message}`);
  scoreCount += count ?? 0;
}

console.log(`${bots.length} bots · ${fmt(scoreCount)} puntuaciones suyas`);
if (!args.si) {
  console.log("Simulacion: no se ha borrado nada. Repite con --si para borrar.");
  process.exit(0);
}

for (let k = 0; k < ids.length; k += 100) {
  const { error } = await admin.from("scores").delete().in("user_id", ids.slice(k, k + 100));
  if (error) fail(`No se pudieron borrar las puntuaciones: ${error.message}`);
}

const problems = [];
await pool(bots, 5, async (b) => {
  const { error } = await admin.auth.admin.deleteUser(b.id);
  if (error) problems.push(`${b.email}: ${error.message}`);
});

console.log(`✔ Borradas ${fmt(scoreCount)} puntuaciones y ${bots.length - problems.length} cuentas`);
if (problems.length) {
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
