/* eslint-disable @next/next/no-html-link-for-pages */
"use client";

import { Github, Globe } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-tight">About</span>
        <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Back
        </a>
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">YT Music Downloader</span>
          <span className="text-xs text-muted-foreground">
            Download YouTube Music tracks as MP3 with Deezer metadata embedded automatically.
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="https://github.com/rivalarya/yt-music-dl"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <Github size={16} className="text-muted-foreground flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm">GitHub</span>
              <span className="text-xs text-muted-foreground">github.com/rivalarya/yt-music-dl</span>
            </div>
          </a>

          <a
            href="https://rival.my.id"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
          >
            <Globe size={16} className="text-muted-foreground flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm">Website</span>
              <span className="text-xs text-muted-foreground">rival.my.id</span>
            </div>
          </a>
        </div>

        <span className="text-xs text-muted-foreground">Built by rivalarya</span>
      </div>
    </div>
  );
}