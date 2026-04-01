import {
  CheckDeps,
  InstallDeps,
  GetSettings,
  SaveSettings,
  SaveCookieFile,
  SearchDeezer,
  StartDownload,
  TagFile,
  SelectOutputDir,
} from "../wailsjs/go/main/App";

export { CheckDeps, InstallDeps, GetSettings, SaveSettings, SaveCookieFile, SearchDeezer, StartDownload, TagFile, SelectOutputDir };

export type DepsStatus = {
  ytDlp: boolean;
  ffmpeg: boolean;
  deno: boolean;
};

export type Track = {
  id: number;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
};

export type Settings = {
  autoSelectFirst: boolean;
  outputDir: string;
  cookiePath: string;
};