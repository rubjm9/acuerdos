import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

/**
 * Render de markdown SANEADO (rehype-sanitize elimina HTML peligroso: no hay
 * paso de HTML crudo). Todo local, sin llamadas externas. Estilos tipográficos
 * sobrios coherentes con el resto de la plataforma.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-prose text-[15px] leading-relaxed",
        "[&_h1]:mt-6 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-tight",
        "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_p]:my-2.5",
        "[&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:my-1",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm",
        "[&_table]:my-3 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border-b [&_td]:px-2 [&_td]:py-1.5",
        "[&_hr]:my-5 [&_hr]:border-border",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
