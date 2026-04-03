"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, FolderOpen } from "lucide-react";
import {
  GetSettings,
  SaveSettings,
  SelectOutputDir,
  InstallYtDlp,
  InstallFfmpeg,
  InstallDeno,
  CheckDeps,
  OpenFolder,
} from "@/lib/wails";
import type { Settings, DepsStatus } from "@/lib/wails";
import { CookieModal } from "@/components/CookieModal";
import { useWailsEvent } from "@/lib/useWailsEvent";

type DepKey = "ytDlp" | "ffmpeg" | "deno";
type DepPhase = "idle" | "downloading" | "extracting";

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="More information"
      >
        <Info size={14} />
      </button>
      {visible && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
          {text}
        </div>
      )}
    </div>
  );
}

type Props = { open: boolean; onClose: () => void };

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({
    outputDir: "",
    cookiePath: "",
  });
  const [deps, setDeps] = useState<DepsStatus | null>(null);
  const [cookieOpen, setCookieOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [installing, setInstalling] = useState<Record<DepKey, boolean>>({
    ytDlp: false,
    ffmpeg: false,
    deno: false,
  });
  const [progress, setProgress] = useState<Record<DepKey, number>>({
    ytDlp: 0,
    ffmpeg: 0,
    deno: 0,
  });
  const [depPhase, setDepPhase] = useState<Record<DepKey, DepPhase>>({
    ytDlp: "idle",
    ffmpeg: "idle",
    deno: "idle",
  });
  const activeDepRef = useRef<DepKey | null>(null);

  useEffect(() => {
    if (!open) return;
    GetSettings().then(setSettings).catch(() => { });
    CheckDeps().then(setDeps).catch(() => { });
  }, [open]);

  const onDepLog = useCallback((line: unknown) => {
    const text = String(line);
    const key = activeDepRef.current;
    if (!key) return;

    if (text.startsWith("[progress]")) {
      const pct = parseInt(text.replace("[progress]", "").trim(), 10);
      if (!isNaN(pct)) {
        setProgress((prev) => ({ ...prev, [key]: pct }));
        setDepPhase((prev) => ({ ...prev, [key]: "downloading" }));
      }
    } else if (text.startsWith("[extract]")) {
      setDepPhase((prev) => ({ ...prev, [key]: "extracting" }));
    }
  }, []);

  useWailsEvent("deps:log", onDepLog);

  async function handleSave() {
    setSaving(true);
    try {
      await SaveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickDir() {
    const dir = await SelectOutputDir();
    if (dir) setSettings((s) => ({ ...s, outputDir: dir }));
  }

  async function handleOpenFolder() {
    await OpenFolder(settings.outputDir);
  }

  async function handleInstall(key: DepKey) {
    activeDepRef.current = key;
    setInstalling((prev) => ({ ...prev, [key]: true }));
    setProgress((prev) => ({ ...prev, [key]: 0 }));
    setDepPhase((prev) => ({ ...prev, [key]: "downloading" }));
    try {
      if (key === "ytDlp") await InstallYtDlp();
      else if (key === "ffmpeg") await InstallFfmpeg();
      else await InstallDeno();
      const status = await CheckDeps();
      setDeps(status);
    } catch (_) {
      // silently reset
    } finally {
      setInstalling((prev) => ({ ...prev, [key]: false }));
      setDepPhase((prev) => ({ ...prev, [key]: "idle" }));
      setProgress((prev) => ({ ...prev, [key]: 0 }));
      activeDepRef.current = null;
    }
  }

  const anyInstalling = Object.values(installing).some(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6">
            <Section title="Download">
              <div className="flex flex-col gap-1 pt-1">
                <label className="text-xs text-muted-foreground">Output directory</label>
                <div className="flex gap-2">
                  <Input
                    value={settings.outputDir}
                    onChange={(e) => setSettings((s) => ({ ...s, outputDir: e.target.value }))}
                    className="flex-1 text-sm"
                  />
                  <Button variant="outline" onClick={handlePickDir}>Browse</Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenFolder}
                    disabled={!settings.outputDir}
                    title="Open in Explorer"
                  >
                    <FolderOpen size={15} />
                  </Button>
                </div>
              </div>
            </Section>

            <Separator />

            <Section title="Dependencies">
              <div className="flex flex-col gap-4">
                <DepRow
                  label="yt-dlp"
                  description="Required — downloads audio from YouTube Music"
                  ok={deps?.ytDlp}
                  version={deps?.ytDlpVersion}
                  systemProvided={false}
                  installing={installing.ytDlp}
                  progress={progress.ytDlp}
                  depPhase={depPhase.ytDlp}
                  onInstall={() => handleInstall("ytDlp")}
                  disabled={anyInstalling}
                />
                <DepRow
                  label="ffmpeg"
                  description="Required — converts audio to MP3"
                  ok={deps?.ffmpeg}
                  version={deps?.ffmpegVersion}
                  systemProvided={deps?.ffmpegSystem}
                  installing={installing.ffmpeg}
                  progress={progress.ffmpeg}
                  depPhase={depPhase.ffmpeg}
                  onInstall={() => handleInstall("ffmpeg")}
                  disabled={anyInstalling}
                />
                <DepRow
                  label="deno"
                  description="Optional"
                  ok={deps?.deno}
                  version={deps?.denoVersion}
                  systemProvided={deps?.denoSystem}
                  installing={installing.deno}
                  progress={progress.deno}
                  depPhase={depPhase.deno}
                  onInstall={() => handleInstall("deno")}
                  disabled={anyInstalling}
                  infoText="yt-dlp uses JavaScript to extract video info from YouTube. By default it uses a built-in JS runtime. With Deno installed, yt-dlp can use it instead — more reliable when YouTube updates break the built-in runtime."
                />
              </div>
            </Section>

            <Separator />

            <Section title="YouTube Cookie">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col min-w-0 gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">Cookie file</span>
                    <Tooltip text="YouTube sometimes blocks yt-dlp thinking it's a bot. Providing your browser cookies proves you're a real logged-in user, bypassing the block and enabling age-restricted downloads." />
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {settings.cookiePath
                      ? settings.cookiePath
                      : "Not set — recommended if downloads fail"}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCookieOpen(true)}>
                  {settings.cookiePath ? "Update" : "Set"}
                </Button>
              </div>
            </Section>

            <Separator />

            <Button onClick={handleSave} disabled={saving}>
              {saved ? "Saved" : saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CookieModal
        open={cookieOpen}
        onClose={() => setCookieOpen(false)}
        onSaved={() => GetSettings().then(setSettings).catch(() => { })}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </span>
      {children}
    </div>
  );
}

function DepRow({
  label,
  description,
  ok,
  version,
  systemProvided,
  installing,
  progress,
  depPhase,
  onInstall,
  disabled,
  infoText,
}: {
  label: string;
  description: string;
  ok?: boolean;
  version?: string;
  systemProvided?: boolean;
  installing: boolean;
  progress: number;
  depPhase: DepPhase;
  onInstall: () => void;
  disabled: boolean;
  infoText?: string;
}) {
  const buttonLabel = () => {
    if (!installing) return ok ? "Update" : "Install";
    if (depPhase === "extracting") return "Installing...";
    return `${progress}%`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            {infoText && <Tooltip text={infoText} />}
          </div>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex flex-col items-end min-w-0">
            {ok === undefined ? (
              <span className="text-xs text-muted-foreground">checking...</span>
            ) : ok ? (
              <span className="text-xs text-green-500">
                {systemProvided ? "system" : "installed"}
              </span>
            ) : (
              <span className="text-xs text-destructive">missing</span>
            )}
            {ok && version && (
              <span className="text-xs text-muted-foreground font-mono max-w-[120px] truncate text-right">
                {version}
              </span>
            )}
          </div>
          {!systemProvided && (
            <Button
              variant="outline"
              size="sm"
              onClick={onInstall}
              disabled={disabled}
              className="text-xs h-7 px-3 flex-shrink-0 min-w-[80px] tabular-nums"
            >
              {buttonLabel()}
            </Button>
          )}
        </div>
      </div>
      {installing && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-150 ease-linear"
            style={{ width: depPhase === "extracting" ? "100%" : `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}