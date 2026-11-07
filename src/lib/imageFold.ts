import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

/**
 * 把内联图片的超长 `](data:image/...;base64,...)` 在编辑器里折叠成
 * 一枚带缩略图的小标签。
 *
 * 文档内容仍是自包含的 Markdown（单文件可移动、导出 HTML 也自包含），
 * 只是视觉上不再出现几十万字符；预览区始终渲染真实图片。
 * 光标进入该范围或点击标签时临时展开源码，光标移开后自动折回。
 */

interface ImageRange {
  from: number;
  to: number;
  uri: string;
}

interface FoldState {
  ranges: ImageRange[];
  deco: DecorationSet;
}

const INLINE_IMAGE = /!\[[^\]\n]*\]\((data:image\/[^\s)]+)\)/g;

function findRanges(text: string): ImageRange[] {
  const ranges: ImageRange[] = [];
  INLINE_IMAGE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_IMAGE.exec(text)) !== null) {
    const uri = match[1];
    if (!uri.includes(";base64,")) continue;
    // 折叠 `](...)` 整体，保留 `![alt]` 让人一眼看出这是图片说明
    const bracket = match[0].lastIndexOf("](");
    ranges.push({ from: match.index + bracket, to: match.index + match[0].length, uri });
  }
  return ranges;
}

function describe(uri: string): string {
  const mime = /^data:image\/([^;]+)/.exec(uri)?.[1] ?? "image";
  const comma = uri.indexOf(";base64,");
  const bytes = comma > 0 ? Math.round((uri.length - comma - 8) * 0.75) : 0;
  const size =
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mime.replace("svg+xml", "SVG").replace("x-icon", "ICO").toUpperCase()} · ${size}`;
}

class ImageChip extends WidgetType {
  constructor(
    readonly uri: string,
    readonly label: string,
    readonly from: number,
  ) {
    super();
  }

  eq(other: ImageChip) {
    return other.uri === this.uri && other.from === this.from;
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-image-chip";
    span.title = "图片已嵌入文档 · 预览区实时查看大图 · 点击展开源码";

    const thumb = document.createElement("img");
    thumb.src = this.uri;
    thumb.alt = "";
    thumb.draggable = false;

    const label = document.createElement("span");
    label.className = "cm-image-chip-label";
    label.textContent = this.label;

    span.append(thumb, label);
    span.addEventListener("mousedown", (event) => {
      event.preventDefault();
      // 把光标放进折叠区间，StateField 会据此临时展开原始 Markdown
      view.dispatch({ selection: { anchor: this.from + 1 } });
      view.focus();
    });
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function buildDeco(state: EditorState, ranges: ImageRange[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sel = state.selection.main;
  for (const r of ranges) {
    // 光标在标签内部时不折叠，方便复制 / 修改原始链接
    if (sel.from < r.to && sel.to > r.from) continue;
    builder.add(
      r.from,
      r.to,
      Decoration.replace({ widget: new ImageChip(r.uri, describe(r.uri), r.from) }),
    );
  }
  return builder.finish();
}

export function imageFold(): Extension {
  return StateField.define<FoldState>({
    create(state) {
      const ranges = findRanges(state.doc.toString());
      return { ranges, deco: buildDeco(state, ranges) };
    },
    update(value, tr) {
      if (!tr.docChanged && !tr.selection) return value;
      // 只有文档变化才重新扫描全文；光标移动时复用已缓存的区间
      const ranges = tr.docChanged ? findRanges(tr.state.doc.toString()) : value.ranges;
      return { ranges, deco: buildDeco(tr.state, ranges) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
  });
}
