import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import {
  foldGutter,
  foldKeymap,
  indentOnInput,
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
  indentUnit,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown } from "@codemirror/lang-markdown";
import { tags } from "@lezer/highlight";
import type { Components } from "../types";
import { imageFold } from "./imageFold";

export const themeCompartment = new Compartment();

const mdHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--md-heading)", fontWeight: "700" },
  { tag: tags.strong, color: "var(--md-strong)", fontWeight: "700" },
  { tag: tags.emphasis, color: "var(--md-em)", fontStyle: "italic" },
  { tag: tags.strikethrough, color: "var(--md-muted)", textDecoration: "line-through" },
  { tag: tags.link, color: "var(--md-link)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--md-link)" },
  { tag: tags.monospace, color: "var(--md-code)" },
  { tag: tags.quote, color: "var(--md-quote)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--md-marker)" },
  { tag: tags.processingInstruction, color: "var(--md-marker)" },
  { tag: tags.contentSeparator, color: "var(--md-marker)", fontWeight: "700" },
]);

export function editorTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      "&": { height: "100%", fontSize: "15px", backgroundColor: "var(--editor-bg)", color: "var(--fg)" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.75", overflow: "auto" },
      ".cm-content": { caretColor: "var(--accent)", padding: "18px 8px 40vh 8px" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--selection)",
      },
      ".cm-gutters": {
        backgroundColor: "var(--gutter-bg)",
        color: "var(--gutter-fg)",
        border: "none",
        borderRight: "1px solid var(--border)",
      },
      ".cm-activeLine": { backgroundColor: "var(--active-line)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--active-line)", color: "var(--fg)" },
      ".cm-selectionMatch": { backgroundColor: "var(--match)" },
      ".cm-searchMatch": { backgroundColor: "var(--match)", outline: "1px solid var(--accent)" },
      ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--accent-soft)" },
      ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--fg)" },
      ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--border)", color: "var(--fg)" },
      ".cm-foldPlaceholder": { backgroundColor: "var(--panel)", border: "none", color: "var(--muted)" },
    },
    { dark },
  );
}

/** Markdown 强调符号自动配对（*、`、_、~），行首保留给列表符号。 */
const autoPairMarkdown = EditorView.inputHandler.of((view, from, to, text) => {
  if (!["*", "`", "_", "~"].includes(text)) return false;
  const line = view.state.doc.lineAt(from);
  if (from === to && from === line.from && (text === "*" || text === "_")) return false;

  if (from !== to) {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `${text}${selected}${text}` },
      selection: { anchor: from + text.length, head: to + text.length },
    });
    return true;
  }
  if (view.state.sliceDoc(to, to + 1) === text) {
    view.dispatch({ selection: { anchor: to + 1 } });
    return true;
  }
  view.dispatch({
    changes: { from, to, insert: `${text}${text}` },
    selection: { anchor: from + 1 },
  });
  return true;
});

/** 回车时自动续写有序 / 无序 / 任务列表；空列表项回车则删除标记。 */
const listContinuation = keymap.of([
  {
    key: "Enter",
    run: (view) => {
      const { state } = view;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      const match = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(line.text);
      if (!match) return false;
      const [, indent, marker, task, content] = match;
      if (!content.trim() && !task) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: "" },
          selection: { anchor: line.from },
        });
        return true;
      }
      const numeric = /^(\d+)([.)])$/.exec(marker);
      const nextMarker = numeric ? `${Number(numeric[1]) + 1}${numeric[2]}` : marker;
      const insert = `\n${indent}${nextMarker} ${task ? "[ ] " : ""}`;
      view.dispatch({
        changes: { from: head, insert },
        selection: { anchor: head + insert.length },
        scrollIntoView: true,
      });
      return true;
    },
  },
]);

/** 剪贴板图片交给统一的图片插入流程，编辑器里折叠成缩略图标签。 */
const pasteImage = (enabled: boolean, onImage: (dataUri: string) => void) =>
  EditorView.domEventHandlers({
    paste(event) {
      if (!enabled) return false;
      const file = event.clipboardData?.files?.[0];
      if (!file || !file.type.startsWith("image/")) return false;
      event.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result ?? "");
        if (data.startsWith("data:image/")) onImage(data);
      };
      reader.readAsDataURL(file);
      return true;
    },
  });

interface Options {
  onChange: (value: string) => void;
  onCursor: (line: number, column: number) => void;
  onImagePaste?: (dataUri: string) => void;
  components: Components;
  dark: boolean;
}

export function createExtensions(opts: Options): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentUnit.of("  "),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    markdown(),
    imageFold(),
    syntaxHighlighting(mdHighlight),
    search({ top: true }),
    EditorView.lineWrapping,
    cmPlaceholder("开始写作…  Ctrl+N 新建，Ctrl+O 打开，Ctrl+S 保存"),
    autoPairMarkdown,
    pasteImage(opts.components.pasteImage, opts.onImagePaste ?? (() => {})),
    listContinuation,
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
    ]),
    themeCompartment.of(editorTheme(opts.dark)),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) opts.onChange(update.state.doc.toString());
      if (update.docChanged || update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        opts.onCursor(line.number, pos - line.from + 1);
      }
    }),
  ];
}

export function createEditorState(doc: string, opts: Options): EditorState {
  return EditorState.create({ doc, extensions: createExtensions(opts) });
}
