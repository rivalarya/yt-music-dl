/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Info } from "lucide-react";
import {
  GetSettings,
  SaveSettings,
  SelectOutputDir,
  InstallYtDlp,
  InstallFfmpeg,
  InstallDeno,
  CheckDeps,
} from "@/lib/wails";
import type { Settings, DepsStatus } from "@/lib/wails";
import { CookieModal } from "@/components/CookieModal";
import { useWailsEvent } from "@/lib/useWailsEvent";

type DepKey = "ytDlp" | "ffmpeg" | "deno";

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-flex items-center" ref={ref}>
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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    autoSelectFirst: false,
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
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    GetSettings().then(setSettings).catch(() => { });
    CheckDeps().then(setDeps).catch(() => { });
  }, []);

  const appendLog = useCallback((line: unknown) => {
    setInstallLogs((prev) => [...prev, String(line)]);
  }, []);

  useWailsEvent("deps:log", appendLog);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [installLogs]);

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

  async function handleInstall(key: DepKey) {
    setInstalling((prev) => ({ ...prev, [key]: true }));
    setInstallLogs([]);
    try {
      if (key === "ytDlp") await InstallYtDlp();
      else if (key === "ffmpeg") await InstallFfmpeg();
      else await InstallDeno();
      const status = await CheckDeps();
      setDeps(status);
    } catch (e) {
      appendLog(`[error] ${e}`);
    } finally {
      setInstalling((prev) => ({ ...prev, [key]: false }));
    }
  }

  const anyInstalling = Object.values(installing).some(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-tight">Settings</span>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </a>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
        <Section title="Download">
          <Row label="Auto-select first Deezer result" description="Skip manual metadata selection">
            <Switch
              checked={settings.autoSelectFirst}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, autoSelectFirst: v }))}
            />
          </Row>
          <div className="flex flex-col gap-1 pt-1">
            <label className="text-xs text-muted-foreground">Output directory</label>
            <div className="flex gap-2">
              <Input
                value={settings.outputDir}
                onChange={(e) => setSettings((s) => ({ ...s, outputDir: e.target.value }))}
                className="flex-1 text-sm"
              />
              <Button variant="outline" onClick={handlePickDir}>
                Browse
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
              onInstall={() => handleInstall("deno")}
              disabled={anyInstalling}
              infoText="yt-dlp uses JavaScript to extract video info from YouTube. By default it uses a built-in JS runtime. With Deno installed, yt-dlp can use it instead — more reliable when YouTube updates break the built-in runtime."
            />
          </div>

          {/* Fixed-height log area — does not grow the page */}
          {installLogs.length > 0 && (
            <div className="mt-3 h-36 rounded-lg border border-border bg-black/40 overflow-hidden">
              <ScrollArea className="h-full p-3">
                <div className="flex flex-col gap-0.5 font-mono text-xs text-green-400">
                  {installLogs.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </div>
          )}
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
                {settings.cookiePath ? settings.cookiePath : "Not set — recommended if downloads fail"}
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

      <CookieModal
        open={cookieOpen}
        onClose={() => setCookieOpen(false)}
        onSaved={() => GetSettings().then(setSettings).catch(() => { })}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
      {children}
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <span className="text-sm">{label}</span>
        {description && <span className="text-xs text-muted-foreground truncate">{description}</span>}
      </div>
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
  onInstall: () => void;
  disabled: boolean;
  infoText?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Left: label + description */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {infoText && <Tooltip text={infoText} />}
        </div>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>

      {/* Right: status + version + button — fixed width so it never wraps into the label */}
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
          {/* Version — fixed max width, truncate if somehow still long */}
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
            className="text-xs h-7 px-3 flex-shrink-0"
          >
            {installing ? "Installing..." : ok ? "Update" : "Install"}
          </Button>
        )}
      </div>
    </div>
  );
}