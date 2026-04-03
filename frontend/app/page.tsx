"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StartDownload, TagFile, SearchDeezer, LogFrontend, CheckDeps } from "@/lib/wails";
import { useWailsEvent } from "@/lib/useWailsEvent";
import type { Track } from "@/lib/wails";
import Image from "next/image";
import { Info, Settings, Bug, AlertTriangle } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";
import { BugReportModal } from "@/components/BugReportModal";

type Phase = "idle" | "downloading" | "searching" | "tagging" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<Track | null>(null);
  const [donePath, setDonePath] = useState("");
  const [noMetadata, setNoMetadata] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);

  const downloadedPathRef = useRef<string>("");

  const logToBackend = useCallback((level: string, msg: string) => {
    LogFrontend(level, msg).catch(() => { });
  }, []);

  useEffect(() => {
    CheckDeps()
      .then((status) => {
        const missing: string[] = [];
        if (!status.ytDlp) missing.push("yt-dlp");
        if (!status.ffmpeg) missing.push("ffmpeg");
        setMissingDeps(missing);
      })
      .catch(() => { });
  }, []);

  // Re-check deps when settings modal closes (user may have just installed something)
  function handleSettingsClose() {
    setSettingsOpen(false);
    CheckDeps()
      .then((status) => {
        const missing: string[] = [];
        if (!status.ytDlp) missing.push("yt-dlp");
        if (!status.ffmpeg) missing.push("ffmpeg");
        setMissingDeps(missing);
      })
      .catch(() => { });
  }

  const onReady = useCallback(
    async (payload: unknown) => {
      const { path: filePath } = payload as { path: string };
      downloadedPathRef.current = filePath;
      setPhase("searching");

      let tracks: Track[] = [];
      try {
        const filename =
          filePath.split(/[\\/]/).pop()?.replace(/\.mp3$/i, "") ?? "";
        tracks = await SearchDeezer(filename);
      } catch (e) {
        logToBackend("warn", `deezer search failed: ${e}`);
      }

      if (tracks.length === 0) {
        logToBackend("warn", "no deezer metadata found — saved without metadata");
        setNoMetadata(true);
        setDonePath(filePath);
        setPhase("done");
        return;
      }

      const track = tracks[0];
      setSelected(track);
      setPhase("tagging");

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await TagFile({ mp3Path: filePath, track } as any);
      } catch (e) {
        logToBackend("error", `tagging failed: ${e}`);
        setPhase("error");
      }
    },
    [logToBackend]
  );

  const onError = useCallback(
    (msg: unknown) => {
      logToBackend("error", `download:error event: ${msg}`);
      setPhase("error");
    },
    [logToBackend]
  );

  const onDone = useCallback((path: unknown) => {
    setDonePath(String(path));
    setPhase("done");
  }, []);

  useWailsEvent("download:ready", onReady);
  useWailsEvent("download:error", onError);
  useWailsEvent("download:done", onDone);

  async function handleStart() {
    if (!url.trim()) return;
    setPhase("downloading");
    setSelected(null);
    downloadedPathRef.current = "";
    setDonePath("");
    setNoMetadata(false);
    try {
      await StartDownload(url);
    } catch (e) {
      logToBackend("error", `StartDownload failed: ${e}`);
      setPhase("error");
    }
  }

  function reset() {
    setUrl("");
    setPhase("idle");
    setSelected(null);
    downloadedPathRef.current = "";
    setDonePath("");
    setNoMetadata(false);
  }

  const busy =
    phase === "downloading" || phase === "tagging" || phase === "searching";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text tracking-tight">YT Music Downloader</span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setBugOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Report a bug"
          >
            <Bug size={24} />
          </button>
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

      {missingDeps.length > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 bg-destructive/10 border-b border-destructive/30 text-destructive">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="text-xs flex-1">
            Required dependencies missing:{" "}
            <span className="font-semibold">{missingDeps.join(", ")}</span>.
            Downloads will not work until they are installed.
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-xs underline underline-offset-2 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            Install in Settings
          </button>
        </div>
      )}

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

        {busy && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground animate-pulse">
              {phase === "downloading" && "Running yt-dlp..."}
              {phase === "searching" && "Searching Deezer..."}
              {phase === "tagging" && "Embedding metadata..."}
            </span>
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
            <p className="text-xs text-muted-foreground break-all">
              Saved to: {donePath}
            </p>
            <Button variant="outline" onClick={reset}>
              Download another
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-destructive">
              Something went wrong. Check the log file for details.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
              <Button variant="outline" onClick={() => setBugOpen(true)}>
                Report bug
              </Button>
            </div>
          </div>
        )}
      </div>

      <SettingsModal open={settingsOpen} onClose={handleSettingsClose} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <BugReportModal open={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
  );
}