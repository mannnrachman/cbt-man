import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  listFiles,
  putFile,
  deleteFile,
  getObjectURL,
  type FileMeta,
} from "@/lib/cbt/files";
import { unitAkademikRepo, soalRepo } from "@/lib/cbt/repos";
import { useAuthStore } from "@/lib/cbt/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FolderOpen, FileAudio, File as FileIcon, Search, Copy, Folder, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPageHeader } from "@/components/cbt/AdminPage";

export const Route = createFileRoute("/_authenticated/admin/files")({
  component: FilesPage,
});

function FilesPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === "super_admin";
  const myJurusanId = user?.unitId;

  const [files, setFiles] = useState<FileMeta[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>(isSuper ? "all" : (myJurusanId || "all"));
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const jurusans = unitAkademikRepo.all().filter((u) => u.tipe === "jurusan");
  const myJurusan = jurusans.find(j => j.id === myJurusanId);

  // Pre-calculate Usage Map
  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    soalRepo.all().forEach(s => {
      let text = (s.detail || "") + " " + (s.pembahasan || "");
      s.jawaban.forEach(j => text += " " + (j.detail || ""));
      const re = /file:\/\/([a-zA-Z0-9_-]+)/g;
      let match;
      while ((match = re.exec(text)) !== null) {
         const id = match[1];
         map[id] = (map[id] || 0) + 1;
      }
      if (s.audioFileId) {
         map[s.audioFileId] = (map[s.audioFileId] || 0) + 1;
      }
    });
    return map;
  }, [files]); 

  async function refresh() {
    const list = await listFiles();
    setFiles(list.sort((a, b) => b.createdAt - a.createdAt)); // Sort by newest
    const u: Record<string, string> = {};
    for (const f of list.filter((x) => x.mime.startsWith("image/") || x.mime.startsWith("audio/"))) {
      const url = await getObjectURL(f.id);
      if (url) u[f.id] = url;
    }
    setUrls(u);
  }
  
  useEffect(() => {
    refresh();
  }, []);

  async function onUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    
    // For non-super admins, strictly force the target folder to their Jurusan
    const targetJurusan = isSuper 
      ? (selectedFolder !== "all" && selectedFolder !== "global" ? selectedFolder : undefined)
      : myJurusanId;
      
    setIsUploading(true);
    try {
      let successCount = 0;
      
      for (const f of Array.from(fileList)) {
        try {
          await putFile(f, targetJurusan);
          successCount++;
        } catch (e) {
          toast.error(`Gagal upload ${f.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      
      if (successCount > 0) {
        const folderName = targetJurusan ? jurusans.find((j) => j.id === targetJurusan)?.nama : "Global";
        toast.success(`${successCount} file berhasil di-upload ke folder ${folderName}`);
        try {
          await refresh();
        } catch (e) {
          toast.error(`Gagal memuat ulang daftar file: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      setIsUploading(false);
    }
  }
  
  const filteredFiles = files.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    
    // Force Jurusan Isolation if not super_admin
    if (!isSuper) {
      if (myJurusanId) {
        if (f.jurusanId !== myJurusanId) return false;
      } else {
        if (f.jurusanId) return false;
      }
    } else {
      if (selectedFolder !== "all") {
        if (selectedFolder === "global") {
          if (f.jurusanId) return false;
        } else {
          if (f.jurusanId !== selectedFolder) return false;
        }
      }
    }
    return true;
  });

  return (
    <AdminPage>
      <AdminPageHeader
        title={!isSuper && myJurusan ? `Penyimpanan: ${myJurusan.nama}` : "Drive Penyimpanan"}
        description={!isSuper ? "Kelola gambar dan audio khusus untuk program studi Anda." : "Kelola gambar & audio ujian yang terorganisir per Program Studi."}
        action={
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,audio/*"
              hidden
              onChange={(e) => {
                onUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading} className="h-9 font-semibold">
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4 -translate-y-[0.5px]" />} 
              Upload File
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 sm:items-center pb-2">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari nama file..." 
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-primary/20 shadow-sm h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {isSuper && (
          <>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden sm:block mx-1" />
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
              <button 
                onClick={() => setSelectedFolder("all")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ease-spring shrink-0 ${selectedFolder === "all" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400"}`}
              >
                <Database className="h-4 w-4 -translate-y-[0.5px]" /> Semua File
              </button>
              <button 
                onClick={() => setSelectedFolder("global")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ease-spring shrink-0 ${selectedFolder === "global" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-400"}`}
              >
                <Folder className="h-4 w-4 -translate-y-[0.5px]" /> Umum / Global
              </button>
              
              {jurusans.length > 0 && <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2 shrink-0" />}
              
              {jurusans.map(j => (
                <button 
                  key={j.id}
                  onClick={() => setSelectedFolder(j.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ease-spring shrink-0 ${selectedFolder === j.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary/30"}`}
                >
                  <Folder className="h-4 w-4 -translate-y-[0.5px]" /> {j.nama}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-5">
            <FolderOpen className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Folder Kosong</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 text-center max-w-sm mb-6">
            Penyimpanan untuk {isSuper ? "kategori ini" : "program studi Anda"} masih kosong. Klik tombol Upload untuk menambahkan gambar atau audio.
          </p>
          <Button onClick={() => inputRef.current?.click()} variant="outline" className="shadow-sm transition-all duration-300 ease-spring hover:scale-[0.98]">
            <Upload className="mr-2 h-4 w-4 -translate-y-[0.5px]" /> Mulai Upload
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
          {filteredFiles.map((f) => {
            const usage = usageMap[f.id] || 0;
            return (
              <Card key={f.id} className="group overflow-hidden border border-slate-200/80 dark:border-slate-800 hover:border-primary/50 dark:hover:border-primary/50 shadow-sm hover:shadow-md hover:shadow-primary/5 transition-all duration-300 ease-spring bg-white dark:bg-slate-900 rounded-2xl flex flex-col">
                <div className="relative h-40 bg-slate-50/80 dark:bg-slate-900/50 flex flex-col items-center justify-center p-2 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden group/media">
                  
                  {f.mime.startsWith("image/") && urls[f.id] ? (
                    <img src={urls[f.id]} alt={f.name} className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105" />
                  ) : f.mime.startsWith("audio/") && urls[f.id] ? (
                    <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 bg-slate-100 dark:bg-slate-800/60">
                      <FileAudio className="h-10 w-10 mb-3 opacity-80" />
                      {/* Mini Audio Player shown on hover */}
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity duration-300">
                        <audio controls controlsList="nodownload" src={urls[f.id]} className="w-full h-8" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-300 dark:text-slate-600">
                      <FileIcon className="h-10 w-10 mb-2 opacity-60" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{f.mime.split("/")[1] || "FILE"}</span>
                    </div>
                  )}
                  
                  {/* Usage Badge */}
                  <div className="absolute top-2 left-2 z-10">
                    {usage > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-100/90 dark:bg-indigo-900/80 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-200/50 dark:border-indigo-800 backdrop-blur-sm">
                        Dipakai di {usage} soal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100/90 dark:bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 shadow-sm border border-slate-200/50 dark:border-slate-700 backdrop-blur-sm">
                        Tidak terpakai
                      </span>
                    )}
                  </div>
                  
                  {/* Hover overlay actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out flex items-center justify-center gap-2.5 backdrop-blur-[2px] pointer-events-none group-hover:pointer-events-auto">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-9 w-9 rounded-full shadow-sm scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-spring delay-75 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      onClick={async () => {
                        if (usage > 0) {
                          toast.error(`Aksi Ditolak: File ini sedang digunakan di ${usage} soal. Hapus dari soal terlebih dahulu sebelum menghapus file.`);
                          return;
                        }
                        if (!confirm(`Hapus file ${f.name} secara permanen?`)) return;
                        try {
                          await deleteFile(f.id);
                          toast.success("File berhasil dihapus");
                          try {
                            await refresh();
                          } catch (e) {
                            toast.error(`Gagal memuat ulang daftar file: ${e instanceof Error ? e.message : String(e)}`);
                          }
                        } catch (e) {
                          toast.error(`Gagal menghapus file: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      }}
                      title="Hapus Permanen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="secondary"
                      className="h-9 w-9 rounded-full shadow-sm scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-spring hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20"
                      onClick={() => {
                        const internalUrl = `file://${f.id}`;
                        navigator.clipboard.writeText(internalUrl);
                        toast.success("File ID disalin! (Gunakan ini di Excel)");
                      }}
                      title="Copy Internal Link (ID)"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <CardContent className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-primary transition-colors duration-300 ease-spring" title={f.name}>
                      {f.name}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500">
                        {(f.size / 1024).toFixed(1)} KB
                      </div>
                      {isSuper && f.jurusanId && (
                        <div className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                          {jurusans.find(j => j.id === f.jurusanId)?.nama.substring(0, 10)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
