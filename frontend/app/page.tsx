"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StartDownload, LogFrontend, CheckDeps } from "@/lib/wails";
import { useWailsEvent } from "@/lib/useWailsEvent";
import type { Track } from "@/lib/wails";
import Image from "next/image";
import { Info, Settings, Bug, AlertTriangle, Music } from "lucide-react";
import { SettingsModal } from "@/components/SettingsModal";
import { AboutModal } from "@/components/AboutModal";
import { BugReportModal } from "@/components/BugReportModal";

type TrackPhase = "tagging" | "done" | "error";

type TrackItem = {
  index: number;
  path: string;
  title: string;
  track: Track | null;
  phase: TrackPhase;
};

type Phase = "idle" | "downloading" | "done" | "error";

function isPlaylistUrl(url: string): boolean {
  return (
    url.includes("playlist?list=") ||
    (url.includes("list=") && !url.includes("watch?v="))
  );
}

function TrackCard({ item }: { item: TrackItem }) {
  const badgeVariant = item.phase === "done" ? "outline" : "secondary";
  const badgeLabel =
    item.phase === "tagging"
      ? "Tagging..."
      : item.phase === "done"
        ? "Done"
        : "Error";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-accent/20">
      {item.track?.coverUrl ? (
        <Image
          src={item.track.coverUrl}
          alt={item.track.album}
          width={44}
          height={44}
          className="rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-11 h-11 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Music size={16} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-sm truncate">
          {item.track?.title ?? item.title}
        </span>
        {item.track ? (
          <span className="text-xs text-muted-foreground truncate">
            {item.track.artist} · {item.track.album}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No metadata found</span>
        )}
      </div>
      <Badge variant={badgeVariant} className="flex-shrink-0 ml-auto">
        {badgeLabel}
      </Badge>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [dlPercent, setDlPercent] = useState(0);
  const [playlistInfo, setPlaylistInfo] = useState<{ current: number; total: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [missingDeps, setMissingDeps] = useState<string[]>([]);

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

  const onDownloadLog = useCallback((line: unknown) => {
    const text = String(line);

    const pctMatch = text.match(/\[download\]\s+([\d.]+)%/);
    if (pctMatch) {
      setDlPercent(Math.round(parseFloat(pctMatch[1])));
    }

    // "[download] Downloading item 3 of 13"
    const itemMatch = text.match(/Downloading item (\d+) of (\d+)/);
    if (itemMatch) {
      setPlaylistInfo({
        current: parseInt(itemMatch[1]),
        total: parseInt(itemMatch[2]),
      });
      setDlPercent(0);
    }
  }, []);

  useWailsEvent("download:log", onDownloadLog);

  const onTrack = useCallback(
    (payload: unknown) => {
      const { path, title, track, index } = payload as {
        path: string;
        title: string;
        track: Track | null;
        index: number;
        total: number;
      };

      setTracks((prev) => {
        const existing = prev.findIndex((t) => t.index === index);
        const item: TrackItem = {
          index,
          path,
          title,
          track,
          phase: "done",
        };
        if (existing !== -1) {
          const next = [...prev];
          next[existing] = item;
          return next;
        }
        return [...prev, item].sort((a, b) => a.index - b.index);
      });
    },
    []
  );

  const onError = useCallback(
    (msg: unknown) => {
      logToBackend("error", `download:error event: ${msg}`);
      setPhase("error");
    },
    [logToBackend]
  );

  const onPlaylistDone = useCallback(() => {
    setPhase("done");
  }, []);

  // Single track backward compat: "download:done" still fires from TagFile
  const onDone = useCallback(() => {
    setPhase("done");
  }, []);

  useWailsEvent("download:track", onTrack);
  useWailsEvent("download:error", onError);
  useWailsEvent("download:playlist-done", onPlaylistDone);
  useWailsEvent("download:done", onDone);

  async function handleStart() {
    if (!url.trim()) return;
    setPhase("downloading");
    setTracks([]);
    setDlPercent(0);
    setPlaylistInfo(null);

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
    setTracks([]);
    setDlPercent(0);
    setPlaylistInfo(null);
  }

  const busy = phase === "downloading";
  const playlist = isPlaylistUrl(url);

  const doneCount = tracks.filter((t) => t.phase === "done").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold tracking-tight">YT Music Downloader</span>
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

      {/* Missing deps banner */}
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
        {/* URL input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">
            YouTube Music URL{" "}
            {url && (
              <span className="text-primary font-medium">
                — {playlist ? "Playlist" : "Single track"}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="https://music.youtube.com/watch?v=... or playlist?list=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              disabled={busy}
            />
            <Button onClick={handleStart} disabled={!url.trim() || busy}>
              {busy ? "Downloading..." : "Download"}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {phase === "downloading" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              {playlistInfo ? (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Track {playlistInfo.current} of {playlistInfo.total}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Downloading...
                </span>
              )}
              {dlPercent > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {dlPercent}%
                </span>
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150 ease-linear"
                style={{ width: `${dlPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Track list */}
        {tracks.length > 0 && (
          <div className="flex flex-col gap-2">
            {(phase === "done" || playlistInfo) && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {phase === "done"
                    ? `${doneCount} track${doneCount !== 1 ? "s" : ""} downloaded`
                    : `${doneCount} of ${playlistInfo?.total ?? "?"} tagged`}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {tracks.map((item) => (
                <TrackCard key={item.index} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Done actions */}
        {phase === "done" && (
          <Button variant="outline" onClick={reset}>
            Download another
          </Button>
        )}

        {/* Error */}
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