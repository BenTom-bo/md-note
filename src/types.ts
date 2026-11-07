export interface Components {
  core: boolean;
  fileAssociation: boolean;
  contextMenu: boolean;
  autostart: boolean;
  gfm: boolean;
  highlight: boolean;
  katex: boolean;
  mermaid: boolean;
  toc: boolean;
  footnotes: boolean;
  pasteImage: boolean;
}

export const DEFAULT_COMPONENTS: Components = {
  core: true,
  fileAssociation: true,
  contextMenu: true,
  autostart: false,
  gfm: true,
  highlight: true,
  katex: true,
  mermaid: true,
  toc: true,
  footnotes: true,
  pasteImage: true,
};

export interface Tab {
  id: string;
  title: string;
  path: string | null;
  content: string;
  savedContent: string;
  dirty: boolean;
}

export type ThemeMode = "light" | "dark";
export type ViewMode = "split" | "editor" | "preview";
/** 启动行为：每次询问 / 恢复上次编辑 / 新建空白文档 */
export type StartupBehavior = "ask" | "restore" | "blank";

export interface Heading {
  level: number;
  text: string;
  line: number;
  id: string;
}

export interface PersistedState {
  tabs: Tab[];
  activeId: string;
  theme: ThemeMode;
  splitRatio: number;
  view: ViewMode;
  autosaveEnabled: boolean;
  savedAt: number;
}
