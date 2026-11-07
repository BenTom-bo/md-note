import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createEditorState, editorTheme, themeCompartment } from "../lib/editor";
import { insertAtCursor, setEditorView } from "../lib/editorBridge";
import { imagesToMarkdown } from "../lib/imageInsert";
import {
  isSyncScroll,
  markSyncScroll,
  publishEditorScroll,
  subscribeToPreviewScroll,
} from "../lib/scrollSync";
import { useStore } from "../store";

/** 每次创建 / 重建 EditorState 都用同一组回调，粘贴图片统一走内联 + 折叠流程。 */
function makeOpts() {
  const s = useStore.getState();
  return {
    onChange: (value: string) => useStore.getState().setContent(value),
    onCursor: (line: number, column: number) => useStore.getState().setCursor(line, column),
    onImagePaste: (dataUri: string) => {
      void imagesToMarkdown([dataUri]).then((text) => {
        if (text) insertAtCursor(text);
      });
    },
    components: s.components,
    dark: s.theme === "dark",
  };
}

export default function Editor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef(new Map<string, EditorState>());
  const currentIdRef = useRef("");
  const activeId = useStore((s) => s.activeId);
  const theme = useStore((s) => s.theme);
  const components = useStore((s) => s.components);
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    const state = createEditorState(useStore.getState().activeTab()?.content ?? "", makeOpts());
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    setEditorView(view);
    currentIdRef.current = activeId;
    statesRef.current.set(activeId, state);

    const scroller = view.scrollDOM;
    // 用时间戳节流而不是 rAF：rAF 在后台标签页 / 最小化 / 无头环境下不推进，
    // 会让节流标记永久卡住，滚动同步随之失效。
    let lastPublish = 0;
    const onScroll = () => {
      // 由预览区同步引起的滚动不再反向发布，避免反馈环把编辑区拉回
      if (isSyncScroll("editor")) return;
      const now = performance.now();
      if (now - lastPublish < 32) return;
      lastPublish = now;
      // CodeMirror 只渲染视口内的行，lineBlockAtHeight 在这种虚拟化下容易
      // 返回首行（预览几乎不跟随）。改用滚动比例换算行号，稳定且与预览区
      // 按 data-line 定位的方式一致。
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      const ratio = Math.min(1, Math.max(0, scroller.scrollTop / max));
      const line = Math.round(ratio * Math.max(0, view.state.doc.lines - 1));
      publishEditorScroll(line);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });

    const unsub = subscribeToPreviewScroll((line) => {
      const n = Math.min(Math.max(1, line + 1), view.state.doc.lines);
      const pos = view.state.doc.line(n).from;
      markSyncScroll("editor");
      view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
    });

    return () => {
      unsub();
      scroller.removeEventListener("scroll", onScroll);
      setEditorView(null);
      view.destroy();
      viewRef.current = null;
    };
    // 只在挂载时创建，后续通过 effect 切换 state / 主题
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 切换标签页：保存旧 state，恢复或新建目标 tab 的 state */
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready || activeId === currentIdRef.current) return;
    statesRef.current.set(currentIdRef.current, view.state);
    const tab = useStore.getState().tabs.find((t) => t.id === activeId);
    let state = statesRef.current.get(activeId);
    if (!state || state.doc.toString() !== (tab?.content ?? "")) {
      state = createEditorState(tab?.content ?? "", makeOpts());
      statesRef.current.set(activeId, state);
    }
    view.setState(state);
    currentIdRef.current = activeId;
  }, [activeId, ready]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(editorTheme(theme === "dark")),
    });
  }, [theme]);

  // 图片粘贴等组件开关变化后重建 state（保留光标位置）
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !ready || !currentIdRef.current) return;
    const pos = view.state.selection.main.head;
    const doc = view.state.doc.toString();
    const state = createEditorState(doc, makeOpts());
    view.setState(state);
    statesRef.current.set(currentIdRef.current, state);
    view.dispatch({ selection: { anchor: Math.min(pos, doc.length) } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components.pasteImage]);

  return <div className="editor-host" ref={hostRef} />;
}
