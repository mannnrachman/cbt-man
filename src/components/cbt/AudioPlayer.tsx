// Audio player dengan opsi "play once" — block seek/replay.
import { useEffect, useRef, useState } from "react";
import { getObjectURL } from "@/lib/cbt/files";
import { Button } from "@/components/ui/button";
import { Play, Pause, Lock } from "lucide-react";

export function AudioPlayer({
  fileId,
  playOnce,
  storageKey,
}: {
  fileId: string;
  playOnce: boolean;
  storageKey?: string; // simpan flag "sudah diputar" di localStorage
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<boolean>(() => {
    if (!playOnce || !storageKey || typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  });
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let revoked: string | null = null;
    (async () => {
      const u = await getObjectURL(fileId);
      if (u) {
        setUrl(u);
        revoked = u;
      }
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileId]);

  function toggle() {
    if (done && playOnce) return;
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  if (!url) return <div className="text-label text-muted-foreground">Memuat audio…</div>;

  return (
    <div className="flex items-center gap-2 rounded border bg-muted/30 p-2">
      <Button type="button" size="sm" variant="outline" onClick={toggle} disabled={done && playOnce}>
        {done && playOnce ? <Lock className="h-4 w-4" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="text-label text-muted-foreground">
        {playOnce ? (done ? "Audio sudah diputar (tidak bisa diulang)" : "Audio hanya bisa diputar 1 kali") : "Audio"}
      </span>
      <audio
        ref={ref}
        src={url}
        onEnded={() => {
          setPlaying(false);
          if (playOnce) {
            setDone(true);
            if (storageKey) localStorage.setItem(storageKey, "1");
          }
        }}
        onPause={() => setPlaying(false)}
        controlsList={playOnce ? "nodownload noplaybackrate" : undefined}
      />
    </div>
  );
}
