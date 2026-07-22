import {
  deleteStoredFile,
  getStoredFileUrl,
  listStoredFiles,
  uploadStoredFile,
} from "@/lib/server/files/functions";

export type FileMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  extension: string;
  jurusanId?: string;
};

export async function putFile(file: File, jurusanId?: string): Promise<FileMeta> {
  const dataBase64 = await fileToBase64(file);
  return uploadStoredFile({
    data: {
      name: file.name,
      mime: file.type || "application/octet-stream",
      dataBase64,
      jurusanId,
    },
  });
}

export async function listFiles(): Promise<FileMeta[]> {
  return listStoredFiles();
}

export async function getObjectURL(id: string): Promise<string | null> {
  const file = await getStoredFileUrl({ data: { id } });
  if (!file) return null;
  return `data:${file.mime};base64,${file.dataBase64}`;
}

export async function deleteFile(id: string): Promise<void> {
  await deleteStoredFile({ data: { id } });
}

export function rewriteFileUrls(html: string, urlMap: Record<string, string>): string {
  return html.replace(/file:\/\/([a-z0-9_]+)/gi, (_match, id) => urlMap[id] ?? "");
}

export function extractFileIds(html: string): string[] {
  const ids = new Set<string>();
  const re = /file:\/\/([a-z0-9_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) ids.add(match[1]);
  return [...ids];
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Format file tidak didukung"));
        return;
      }
      const [, dataBase64 = ""] = result.split(",", 2);
      resolve(dataBase64);
    };
    reader.readAsDataURL(file);
  });
}
