import type { Metadata } from "next";
import AuthForm from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
  description: "Entra en el Vault o juega como invitado.",
};

export default function AccessPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <AuthForm />
    </div>
  );
}
