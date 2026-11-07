import { undo, redo } from "@codemirror/commands";
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { pickImageFiles } from "./files";
import { imagesToMarkdown } from "./imageInsert";

let activeView: EditorView | null = null;

export function setEditorView(view: EditorView | null) {
  activeView = view;
}
export function getEditorView(): EditorView | null {
  return activeView;
}
export function withView(fn: (view: EditorView) => void) {
  if (!activeView) return;
  fn(activeView);
  activeView.focus();
}

export function wrapSelection(before: string, after: string, fallback = "文字") {
  withView((v) => {
    const sel = v.state.selection.main;
    const text = v.state.sliceDoc(sel.from, sel.to) || fallback;
    const insert = `${before}${text}${after}`;
    v.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: sel.from + before.length, head: sel.from + before.length + text.length },
    });
  });
}

export function prefixLines(prefix: string) {
  withView((v) => {
    const sel = v.state.selection.main;
    const first = v.state.doc.lineAt(sel.from).number;
    const last = v.state.doc.lineAt(sel.to).number;
    const changes: { from: number; to?: number; insert?: string }[] = [];
    for (let n = first; n <= last; n += 1) {
      const line = v.state.doc.line(n);
      if (line.text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length });
      } else {
        changes.push({ from: line.from, insert: prefix });
      }
    }
    v.dispatch({ changes });
  });
}

export function insertAtCursor(text: string, selectOffset = 0, selectLength = 0) {
  withView((v) => {
    const sel = v.state.selection.main;
    v.dispatch({
      changes: { from: sel.from, to: sel.to, insert: text },
      selection:
        selectLength > 0
          ? { anchor: sel.from + selectOffset, head: sel.from + selectOffset + selectLength }
          : { anchor: sel.from + text.length },
    });
  });
}

export function insertBlock(text: string) {
  withView((v) => {
    const sel = v.state.selection.main;
    const line = v.state.doc.lineAt(sel.from);
    const pre = line.text.trim() ? "\n\n" : "";
    v.dispatch({
      changes: { from: sel.from, to: sel.to, insert: `${pre}${text}\n\n` },
      selection: { anchor: sel.from + pre.length + text.length },
    });
  });
}

export const toolbarActions = {
  bold: () => wrapSelection("**", "**", "加粗文字"),
  italic: () => wrapSelection("*", "*", "斜体文字"),
  strike: () => wrapSelection("~~", "~~", "删除线"),
  code: () => wrapSelection("`", "`", "code"),
  h1: () => prefixLines("# "),
  h2: () => prefixLines("## "),
  h3: () => prefixLines("### "),
  quote: () => prefixLines("> "),
  ul: () => prefixLines("- "),
  ol: () => prefixLines("1. "),
  task: () => prefixLines("- [ ] "),
  link: () => {
    withView((v) => {
      const sel = v.state.selection.main;
      const text = v.state.sliceDoc(sel.from, sel.to) || "链接文字";
      const insert = `[${text}](https://)`;
      v.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: { anchor: sel.from + text.length + 3, head: sel.from + insert.length - 1 },
      });
    });
  },
  // 选择本地图片直接内联进文档；编辑器折叠成缩略图标签，预览与导出自包含。
  image: async () => {
    const paths = await pickImageFiles();
    if (!paths.length) return;
    const text = await imagesToMarkdown(paths);
    if (text) insertAtCursor(text);
  },
  codeblock: () =>
    insertBlock("```js\n// 在此输入代码\n```"),
  table: () =>
    insertBlock(
      "| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |",
    ),
  hr: () => insertBlock("---"),
  math: () => insertBlock("$$\nE = mc^2\n$$"),
  mermaid: () => insertBlock("```mermaid\ngraph TD\n  A[开始] --> B[结束]\n```"),
  toc: () => insertBlock("[[toc]]"),
  undo: () => withView((v) => undo(v)),
  redo: () => withView((v) => redo(v)),
};

export function scrollEditorToLine(line: number) {
  withView((v) => {
    const n = Math.min(Math.max(1, line + 1), v.state.doc.lines);
    const pos = v.state.doc.line(n).from;
    v.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
  });
}

export interface SearchOptions {
  search: string;
  replacement: string;
  caseSensitive: boolean;
  regexp: boolean;
}

export function applySearchQuery(opts: SearchOptions) {
  // 不调用 withView：避免在查找框输入时把焦点抢回编辑器
  const v = getEditorView();
  if (!v) return;
  try {
    const query = new SearchQuery({
      search: opts.search,
      replace: opts.replacement,
      caseSensitive: opts.caseSensitive,
      regexp: opts.regexp,
      wholeWord: false,
    });
    v.dispatch({ effects: setSearchQuery.of(query) });
  } catch {
    /* 非法正则时忽略 */
  }
}

export function findNextMatch() {
  withView((v) => findNext(v));
}
export function findPrevMatch() {
  withView((v) => findPrevious(v));
}
export function replaceOneMatch() {
  withView((v) => replaceNext(v));
}
export function replaceAllMatches() {
  withView((v) => replaceAll(v));
}
