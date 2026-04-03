"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StartDownload, TagFile, SearchDeezer, GetSettings } from "@/lib/wails";
import { useWailsEvent } from "@/lib/useWailsEvent";
import type { Settings as WailsSettings, Track } from "@/lib/wails";
import Image from "next/image";
import { Info, Settings } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";

// Flow: idle → downloading → picking → tagging → done
type Phase = "idle" | "downloading" | "picking" | "tagging" | "done" | "error";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [mp3Path, setMp3Path] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [donePath, setDonePath] = useState("");
  const [settings, setSettings] = useState<WailsSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    GetSettings().then(setSettings).catch(() => {});
  }, []);

  const appendLog = useCallback((line: unknown) => {
    setLogs((prev) => [...prev, String(line)]);
  }, []);

  const onReady = useCallback(
    async (payload: unknown) => {
      const { path: filePath, title: ytTitle } = payload as { path: string; title: string };
      setMp3Path(filePath);
      appendLog("[done] download complete");
      const q = query.trim() || ytTitle;
      appendLog(`[deezer] searching "${q}" ...`);
      try {
        const tracks = await SearchDeezer(q);
        setResults(tracks);
        if (settings?.autoSelectFirst && tracks.length > 0) {
          await applyTag(filePath, tracks[0]);
        } else {
          setPhase("picking");
        }
      } catch (e) {
        appendLog(`[error] deezer search failed: ${e}`);
        setPhase("error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, url, settings]
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
    setResults([]);
    setSelected(null);
    setMp3Path("");
    setDonePath("");
    try {
      await StartDownload(url);
    } catch (e) {
      appendLog(`[error] ${e}`);
      setPhase("error");
    }
  }

  async function applyTag(filePath: string, track: Track) {
    setSelected(track);
    setPhase("tagging");
    appendLog(`[tagging] ${track.title} — ${track.artist}`);
    try {
      appendLog(`[METADATA] ${filePath} — ${JSON.stringify(track)}`);
      await TagFile({ mp3Path: filePath, track } as any);
    } catch (e) {
      appendLog(`[error] tagging: ${e}`);
      setPhase("error");
    }
  }

  function handleSelectTrack(track: Track) {
    applyTag(mp3Path, track);
  }

  function reset() {
    setUrl("");
    setQuery("");
    setPhase("idle");
    setResults([]);
    setSelected(null);
    setLogs([]);
    setMp3Path("");
    setDonePath("");
  }

  const busy = phase === "downloading" || phase === "tagging";
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
            title="Settings"
          >
            <Settings size={24} />
          </button>
          <a
            href="/about/"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="About"
            title="About"
          >
            <Info size={24} />
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">YouTube Music URL</label>
          <Input
            placeholder="https://music.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
          <label className="text-xs text-muted-foreground">
            Deezer search query{" "}
            <span className="text-muted-foreground/60">(used after download to find metadata)</span>
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Song title + artist name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              disabled={busy}
            />
            <Button onClick={handleStart} disabled={!url.trim() || busy}>
              {phase === "downloading" ? "Downloading..." : "Download"}
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

        {phase === "picking" && results.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Select metadata from Deezer</span>
            <div className="flex flex-col gap-2">
              {results.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleSelectTrack(track)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                >
                  {track.coverUrl && (
                    <Image
                      src={track.coverUrl}
                      alt={track.album}
                      width={48}
                      height={48}
                      className="rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">{track.title}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {track.artist} · {track.album}
                    </span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                    {formatDuration(track.duration)}
                  </span>
                </button>
              ))}
            </div>
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
    </div>
  );
}