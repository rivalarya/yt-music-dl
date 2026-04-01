"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SaveCookieFile } from "@/lib/wails";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const HOW_TO = `1. Install Chrome extension: "Get cookies.txt (LOCALLY)"
2. Open https://www.youtube.com (make sure you're logged in)
3. Click the extension → Export cookies
4. Copy the full contents of cookies.txt and paste below`;

export function CookieModal({ open, onClose, onSaved }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError("");
    try {
      await SaveCookieFile(content);
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>YouTube Cookie File</DialogTitle>
          <DialogDescription>
            Required for downloading age-restricted or login-required content.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">How to get your cookies</p>
            <pre className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{HOW_TO}</pre>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Paste cookies.txt content</label>
            <Textarea
              className="font-mono text-xs h-40 resize-none"
              placeholder="# Netscape HTTP Cookie File..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!content.trim() || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}