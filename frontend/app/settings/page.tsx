"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { GetSettings, SaveSettings, SelectOutputDir, InstallDeps, CheckDeps } from "@/lib/wails";
import type { Settings, DepsStatus } from "@/lib/wails";
import { CookieModal } from "@/components/CookieModal";
import { useWailsEvent } from "@/lib/useWailsEvent";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    autoSelectFirst: false,
    outputDir: "",
    cookiePath: "",
  });
  const [deps, setDeps] = useState<DepsStatus | null>(null);
  const [cookieOpen, setCookieOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    GetSettings().then(setSettings).catch(() => {});
    CheckDeps().then(setDeps).catch(() => {});
  }, []);

  const appendLog = useCallback((line: unknown) => {
    setInstallLogs((prev) => [...prev, String(line)]);
  }, []);

  useWailsEvent("deps:log", appendLog);

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

  async function handleInstallDeps() {
    setInstalling(true);
    setInstallLogs([]);
    try {
      await InstallDeps();
      const status = await CheckDeps();
      setDeps(status);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-tight">Settings</span>
        <Link href="/">
            ← Back
        </Link>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
        {/* Download settings */}
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

        {/* Cookie */}
        <Section title="YouTube Cookie">
          <Row
            label="Cookie file"
            description={settings.cookiePath ? settings.cookiePath : "Not set — recommended for best results"}
          >
            <Button variant="outline" size="sm" onClick={() => setCookieOpen(true)}>
              {settings.cookiePath ? "Update" : "Set"}
            </Button>
          </Row>
        </Section>

        <Separator />

        {/* Dependencies */}
        <Section title="Dependencies">
          <div className="flex flex-col gap-2">
            <DepRow label="yt-dlp" ok={deps?.ytDlp} />
            <DepRow label="ffmpeg" ok={deps?.ffmpeg} />
            <DepRow label="deno" ok={deps?.deno} />
          </div>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={handleInstallDeps}
            disabled={installing}
          >
            {installing ? "Installing..." : "Update / Redownload dependencies"}
          </Button>

          {installLogs.length > 0 && (
            <ScrollArea className="h-36 rounded-lg border border-border bg-black/40 p-3 mt-2">
              <div className="flex flex-col gap-0.5 font-mono text-xs text-green-400">
                {installLogs.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            </ScrollArea>
          )}
        </Section>

        <Separator />

        {/* Save */}
        <Button onClick={handleSave} disabled={saving}>
          {saved ? "Saved" : saving ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <CookieModal
        open={cookieOpen}
        onClose={() => setCookieOpen(false)}
        onSaved={() => GetSettings().then(setSettings).catch(() => {})}
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
        {description && (
          <span className="text-xs text-muted-foreground truncate">{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function DepRow({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={ok ? "text-green-500 text-xs" : "text-destructive text-xs"}>
        {ok === undefined ? "checking..." : ok ? "installed" : "missing"}
      </span>
    </div>
  );
}