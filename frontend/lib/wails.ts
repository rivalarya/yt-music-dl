import {
  CheckDeps,
  InstallYtDlp,
  InstallFfmpeg,
  InstallDeno,
  GetSettings,
  SaveSettings,
  SaveCookieFile,
  SearchDeezer,
  StartDownload,
  TagFile,
  SelectOutputDir,
  OpenFolder,
} from "../wailsjs/go/main/App";

export {
  CheckDeps,
  InstallYtDlp,
  InstallFfmpeg,
  InstallDeno,
  GetSettings,
  SaveSettings,
  SaveCookieFile,
  SearchDeezer,
  StartDownload,
  TagFile,
  SelectOutputDir,
  OpenFolder,
};

export type DepsStatus = {
  ytDlp: boolean;
  ytDlpVersion: string;
  ffmpeg: boolean;
  ffmpegSystem: boolean;
  ffmpegVersion: string;
  deno: boolean;
  denoSystem: boolean;
  denoVersion: string;
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