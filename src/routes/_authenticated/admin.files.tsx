import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  listFiles,
  putFile,
  deleteFile,
  getObjectURL,
  type FileMeta,
} from "@/lib/cbt/files";
import { unitAkademikRepo } from "@/lib/cbt/repos";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FolderOpen, FileAudio, File as FileIcon, Search, Link as LinkIcon, Folder, Database } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/files")({
  component: FilesPage,
});

function FilesPage() {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const jurusans = unitAkademikRepo.all().filter((u) => u.tipe === "jurusan");

  async function refresh() {
    const list = await listFiles();
    setFiles(list.sort((a, b) => b.createdAt - a.createdAt)); // Sort by newest
    const u: Record<string, string> = {};
    for (const f of list.filter((x) => x.mime.startsWith("image/"))) {
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
    const targetJurusan = selectedFolder !== "all" && selectedFolder !== "global" ? selectedFolder : undefined;
    
    for (const f of Array.from(fileList)) {
      await putFile(f, targetJurusan);
    }
    
    const folderName = targetJurusan ? jurusans.find((j) => j.id === targetJurusan)?.nama : "Global";
    toast.success(`${fileList.length} file berhasil di-upload ke folder ${folderName}`);
    refresh();
  }
  
  const filteredFiles = files.filter(f => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    
    if (selectedFolder === "all") return true;
    if (selectedFolder === "global") return !f.jurusanId;
    return f.jurusanId === selectedFolder;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      
      {/* Sleek Enterprise Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
            Drive Penyimpanan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kelola gambar & audio ujian yang terorganisir per Program Studi.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Cari nama file..." 
              className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-primary/20 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
          <Button onClick={() => inputRef.current?.click()} className="shrink-0 shadow-sleek transition-all duration-300 ease-spring hover:scale-[0.98]">
            <Upload className="mr-2 h-4 w-4 -translate-y-[0.5px]" /> Upload File
          </Button>
        </div>
      </div>

      {/* Folder Navigation (Pill Tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
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

      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-5">
            <FolderOpen className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Folder Kosong</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 text-center max-w-sm mb-6">
            Penyimpanan untuk kategori ini masih kosong. Klik tombol Upload untuk menambahkan gambar atau audio.
          </p>
          <Button onClick={() => inputRef.current?.click()} variant="outline" className="shadow-sm transition-all duration-300 ease-spring hover:scale-[0.98]">
            <Upload className="mr-2 h-4 w-4 -translate-y-[0.5px]" /> Mulai Upload
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
          {filteredFiles.map((f) => (
            <Card key={f.id} className="group overflow-hidden border border-slate-200/80 dark:border-slate-800 hover:border-primary/50 dark:hover:border-primary/50 shadow-sm hover:shadow-md hover:shadow-primary/5 transition-all duration-300 ease-spring bg-white dark:bg-slate-900 rounded-2xl flex flex-col">
              <div className="relative h-40 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-center p-2 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden">
                {f.mime.startsWith("image/") && urls[f.id] ? (
                  <img src={urls[f.id]} alt={f.name} className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105" />
                ) : (
                  <div className="flex flex-col items-center text-slate-300 dark:text-slate-600">
                    {f.mime.startsWith("audio/") ? <FileAudio className="h-10 w-10 mb-2 opacity-60" /> : <FileIcon className="h-10 w-10 mb-2 opacity-60" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{f.mime.split("/")[1] || "FILE"}</span>
                  </div>
                )}
                
                {/* Hover overlay actions */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out flex items-center justify-center gap-2.5 backdrop-blur-[2px]">
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="h-9 w-9 rounded-full shadow-sm scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-spring delay-75 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    onClick={async () => {
                      if (!confirm(`Hapus file ${f.name} secara permanen?`)) return;
                      await deleteFile(f.id);
                      refresh();
                    }}
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary"
                    className="h-9 w-9 rounded-full shadow-sm scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 ease-spring hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20"
                    onClick={() => {
                      const absUrl = `${window.location.origin}/api/files/${f.id}`;
                      navigator.clipboard.writeText(absUrl);
                      toast.success("URL file disalin ke clipboard!");
                    }}
                    title="Copy URL"
                  >
                    <LinkIcon className="h-4 w-4" />
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
                    {f.jurusanId && (
                      <div className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                        {jurusans.find(j => j.id === f.jurusanId)?.nama.substring(0, 10)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

