import type { Metadata } from "next";
import NewPasswordForm from "@/components/new-password-form";

export const metadata: Metadata = {
  title: "Nueva contraseña · Arcade Vault",
  description: "Elige una contraseña nueva para tu cuenta del Vault.",
};

export default function NewPasswordPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <NewPasswordForm />
    </div>
  );
}
