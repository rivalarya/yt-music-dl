"use client";

import { Github, Globe, Heart, Send, LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = { open: boolean; onClose: () => void };

type LinkItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  sub: string;
};

const LINKS: LinkItem[] = [
  { href: "https://github.com/rivalarya/yt-music-dl", icon: Github, label: "GitHub", sub: "github.com/rivalarya/yt-music-dl" },
  { href: "https://rival.my.id", icon: Globe, label: "Website", sub: "rival.my.id" },
  { href: "https://teer.id/rivalarya", icon: Heart, label: "Trakteer", sub: "teer.id/rivalarya" },
  { href: "https://t.me/rivalarya", icon: Send, label: "Telegram", sub: "@rivalarya" },
];

function LinkRow({ href, icon: Icon, label, sub }: LinkItem) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors"
    >
      <Icon size={16} className="text-muted-foreground flex-shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-sm">{label}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
    </a>
  );
}

export function AboutModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>YT Music Downloader</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Download YouTube Music tracks as MP3 with Deezer metadata embedded automatically.
          </p>
          <div className="flex flex-col gap-2">
            {LINKS.map((link) => (
              <LinkRow key={link.href} {...link} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Built by rivalarya</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}