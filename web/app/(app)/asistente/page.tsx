import { requireUser } from "@/lib/session";
import { llmEnabled } from "@/lib/assistant";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "./assistant-chat";

export const metadata = { title: "Asistente" };

export default async function AsistentePage() {
  await requireUser();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Asistente"
        description="Pregunta en lenguaje natural. Responde solo a partir del corpus de acuerdos y cita siempre su acta y página."
      />
      <AssistantChat llmEnabled={llmEnabled()} />
    </div>
  );
}
