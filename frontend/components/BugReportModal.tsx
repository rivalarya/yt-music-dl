"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GetLogDir, OpenFolder } from "@/lib/wails";
import { ExternalLink, FolderOpen } from "lucide-react";

const GITHUB_ISSUES = "https://github.com/rivalarya/yt-music-dl/issues/new";

type Props = { open: boolean; onClose: () => void };

export function BugReportModal({ open, onClose }: Props) {
  const [logDir, setLogDir] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleExportLog() {
    setError("");
    try {
      const dir = await GetLogDir();
      setLogDir(dir);
      await OpenFolder(dir);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleOpenIssue() {
    const body = logDir
      ? `**Steps to reproduce:**\n\n1. \n\n**Log file location:** \`${logDir}\\app.log\`\n\n**Paste relevant log lines below:**\n\n\`\`\`\n\n\`\`\``
      : `**Steps to reproduce:**\n\n1. \n`;
    const url = `${GITHUB_ISSUES}?body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
          <DialogDescription>
            Export the log file, then open a GitHub issue with the relevant log lines attached.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Step 1 — open the log folder and copy the relevant lines from{" "}
              <span className="font-mono">app.log</span>.
            </p>
            <Button variant="outline" onClick={handleExportLog} className="gap-2">
              <FolderOpen size={14} />
              Open log folder
            </Button>
            {logDir && (
              <p className="text-xs text-muted-foreground break-all">
                {logDir}
              </p>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Step 2 — open a GitHub issue. The template will include a placeholder for the log.
            </p>
            <Button onClick={handleOpenIssue} className="gap-2">
              <ExternalLink size={14} />
              Open GitHub issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}