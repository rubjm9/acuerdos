import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { hybridSearch } from "@/lib/search";

/**
 * Búsqueda rápida para la paleta de comandos (⌘K): devuelve los acuerdos más
 * relevantes con lo mínimo para navegar. La búsqueda completa (multi-filtro,
 * citas) sigue en /busqueda. RLS-scoped por la identidad del usuario.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await hybridSearch(session.user.id, q);
    const results = response.results.slice(0, 6).map((r) => ({
      id: r.acuerdo_id,
      titulo: r.titulo,
      public_ref: r.public_ref,
      estado: r.estado,
    }));
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
