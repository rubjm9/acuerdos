import { NextResponse, type NextRequest } from "next/server";

/** Puente para formularios GET: /redirect?id=X&formato=Y → /expediente/X?formato=Y */
export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const formato = req.nextUrl.searchParams.get("formato") ?? "pdf";
  if (!id) return NextResponse.json({ error: "Falta el expediente" }, { status: 400 });
  return NextResponse.redirect(
    new URL(`/api/informes/expediente/${id}?formato=${formato}`, req.nextUrl.origin)
  );
}
