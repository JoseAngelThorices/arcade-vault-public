// Politica de contraseña (SPEC 14). Replica la configurada en Supabase Auth:
// minimo 8 caracteres con minuscula, mayuscula, digito y simbolo. Los simbolos
// son la lista exacta de Supabase: con "cualquier no alfanumerico" la ñ o un
// espacio pasarian aqui y Supabase rechazaria la contraseña despues.

export const PASSWORD_MIN = 8;

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]).{8,}$/;

export const PASSWORD_RULES =
  "La contraseña debe tener mínimo 8 caracteres e incluir mayúsculas, minúsculas, números y símbolos (!@#$%…).";

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}
