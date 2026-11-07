import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import TabBar from "./components/TabBar";
import StatusBar from "./components/StatusBar";
import FindReplace from "./components/FindReplace";
import { RecoveryBanner, Settings, StartupPrompt, Toast, TocPanel, Wizard } from "./components/Overlays";
import { insertAtCursor, toolbarActions } from "./lib/editorBridge";
import { imagesToMarkdown } from "./lib/imageInsert";
import { isTauri } from "./lib/tauri";
import { useStore } from "./store";
import "./styles.css";

export default function App() {
  const s = useStore();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    void useStore.getState().bootstrap();
  }, []);

  useEffect(() => {
    document.body.style.background = s.theme === "dark" ? "#0d1117" : "#ffffff";
    document.documentElement.style.colorScheme = s.theme;
  }, [s.theme]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const unlisteners: (() => void)[] = [];
    void (async () => {
      try {
        const u1 = await listen<string[]>("open-paths", (e) => {
          if (e.payload?.length) void useStore.getState().openPaths(e.payload);
        });
        const u2 = await listen("tray-open-file", () => void useStore.getState().openFileDialog());
        const u3 = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths.filter((p) => /\.(md|markdown|txt)$/i.test(p));
            if (paths.length) void useStore.getState().openPaths(paths);
            // 拖入图片直接内联进文档，编辑器折叠显示，预览实时渲染
            const images = event.payload.paths.filter((p) =>
              /\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/i.test(p),
            );
            if (images.length) {
              void imagesToMarkdown(images).then((text) => {
                if (text) insertAtCursor(text);
              });
            }
          }
        });
        if (cancelled) {
          u1();
          u2();
          u3();
        } else unlisteners.push(u1, u2, u3);
      } catch (e) {
        console.warn("[MDNote] event listeners unavailable", e);
      }
    })();
    return () => {
      cancelled = true;
      unlisteners.forEach((f) => f());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && e.shiftKey && key === "s") {
        e.preventDefault();
        void st.saveAsActive();
        return;
      }
      if (mod && e.shiftKey && key === "f") {
        e.preventDefault();
        st.toggleFocus();
        return;
      }
      if (mod && key === "n") {
        e.preventDefault();
        st.newTab();
      } else if (mod && key === "o") {
        e.preventDefault();
        void st.openFileDialog();
      } else if (mod && key === "s") {
        e.preventDefault();
        void st.saveActive();
      } else if (mod && key === "f") {
        e.preventDefault();
        st.setFindOpen(true);
      } else if (mod && key === "h") {
        e.preventDefault();
        st.setFindOpen(true);
      } else if (mod && key === "b") {
        e.preventDefault();
        toolbarActions.bold();
      } else if (mod && key === "i") {
        e.preventDefault();
        toolbarActions.italic();
      } else if (mod && key === "k") {
        e.preventDefault();
        toolbarActions.link();
      } else if (mod && key === "p") {
        e.preventDefault();
        st.printDocument();
      } else if (mod && key === "w") {
        e.preventDefault();
        st.closeTab(st.activeId);
      } else if (mod && key === "tab") {
        e.preventDefault();
        const idx = st.tabs.findIndex((t) => t.id === st.activeId);
        const next = e.shiftKey ? idx - 1 : idx + 1;
        st.setActive(st.tabs[(next + st.tabs.length) % st.tabs.length].id);
      } else if (e.key === "F11") {
        e.preventDefault();
        void st.toggleFullscreen();
      } else if (e.key === "Escape") {
        if (st.settingsOpen) st.setSettingsOpen(false);
        else if (st.findOpen) st.setFindOpen(false);
        else if (st.focusMode) st.toggleFocus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onSplitterDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onSplitterMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    useStore.getState().setSplitRatio(((e.clientX - rect.left) / rect.width) * 100);
  };
  const onSplitterUp = () => {
    draggingRef.current = false;
  };

  const showEditor = s.view !== "preview";
  const showPreview = s.view !== "editor";
  const isSplit = s.view === "split";

  return (
    <div className={`app ${s.theme === "dark" ? "theme-dark" : "theme-light"} ${s.focusMode ? "is-focus" : ""}`}>
      {!s.focusMode && <Toolbar />}
      {!s.focusMode && <TabBar />}
      <FindReplace />
      <RecoveryBanner />
      <div className="workspace" ref={workspaceRef}>
        {showEditor && (
          <div className="pane editor-pane" style={isSplit ? { flex: `0 0 ${s.splitRatio}%` } : undefined}>
            <Editor />
          </div>
        )}
        {isSplit && (
          <div
            className="splitter"
            title="拖拽调整分栏比例"
            onPointerDown={onSplitterDown}
            onPointerMove={onSplitterMove}
            onPointerUp={onSplitterUp}
            onPointerCancel={onSplitterUp}
          >
            <span />
          </div>
        )}
        {showPreview && <div className="pane preview-pane"><Preview /></div>}
        <TocPanel />
      </div>
      {!s.focusMode && <StatusBar />}
      <Wizard />
      <StartupPrompt />
      <Settings />
      <Toast />
    </div>
  );
}
