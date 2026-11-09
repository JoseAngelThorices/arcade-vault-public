import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
  description: "Inicia sesión o crea tu cuenta en el Vault.",
};

export default async function AccessPage({ searchParams }: PageProps<"/acceso">) {
  // El callback de Supabase vuelve aqui con ?error=enlace si el enlace fallo.
  // ?registro abre directamente la pestaña CREAR CUENTA (enlace de la landing).
  const { error, registro } = await searchParams;

  return (
    <div className="av-auth-wrap fade-in">
      <AuthForm linkError={error === "enlace"} startOnSignUp={registro !== undefined} />
    </div>
  );
}
