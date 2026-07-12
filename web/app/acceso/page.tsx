import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Acceso" };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const { error } = await searchParams;

  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID);
  const devEnabled = process.env.AUTH_DEV_LOGIN === "true";

  async function loginGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  async function loginDev(formData: FormData) {
    "use server";
    await signIn("dev", {
      email: String(formData.get("email") ?? ""),
      redirectTo: "/",
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Gavel className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Acuerdos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plataforma de gestión de actas, acuerdos y expedientes
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Iniciar sesión</CardTitle>
            <CardDescription>
              Acceso reservado a personas autorizadas por la Asamblea.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error === "AccessDenied"
                  ? "Tu cuenta no está autorizada. Contacta con Administración."
                  : "No se pudo iniciar sesión. Inténtalo de nuevo."}
              </p>
            ) : null}

            {googleEnabled ? (
              <form action={loginGoogle}>
                <Button type="submit" variant="outline" className="w-full min-h-11 gap-2.5">
                  <GoogleIcon />
                  Continuar con Google
                </Button>
              </form>
            ) : null}

            {googleEnabled && devEnabled ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                o
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : null}

            {devEnabled ? (
              <form action={loginDev} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (modo desarrollo)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="nombre@bahai.es"
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full min-h-11">
                  Entrar
                </Button>
              </form>
            ) : null}

            {!googleEnabled && !devEnabled ? (
              <p className="text-sm text-muted-foreground">
                No hay métodos de acceso configurados. Revisa las variables de entorno.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Datos alojados y procesados íntegramente en la UE.
        </p>
      </div>
    </div>
  );
}
