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
  CancelDownload,
  TagFile,
  TagFileManual,
  SelectOutputDir,
  SelectFile,
  OpenFolder,
  GetLogDir,
  GetMp3Tags,
  LogFrontend,
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
  CancelDownload,
  TagFile,
  TagFileManual,
  SelectOutputDir,
  SelectFile,
  OpenFolder,
  GetLogDir,
  GetMp3Tags,
  LogFrontend,
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

export type TrackReady = {
  path: string;
  title: string;
  track: Track | null;
  index: number;
  total: number;
};

export type Settings = {
  outputDir: string;
  cookiePath: string;
};

export type ExistingTags = {
  title: string;
  artist: string;
  album: string;
};