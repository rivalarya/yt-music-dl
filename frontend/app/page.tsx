"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StartDownload, TagFile, SearchDeezer } from "@/lib/wails";
import { useWailsEvent } from "@/lib/useWailsEvent";
import type { Track } from "@/lib/wails";
import Image from "next/image";
import { Info, Settings } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";

// Flow: idle → downloading → searching → tagging → done
type Phase = "idle" | "downloading" | "searching" | "tagging" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<Track | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [donePath, setDonePath] = useState("");
  const [noMetadata, setNoMetadata] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const downloadedPathRef = useRef<string>("");
  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((line: unknown) => {
    setLogs((prev) => [...prev, String(line)]);
  }, []);

  const onReady = useCallback(
    async (payload: unknown) => {
      const { path: filePath } = payload as { path: string };
      downloadedPathRef.current = filePath;
      appendLog("[done] download complete");
      appendLog("[deezer] searching metadata...");
      setPhase("searching");

      let tracks: Track[] = [];
      try {
        const filename = filePath.split(/[\\/]/).pop()?.replace(/\.mp3$/i, "") ?? "";
        tracks = await SearchDeezer(filename);
      } catch (e) {
        appendLog(`[warn] deezer search failed: ${e}`);
      }

      if (tracks.length === 0) {
        appendLog("[deezer] no metadata found — saved without metadata");
        setNoMetadata(true);
        setDonePath(filePath);
        setPhase("done");
        return;
      }

      const track = tracks[0];
      setSelected(track);
      setPhase("tagging");
      appendLog(`[metadata] ${track.title} — ${track.artist}`);
      appendLog("[tagging] embedding metadata...");
      try {
        await TagFile({ mp3Path: filePath, track } as any);
      } catch (e) {
        appendLog(`[error] tagging: ${e}`);
        setPhase("error");
      }
    },
    [appendLog]
  );

  const onError = useCallback(
    (msg: unknown) => {
      appendLog(`[error] ${msg}`);
      setPhase("error");
    },
    [appendLog]
  );

  const onDone = useCallback((path: unknown) => {
    setDonePath(String(path));
    setPhase("done");
  }, []);

  useWailsEvent("download:log", appendLog);
  useWailsEvent("download:ready", onReady);
  useWailsEvent("download:error", onError);
  useWailsEvent("download:done", onDone);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleStart() {
    if (!url.trim()) return;
    setPhase("downloading");
    setLogs([]);
    setSelected(null);
    downloadedPathRef.current = "";
    setDonePath("");
    setNoMetadata(false);
    try {
      await StartDownload(url);
    } catch (e) {
      appendLog(`[error] ${e}`);
      setPhase("error");
    }
  }

  function reset() {
    setUrl("");
    setPhase("idle");
    setSelected(null);
    downloadedPathRef.current = "";
    setLogs([]);
    setDonePath("");
    setNoMetadata(false);
  }

  const busy = phase === "downloading" || phase === "tagging" || phase === "searching";
  const showLog = phase !== "idle";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text tracking-tight">YT Music Downloader</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Settings"
          >
            <Settings size={24} />
          </button>
          <button
            onClick={() => setAboutOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="About"
          >
            <Info size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">YouTube Music URL</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://music.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              disabled={busy}
            />
            <Button onClick={handleStart} disabled={!url.trim() || busy}>
              {phase === "downloading"
                ? "Downloading..."
                : phase === "searching"
                ? "Searching..."
                : "Download"}
            </Button>
          </div>
        </div>

        {showLog && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Log</span>
              {phase === "downloading" && (
                <span className="text-xs text-yellow-500 animate-pulse">running yt-dlp...</span>
              )}
              {phase === "searching" && (
                <span className="text-xs text-yellow-500 animate-pulse">searching deezer...</span>
              )}
              {phase === "tagging" && (
                <span className="text-xs text-blue-400 animate-pulse">tagging...</span>
              )}
            </div>
            <ScrollArea className="h-48 rounded-lg border border-border bg-black/40 p-3">
              <div className="flex flex-col gap-0.5 font-mono text-xs text-green-400">
                {logs.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}

        {selected && (phase === "tagging" || phase === "done") && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-accent/30">
            {selected.coverUrl && (
              <Image
                src={selected.coverUrl}
                alt={selected.album}
                width={48}
                height={48}
                className="rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-sm truncate">{selected.title}</span>
              <span className="text-xs text-muted-foreground truncate">
                {selected.artist} · {selected.album}
              </span>
            </div>
            <Badge variant="outline" className="ml-auto flex-shrink-0">
              {phase === "tagging" ? "Tagging..." : "Done"}
            </Badge>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-2">
            {noMetadata && (
              <p className="text-xs text-yellow-500">
                No metadata found on Deezer. Downloaded without metadata.
              </p>
            )}
            <p className="text-xs text-muted-foreground break-all">Saved to: {donePath}</p>
            <Button variant="outline" onClick={reset}>
              Download another
            </Button>
          </div>
        )}

        {phase === "error" && (
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}