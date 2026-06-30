// RichEditor + RichView — contentEditable + KaTeX + file manager picker
// Math: $inline$ atau $$display$$
// Image: data URL atau file://<id> (rewrite lewat objectURL)

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Image as ImageIcon,
  Sigma,
  Eraser,
  Table as TableIcon,
  Code,
  FolderOpen,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listFiles, getObjectURL, extractFileIds, type FileMeta } from "@/lib/cbt/files";
import { sanitizeHtml } from "@/lib/cbt/sanitize";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMathSegment(text: string): string {
  let out = text.replace(/\$\$([^$]+?)\$\$/g, (_, tex) => {
    try {
      return `<span class="katex-block">${katex.renderToString(tex, { displayMode: true, throwOnError: false, trust: false, strict: "ignore", output: "html" })}</span>`;
    } catch {
      return _;
    }
  });
  out = out.replace(/\$([^$\n]+?)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "html",
      });
    } catch {
      return _;
    }
  });
  return out;
}

function renderMath(html: string): string {
  // Render math ONLY on text between tags, never inside a tag/attribute.
  // A `$...$` that survived sanitization inside an attribute value could
  // otherwise expand into KaTeX markup and break out of the attribute,
  // re-introducing structural HTML after the sanitizer has run. Splitting on
  // tags keeps `sanitizeHtml` the final structural gate (works in both the
  // browser and node/SSR — no DOM required).
  return html.replace(/<[^>]+>|[^<]+/g, (segment) =>
    segment.startsWith("<") ? segment : renderMathSegment(segment),
  );
}

function useFileUrls(html: string) {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const ids = extractFileIds(html);
    if (ids.length === 0) {
      setMap({});
      return;
    }
    (async () => {
      const next: Record<string, string> = {};
      for (const id of ids) {
        const url = await getObjectURL(id);
        if (url) next[id] = url;
      }
      if (!cancelled) setMap(next);
    })();
    return () => {
      cancelled = true;
      // revoke setelah unmount; minor leak diterima demi simplicity
    };
  }, [html]);
  return map;
}

export function RichView({ html, className }: { html: string; className?: string }) {
  const fileMap = useFileUrls(html || "");
  const rendered = useMemo(() => {
    let h = html || "";
    // 1. Rewrite file://<id> references to data: URLs (must precede sanitize
    //    so the resulting <img src="data:..."> survives the allowlist).
    for (const [id, url] of Object.entries(fileMap)) {
      h = h.split(`file://${id}`).join(url);
    }
    // 2. Strip any executable/unsafe HTML from the authored content.
    h = sanitizeHtml(h);
    // 3. Render KaTeX last: its output is trusted code-generated HTML with
    //    required inline styles that sanitization would otherwise remove.
    return renderMath(h);
  }, [html, fileMap]);
  return (
    <div
      className={className ?? "prose prose-sm max-w-none [&_img]:inline-block [&_img]:max-h-48"}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? "");
  }

  function insertHtml(html: string) {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    onChange(ref.current?.innerHTML ?? "");
  }

  function insertImageDataUrl() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        ref.current?.focus();
        document.execCommand("insertImage", false, String(reader.result));
        onChange(ref.current?.innerHTML ?? "");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function insertMath() {
    const tex = window.prompt("Tulis rumus LaTeX (mis. \\frac{a}{b}):");
    if (!tex) return;
    const display = window.confirm("Tampilkan blok terpisah? OK=ya, Batal=inline");
    const snippet = display ? `$$${tex}$$` : `$${tex}$`;
    ref.current?.focus();
    document.execCommand("insertText", false, snippet);
    onChange(ref.current?.innerHTML ?? "");
  }

  function insertTable() {
    const rows = Number(window.prompt("Jumlah baris?", "3"));
    const cols = Number(window.prompt("Jumlah kolom?", "3"));
    if (!rows || !cols) return;
    let html = '<table class="border-collapse border my-2"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) html += '<td class="border px-2 py-1">&nbsp;</td>';
      html += "</tr>";
    }
    html += "</tbody></table>";
    insertHtml(html);
  }

  function insertCode() {
    const code = window.prompt("Kode:");
    if (!code) return;
    insertHtml(
      `<pre class="bg-muted p-2 rounded text-xs"><code>${code.replace(/</g, "&lt;")}</code></pre>`,
    );
  }

  function pickFromManager(meta: FileMeta) {
    // Escape the file name before interpolating into HTML attributes / text so
    // a crafted file name cannot inject markup into the editor content.
    const safeName = escapeHtml(meta.name);
    if (meta.mime.startsWith("image/")) {
      insertHtml(`<img src="file://${meta.id}" alt="${safeName}" />`);
    } else {
      insertHtml(`<a href="file://${meta.id}">${safeName}</a>`);
    }
    setPickerOpen(false);
  }

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b p-1">
        {[
          { i: Bold, t: "Tebal", c: () => exec("bold") },
          { i: Italic, t: "Miring", c: () => exec("italic") },
          { i: Underline, t: "Garis bawah", c: () => exec("underline") },
          { i: List, t: "Bullet", c: () => exec("insertUnorderedList") },
          { i: ListOrdered, t: "Numbered", c: () => exec("insertOrderedList") },
          { i: ImageIcon, t: "Sisipkan gambar (inline)", c: insertImageDataUrl },
          { i: FolderOpen, t: "Pilih dari File Manager", c: () => setPickerOpen(true) },
          { i: TableIcon, t: "Sisipkan tabel", c: insertTable },
          { i: Code, t: "Sisipkan kode", c: insertCode },
          { i: Sigma, t: "Rumus matematika", c: insertMath },
          { i: Eraser, t: "Bersihkan format", c: () => exec("removeFormat") },
        ].map(({ i: Icon, t, c }, i) => (
          <Button key={i} type="button" variant="ghost" size="sm" title={t} onClick={c}>
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          Tip: <code>$x^2$</code> rumus inline · <code>$$...$$</code> display
        </span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Ketik di sini…"}
        className="prose prose-sm max-w-none px-3 py-2 outline-none [&_img]:inline-block [&_img]:max-h-48 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        style={{ minHeight }}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        onBlur={() => onChange(ref.current?.innerHTML ?? "")}
      />
      <FilePicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickFromManager} />
    </div>
  );
}

function FilePicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (m: FileMeta) => void;
}) {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      const list = await listFiles();
      setFiles(list);
      const u: Record<string, string> = {};
      for (const f of list.filter((x) => x.mime.startsWith("image/"))) {
        const url = await getObjectURL(f.id);
        if (url) u[f.id] = url;
      }
      setUrls(u);
    })();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pilih dari File Manager</DialogTitle>
        </DialogHeader>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada file. Upload dulu di menu <strong>File Manager</strong>.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPick(f)}
                className="flex flex-col items-center gap-1 rounded border p-2 text-left text-xs hover:bg-muted"
              >
                {urls[f.id] ? (
                  <img src={urls[f.id]} alt={f.name} className="h-20 w-full object-contain" />
                ) : (
                  <div className="grid h-20 w-full place-items-center bg-muted text-muted-foreground">
                    {f.mime.split("/")[0]}
                  </div>
                )}
                <span className="line-clamp-1 w-full break-all">{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
