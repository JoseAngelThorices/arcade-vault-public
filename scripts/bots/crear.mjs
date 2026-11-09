// Crea N cuentas de bot con el correo ya confirmado (sin pasar por el email).
// El perfil (alias + avatar) lo crea el trigger `on_auth_user_created` a partir
// de user_metadata, igual que en un registro real; el script comprueba que el
// alias del perfil es el pedido. Es idempotente: las cuentas existentes se saltan.
//
//   npm run bots:crear -- --n=20

import {
  adminClient, botAlias, botAvatar, botEmail, BOT_PASSWORD, fail, parseArgs, pool,
} from "./common.mjs";

const args = parseArgs({ n: 12 });
const n = Number(args.n);
if (!Number.isInteger(n) || n < 1 || n > 500) fail("--n debe ser un entero entre 1 y 500.");

const admin = adminClient();
const problems = [];
let created = 0;
let skipped = 0;

console.log(`Creando ${n} bots…`);

await pool(
  Array.from({ length: n }, (_, k) => k + 1),
  5,
  async (i) => {
    const email = botEmail(i);
    const alias = botAlias(i);
    const avatar = botAvatar(i);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: BOT_PASSWORD,
      email_confirm: true,
      user_metadata: { username: alias, avatar },
    });

    if (error) {
      if (/already.*(registered|exists)/i.test(error.message)) {
        skipped++;
        return;
      }
      problems.push(`${email}: ${error.message}`);
      return;
    }
    created++;

    // El trigger debe haber creado el perfil con el alias pedido.
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("username, avatar")
      .eq("id", data.user.id)
      .maybeSingle();
    if (pErr || !profile) {
      problems.push(`${alias}: el trigger no creo el perfil (${pErr?.message ?? "sin fila"})`);
    } else if (profile.username !== alias || profile.avatar !== avatar) {
      problems.push(
        `${alias}: perfil inesperado (${profile.username}, ${profile.avatar}); se esperaba (${alias}, ${avatar})`,
      );
    }
  },
);

console.log(`✔ ${created} creados · ${skipped} ya existian`);
if (problems.length) {
  console.log(`\n⚠ ${problems.length} problemas:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
