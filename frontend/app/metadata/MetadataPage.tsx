"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SelectFile,
  GetMp3Tags,
  SearchDeezer,
  TagFileManual,
  LogFrontend,
} from "@/lib/wails";
import type { Track, ExistingTags } from "@/lib/wails";
import Image from "next/image";
import {
  ArrowLeft,
  Music,
  Search,
  FolderOpen,
  Check,
  Loader2,
  User,
  Disc3,
  FileAudio,
} from "lucide-react";
import Link from "next/link";

type Phase = "idle" | "saving" | "done" | "error";

function TrackResult({
  track,
  selected,
  onSelect,
}: {
  track: Track;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border hover:bg-accent/30"
      }`}
    >
      {track.coverUrl ? (
        <Image
          src={track.coverUrl}
          alt={track.album}
          width={40}
          height={40}
          className="rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Music size={14} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-medium truncate">{track.title}</span>
        <span className="text-xs text-muted-foreground truncate">
          {track.artist} · {track.album}
        </span>
      </div>
      {selected && <Check size={14} className="text-primary flex-shrink-0" />}
    </button>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon size={11} />
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm"
      />
    </div>
  );
}

export default function MetadataPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filePath, setFilePath] = useState(searchParams.get("path") ?? "");
  const [fileName, setFileName] = useState("");

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [query, setQuery] = useState(searchParams.get("title") ?? "");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = useCallback((level: string, msg: string) => {
    LogFrontend(level, msg).catch(() => {});
  }, []);

  const triggerSearch = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      setSearching(true);
      SearchDeezer(q)
        .then((tracks) => setResults(tracks.slice(0, 6)))
        .catch((e: unknown) => log("warn", `SearchDeezer: ${e}`))
        .finally(() => setSearching(false));
    },
    [log]
  );

  // When file path changes, read existing tags and auto-search
  useEffect(() => {
    if (!filePath) return;
    setFileName(filePath.split("\\").pop()?.replace(/\.mp3$/i, "") ?? "");

    GetMp3Tags(filePath)
      .then((tags: ExistingTags) => {
        if (tags.title) setTitle(tags.title);
        if (tags.artist) setArtist(tags.artist);
        if (tags.album) setAlbum(tags.album);
        const q = tags.title || filePath.split("\\").pop()?.replace(/\.mp3$/i, "") || "";
        if (q) {
          setQuery(q);
          triggerSearch(q);
        }
      })
      .catch((e: unknown) => log("warn", `GetMp3Tags: ${e}`));
  }, [filePath, triggerSearch, log]);

  // Auto-search from ?title= param on mount
  useEffect(() => {
    const t = searchParams.get("title");
    if (t) triggerSearch(t);
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => triggerSearch(val), 500);
  }

  function handleSelectTrack(track: Track) {
    setSelectedTrack(track);
    setTitle(track.title);
    setArtist(track.artist);
    setAlbum(track.album);
    setCoverUrl(track.coverUrl);
  }

  async function handlePickFile() {
    try {
      const path = await SelectFile();
      if (path) setFilePath(path);
    } catch (e) {
      log("error", `SelectFile: ${e}`);
    }
  }

  async function handleSave() {
    if (!filePath) return;
    setPhase("saving");
    setErrorMsg("");
    try {
      await TagFileManual({ mp3Path: filePath, title, artist, album, coverUrl });
      setPhase("done");
    } catch (e) {
      log("error", `TagFileManual: ${e}`);
      setErrorMsg(String(e));
      setPhase("error");
    }
  }

  function reset() {
    setFilePath("");
    setFileName("");
    setTitle("");
    setArtist("");
    setAlbum("");
    setCoverUrl("");
    setQuery("");
    setResults([]);
    setSelectedTrack(null);
    setPhase("idle");
    setErrorMsg("");
  }

  const canSave = filePath && phase !== "saving" && phase !== "done";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="font-semibold tracking-tight">Metadata Fixer</span>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
        {/* File picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">MP3 file</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 min-w-0">
              <FileAudio size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate text-muted-foreground">
                {filePath || "No file selected"}
              </span>
            </div>
            <Button variant="outline" onClick={handlePickFile} className="gap-2 flex-shrink-0">
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>
        </div>

        {filePath && (
          <>
            {/* Deezer search */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground">
                Search Deezer to autofill metadata
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  className="pl-8 text-sm"
                  placeholder="Search by track name..."
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                />
                {searching && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
                  />
                )}
              </div>

              {results.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {results.map((t) => (
                    <TrackResult
                      key={t.id}
                      track={t}
                      selected={selectedTrack?.id === t.id}
                      onSelect={() => handleSelectTrack(t)}
                    />
                  ))}
                </div>
              )}

              {!searching && query && results.length === 0 && (
                <p className="text-xs text-muted-foreground">No results found.</p>
              )}
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3">
              <label className="text-xs text-muted-foreground">
                Metadata fields{" "}
                <span className="text-foreground/50">— edit freely</span>
              </label>
              <FieldRow icon={Music} label="Title" value={title} onChange={setTitle} placeholder={fileName || "Track title"} />
              <FieldRow icon={User} label="Artist" value={artist} onChange={setArtist} placeholder="Artist name" />
              <FieldRow icon={Disc3} label="Album" value={album} onChange={setAlbum} placeholder="Album name" />
              <FieldRow icon={Search} label="Cover URL" value={coverUrl} onChange={setCoverUrl} placeholder="https://..." />
            </div>

            {/* Preview */}
            {(title || artist || coverUrl) && (
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-accent/10">
                {coverUrl ? (
                  <Image
                    src={coverUrl}
                    alt={album || "cover"}
                    width={56}
                    height={56}
                    className="rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Music size={20} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 gap-0.5">
                  <span className="font-semibold text-sm truncate">{title || "Untitled"}</span>
                  <span className="text-xs text-muted-foreground truncate">{artist || "Unknown artist"}</span>
                  {album && <span className="text-xs text-muted-foreground truncate">{album}</span>}
                </div>
                {selectedTrack && (
                  <Badge variant="outline" className="ml-auto flex-shrink-0 text-xs">
                    Deezer
                  </Badge>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {phase === "done" ? (
                <Button variant="outline" onClick={reset} className="gap-2">
                  <Check size={14} />
                  Saved — fix another
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={!canSave} className="gap-2">
                  {phase === "saving" && <Loader2 size={14} className="animate-spin" />}
                  {phase === "saving" ? "Saving..." : "Save metadata"}
                </Button>
              )}
            </div>

            {phase === "error" && (
              <p className="text-xs text-destructive">{errorMsg || "Something went wrong."}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}