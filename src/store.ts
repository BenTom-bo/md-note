import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { call, isTauri } from "./lib/tauri";
import {
  addRecent,
  clearRecent,
  getOpenPaths,
  getRecent,
  pickOpenFiles,
  pickSavePath,
  readFile,
  writeFile,
} from "./lib/files";
import {
  DEFAULT_COMPONENTS,
  type Components,
  type PersistedState,
  type StartupBehavior,
  type Tab,
  type ThemeMode,
  type ViewMode,
} from "./types";
import { buildStandaloneHtml, copyRenderedHtml, exportHtmlFile, printHtml } from "./lib/exporter";

const SESSION_KEY = "mdnote.session.v1";
const CONFIG_KEY = "mdnote.config.v1";

const SAMPLE = `# 欢迎使用 MDNote

一款基于 **Tauri 2 + React 19 + CodeMirror 6** 的轻量 Markdown 编辑器。

[[toc]]

## 基本写作

- **加粗**、*斜体*、~~删除线~~、\`行内代码\`
- [ ] 待办事项一
- [x] 待办事项二
- 自动链接：https://tauri.app

> 双栏实时预览，滚动同步，支持可拖拽分栏。

| 功能 | 快捷键 | 状态 |
| --- | --- | --- |
| 保存 | Ctrl+S | ✅ |
| 查找 | Ctrl+F | ✅ |
| 专注模式 | F11 | ✅ |

## 代码块

\`\`\`ts
const greet = (name: string) => \`Hello, \${name}!\`;
console.log(greet("MDNote"));
\`\`\`

## 数学公式

行内公式 $E = mc^2$，以及块级公式：

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Mermaid 图表

\`\`\`mermaid
graph LR
  A[编写 Markdown] --> B[实时预览]
  B --> C[导出 HTML / PDF]
\`\`\`

## 脚注

这是一段带脚注的文字[^note]。

[^note]: 脚注内容由 markdown-it-footnote 渲染。
`;

const uid = () => Math.random().toString(36).slice(2, 10);
const baseName = (p: string) => p.split(/[\\/]/).pop() || p;

export function makeTab(content = "", path: string | null = null, title?: string): Tab {
  return {
    id: uid(),
    title: title ?? (path ? baseName(path) : "未命名.md"),
    path,
    content,
    savedContent: content,
    dirty: false,
  };
}

interface ConfigFile {
  components?: Partial<Components>;
  theme?: ThemeMode;
  splitRatio?: number;
  view?: ViewMode;
  autosaveEnabled?: boolean;
  startupBehavior?: StartupBehavior;
  trayEnabled?: boolean;
  wizardDone?: boolean;
}

function parseIni(raw: string): Partial<Components> {
  const out: Record<string, boolean> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([\w]+)\s*=\s*(\S+)\s*$/.exec(line);
    if (m) out[m[1]] = m[2] === "1" || m[2] === "true";
  }
  return out as Partial<Components>;
}

function loadSession(): PersistedState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

/** 只有真正写过东西 / 打开过文件 / 有未保存修改的会话才值得询问是否恢复。 */
function hasRecoverable(p: PersistedState | null): boolean {
  if (!p?.tabs?.length) return false;
  return p.tabs.some(
    (t) => t.dirty || !!t.path || (t.content.trim() !== "" && t.content !== SAMPLE),
  );
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

export interface AppState {
  tabs: Tab[];
  activeId: string;
  theme: ThemeMode;
  view: ViewMode;
  splitRatio: number;
  focusMode: boolean;
  fullscreen: boolean;
  components: Components;
  recent: string[];
  wizardOpen: boolean;
  settingsOpen: boolean;
  tocOpen: boolean;
  findOpen: boolean;
  recoveryBanner: boolean;
  autosaveEnabled: boolean;
  startupBehavior: StartupBehavior;
  trayEnabled: boolean;
  startupPromptOpen: boolean;
  pendingSession: PersistedState | null;
  toast: string;
  cursor: { line: number; column: number };
  previewHtml: string;
  headings: { level: number; text: string; line: number; id: string }[];
  version: string;
  ready: boolean;

  bootstrap: () => Promise<void>;
  showToast: (msg: string) => void;
  setCursor: (line: number, column: number) => void;
  setPreviewHtml: (html: string) => void;
  setHeadings: (h: AppState["headings"]) => void;
  setComponents: (c: Components) => Promise<void>;
  updateComponent: (key: keyof Components, value: boolean) => Promise<void>;
  finishWizard: (c: Components) => Promise<void>;
  saveConfig: () => Promise<void>;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setView: (v: ViewMode) => void;
  setSplitRatio: (n: number) => void;
  toggleFocus: () => void;
  toggleFullscreen: () => Promise<void>;
  setWizardOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setTocOpen: (v: boolean) => void;
  setFindOpen: (v: boolean) => void;
  setRecoveryBanner: (v: boolean) => void;
  setAutosaveEnabled: (v: boolean) => void;
  setStartupBehavior: (v: StartupBehavior) => Promise<void>;
  setTrayEnabled: (v: boolean) => Promise<void>;
  chooseStartup: (mode: "restore" | "blank", remember: boolean) => Promise<void>;
  setRecent: (v: string[]) => void;
  newTab: (content?: string) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  setContent: (content: string) => void;
  openPaths: (paths: string[]) => Promise<void>;
  openFileDialog: () => Promise<void>;
  saveActive: (silent?: boolean) => Promise<void>;
  saveAsActive: () => Promise<void>;
  saveAll: () => Promise<void>;
  clearRecovery: () => Promise<void>;
  exportHtml: () => Promise<void>;
  exportPdf: () => void;
  copyHtml: () => Promise<void>;
  printDocument: () => void;
  activeTab: () => Tab | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  tabs: [makeTab(SAMPLE)],
  activeId: "",
  theme: "light",
  view: "split",
  splitRatio: 50,
  focusMode: false,
  fullscreen: false,
  components: { ...DEFAULT_COMPONENTS },
  recent: [],
  wizardOpen: false,
  settingsOpen: false,
  tocOpen: false,
  findOpen: false,
  recoveryBanner: false,
  autosaveEnabled: true,
  startupBehavior: "ask",
  trayEnabled: false,
  startupPromptOpen: false,
  pendingSession: null,
  toast: "",
  cursor: { line: 1, column: 1 },
  previewHtml: "",
  headings: [],
  version: "0.1.0",
  ready: false,

  activeTab: () => get().tabs.find((t) => t.id === get().activeId),
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: "" });
    }, 2600);
  },
  setCursor: (line, column) => set({ cursor: { line, column } }),
  setPreviewHtml: (html) => set({ previewHtml: html }),
  setHeadings: (headings) => set({ headings }),

  bootstrap: async () => {
    const [cfgRaw, iniRaw, recent, paths, version, recoveryRaw] = await Promise.all([
      call<string>("get_config", undefined, ""),
      call<string>("read_install_components", undefined, ""),
      getRecent(),
      getOpenPaths(),
      call<string>("app_version", undefined, "0.1.0"),
      call<string>("read_recovery", undefined, ""),
    ]);
    let cfg: ConfigFile = {};
    try {
      cfg = cfgRaw ? (JSON.parse(cfgRaw) as ConfigFile) : {};
    } catch {
      cfg = {};
    }
    const ini = parseIni(iniRaw);
    const components: Components = {
      ...DEFAULT_COMPONENTS,
      ...ini,
      ...(cfg.components ?? {}),
      core: true,
    };
    const theme: ThemeMode =
      cfg.theme ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const localSession = loadSession();
    let remoteSession: PersistedState | null = null;
    try {
      remoteSession = recoveryRaw ? (JSON.parse(recoveryRaw) as PersistedState) : null;
    } catch {
      remoteSession = null;
    }
    const session =
      remoteSession && (!localSession || remoteSession.savedAt > localSession.savedAt)
        ? remoteSession
        : localSession;

    const startupBehavior: StartupBehavior = cfg.startupBehavior ?? "ask";
    const trayEnabled = cfg.trayEnabled ?? false;
    const wizardOpen = !cfg.wizardDone && Object.keys(ini).length === 0 && isTauri();
    // 「每次询问」只在确实有可恢复内容、且不是命令行打开文件 / 首次启动向导时弹窗
    const ask =
      startupBehavior === "ask" && hasRecoverable(session) && !paths.length && !wizardOpen;

    set({
      components,
      theme,
      splitRatio: cfg.splitRatio ?? session?.splitRatio ?? 50,
      view: cfg.view ?? session?.view ?? "split",
      autosaveEnabled: cfg.autosaveEnabled ?? session?.autosaveEnabled ?? true,
      startupBehavior,
      trayEnabled,
      recent,
      version,
      ready: true,
      wizardOpen,
      startupPromptOpen: ask,
      pendingSession: ask ? session : null,
    });

    if (paths.length) {
      await get().openPaths(paths);
    } else if (ask) {
      // 弹窗期间先放一个空白文档，避免背景里闪出旧的欢迎示例
      const t = makeTab();
      set({ tabs: [t], activeId: t.id });
    } else if (startupBehavior === "blank") {
      localStorage.removeItem(SESSION_KEY);
      await call("clear_recovery");
      const t = makeTab();
      set({ tabs: [t], activeId: t.id, recoveryBanner: false });
      await persistNow();
    } else if (session?.tabs?.length) {
      set({
        tabs: session.tabs,
        activeId: session.tabs.some((t) => t.id === session.activeId)
          ? session.activeId
          : session.tabs[0].id,
        recoveryBanner: session.tabs.some((t) => t.dirty),
      });
    } else {
      const t = makeTab(SAMPLE);
      set({ tabs: [t], activeId: t.id });
    }
  },

  saveConfig: async () => {
    const s = get();
    const payload: ConfigFile = {
      components: s.components,
      theme: s.theme,
      splitRatio: s.splitRatio,
      view: s.view,
      autosaveEnabled: s.autosaveEnabled,
      startupBehavior: s.startupBehavior,
      trayEnabled: s.trayEnabled,
      wizardDone: true,
    };
    const raw = JSON.stringify(payload);
    localStorage.setItem(CONFIG_KEY, raw);
    await call("save_config", { config: raw });
  },

  setComponents: async (c) => {
    const next = { ...c, core: true };
    set({ components: next });
    await get().saveConfig();
    await call("apply_components", { config: JSON.stringify(next) });
  },
  updateComponent: async (key, value) => {
    await get().setComponents({ ...get().components, [key]: value });
  },
  finishWizard: async (c) => {
    await get().setComponents(c);
    set({ wizardOpen: false });
    get().showToast("组件配置已保存，部分增强功能将在首次使用时按需加载");
  },

  setTheme: (theme) => {
    set({ theme });
    void get().saveConfig();
  },
  toggleTheme: () => get().setTheme(get().theme === "light" ? "dark" : "light"),
  setView: (view) => {
    set({ view });
    void get().saveConfig();
  },
  setSplitRatio: (n) => {
    set({ splitRatio: Math.min(80, Math.max(20, n)) });
    void get().saveConfig();
  },
  toggleFocus: () => set({ focusMode: !get().focusMode }),
  toggleFullscreen: async () => {
    const next = !get().fullscreen;
    set({ fullscreen: next });
    try {
      await getCurrentWindow().setFullscreen(next);
    } catch {
      set({ fullscreen: false });
    }
  },
  setWizardOpen: (wizardOpen) => set({ wizardOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTocOpen: (tocOpen) => set({ tocOpen }),
  setFindOpen: (findOpen) => set({ findOpen }),
  setRecoveryBanner: (recoveryBanner) => set({ recoveryBanner }),
  setAutosaveEnabled: (autosaveEnabled) => {
    set({ autosaveEnabled });
    void get().saveConfig();
  },
  setStartupBehavior: async (startupBehavior) => {
    set({ startupBehavior });
    await get().saveConfig();
  },
  setTrayEnabled: async (trayEnabled) => {
    set({ trayEnabled });
    await get().saveConfig();
    get().showToast(
      trayEnabled
        ? "已开启托盘图标，重启 MDNote 后生效；关闭窗口仍是直接退出"
        : "已关闭托盘图标，重启 MDNote 后生效",
    );
  },
  chooseStartup: async (mode, remember) => {
    const pending = get().pendingSession;
    if (mode === "restore" && pending) {
      set({
        tabs: pending.tabs,
        activeId: pending.tabs.some((t) => t.id === pending.activeId)
          ? pending.activeId
          : pending.tabs[0].id,
        recoveryBanner: pending.tabs.some((t) => t.dirty),
      });
    } else {
      localStorage.removeItem(SESSION_KEY);
      await call("clear_recovery");
      const t = makeTab();
      set({ tabs: [t], activeId: t.id, recoveryBanner: false });
      await persistNow();
    }
    set({ startupPromptOpen: false, pendingSession: null });
    if (remember) await get().setStartupBehavior(mode);
    get().showToast(mode === "restore" ? "已恢复上次的编辑内容" : "已新建空白文档");
  },
  setRecent: (recent) => set({ recent }),

  newTab: (content = "") => {
    const t = makeTab(content);
    set({ tabs: [...get().tabs, t], activeId: t.id });
    void persistNow();
  },
  closeTab: (id) => {
    const s = get();
    const tab = s.tabs.find((t) => t.id === id);
    if (tab?.dirty && !window.confirm(`「${tab.title}」有未保存的修改，确定关闭吗？`)) return;
    const rest = s.tabs.filter((t) => t.id !== id);
    if (!rest.length) {
      const t = makeTab();
      set({ tabs: [t], activeId: t.id });
    } else {
      set({ tabs: rest, activeId: s.activeId === id ? rest[rest.length - 1].id : s.activeId });
    }
    void persistNow();
  },
  setActive: (activeId) => set({ activeId }),

  setContent: (content) => {
    const s = get();
    const tabs = s.tabs.map((t) =>
      t.id === s.activeId
        ? { ...t, content, dirty: content !== t.savedContent }
        : t,
    );
    set({ tabs });
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => void persistNow(), 600);
    if (s.autosaveEnabled) {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        const t = get().activeTab();
        if (t?.path && t.dirty) void get().saveActive(true);
      }, 2200);
    }
  },

  openPaths: async (paths) => {
    const s = get();
    const tabs = [...s.tabs];
    let activeId = s.activeId;
    for (const p of paths) {
      const existing = tabs.find((t) => t.path === p);
      if (existing) {
        activeId = existing.id;
        continue;
      }
      let content = "";
      if (isTauri()) content = await readFile(p);
      else if (window.__mdnoteBrowserImport) {
        content = window.__mdnoteBrowserImport.content;
        window.__mdnoteBrowserImport = undefined;
      }
      const t = makeTab(content, p);
      tabs.push(t);
      activeId = t.id;
      await addRecent(p);
    }
    set({ tabs, activeId, recent: await getRecent() });
    void persistNow();
  },
  openFileDialog: async () => {
    const paths = await pickOpenFiles();
    if (paths.length) await get().openPaths(paths);
  },

  saveActive: async (silent = false) => {
    const s = get();
    const tab = s.activeTab();
    if (!tab) return;
    let path = tab.path;
    if (!path) {
      path = await pickSavePath(tab.title);
      if (!path) return;
    }
    await writeFile(path, tab.content);
    const name = baseName(path);
    set({
      tabs: s.tabs.map((t) =>
        t.id === tab.id
          ? { ...t, path, title: name, savedContent: t.content, dirty: false }
          : t,
      ),
      recent: await addRecent(path),
    });
    if (!silent) get().showToast(`已保存 ${name}`);
    void persistNow();
  },
  saveAsActive: async () => {
    const tab = get().activeTab();
    if (!tab) return;
    const path = await pickSavePath(tab.title);
    if (!path) return;
    await writeFile(path, tab.content);
    set({
      tabs: get().tabs.map((t) =>
        t.id === tab.id
          ? { ...t, path, title: baseName(path), savedContent: t.content, dirty: false }
          : t,
      ),
      recent: await addRecent(path),
    });
    get().showToast(`已另存为 ${baseName(path)}`);
    void persistNow();
  },
  saveAll: async () => {
    const s = get();
    for (const t of s.tabs) {
      if (!t.dirty) continue;
      if (!t.path) {
        set({ activeId: t.id });
        await get().saveActive(true);
      } else {
        await writeFile(t.path, t.content);
        set({
          tabs: get().tabs.map((x) =>
            x.id === t.id ? { ...x, savedContent: x.content, dirty: false } : x,
          ),
        });
      }
    }
    get().showToast("全部已保存");
  },

  clearRecovery: async () => {
    localStorage.removeItem(SESSION_KEY);
    await call("clear_recovery");
    const t = makeTab();
    set({ tabs: [t], activeId: t.id, recoveryBanner: false });
    get().showToast("已清除恢复数据");
  },

  exportHtml: async () => {
    const s = get();
    const tab = s.activeTab();
    const title = tab?.title ?? "MDNote 导出";
    const standalone = buildStandaloneHtml(title, s.previewHtml, s.theme === "dark");
    const ok = await exportHtmlFile(standalone, title.replace(/\.md$/i, ".html"));
    if (ok) s.showToast("HTML 已导出（含内嵌 CSS）");
  },
  exportPdf: () => {
    const s = get();
    const standalone = buildStandaloneHtml(s.activeTab()?.title ?? "MDNote", s.previewHtml, s.theme === "dark");
    printHtml(standalone);
    s.showToast("已调起系统打印对话框，选择「Microsoft Print to PDF」即可导出 PDF");
  },
  copyHtml: async () => {
    await copyRenderedHtml(get().previewHtml);
    get().showToast("渲染后的 HTML 已复制到剪贴板");
  },
  printDocument: () => get().exportPdf(),
}));

export async function persistNow(): Promise<void> {
  const s = useStore.getState();
  const payload: PersistedState = {
    tabs: s.tabs,
    activeId: s.activeId,
    theme: s.theme,
    splitRatio: s.splitRatio,
    view: s.view,
    autosaveEnabled: s.autosaveEnabled,
    savedAt: Date.now(),
  };
  const raw = JSON.stringify(payload);
  try {
    localStorage.setItem(SESSION_KEY, raw);
  } catch {
    /* localStorage 写满时忽略 */
  }
  await call("write_recovery", { snapshot: raw });
}

export async function clearRecentList(): Promise<void> {
  await clearRecent();
  useStore.setState({ recent: [] });
}
