import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { groupsRepo, usersRepo } from "@/lib/cbt/repos";
import { uid } from "@/lib/cbt/storage";
import type { Group } from "@/lib/cbt/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/peserta/group")({
  component: GroupPage,
});

function GroupPage() {
  const [groups, setGroups] = useState<Group[]>(groupsRepo.all());
  const [nama, setNama] = useState("");
  const peserta = usersRepo.all().filter((u) => u.role === "mahasiswa");

  function add() {
    if (!nama.trim()) return;
    groupsRepo.upsert({ id: uid("g_"), nama: nama.trim(), keterangan: "" });
    setNama(""); setGroups(groupsRepo.all()); toast.success("Group ditambahkan");
  }
  function remove(id: string) {
    if (peserta.some((p) => p.groupId === id)) { toast.error("Masih ada peserta dalam group ini"); return; }
    if (!confirm("Hapus group?")) return;
    groupsRepo.remove(id); setGroups(groupsRepo.all());
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Group Peserta</h1>
      <div className="flex gap-2">
        <Input placeholder="Nama group (mis. XII IPA 3)" value={nama} onChange={(e) => setNama(e.target.value)} />
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Tambah</Button>
      </div>
      <Card><CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Nama</th><th className="p-3">Jumlah Peserta</th><th className="p-3 text-right">Aksi</th></tr></thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-b last:border-0">
                <td className="p-3">{g.nama}</td>
                <td className="p-3">{peserta.filter((p) => p.groupId === g.id).length}</td>
                <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
              </tr>
            ))}
            {groups.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Belum ada group.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
