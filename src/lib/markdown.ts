import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import type { Components, Heading } from "../types";

export interface RenderResult {
  html: string;
  headings: Heading[];
  tocHtml: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function slug(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\- ]/gu, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "section"
  );
}

let cached: { key: string; md: MarkdownIt } | null = null;
let headingCursor = 0;
let headingsForRender: Heading[] = [];

function getEngine(components: Components): MarkdownIt {
  const key = [
    components.gfm,
    components.footnotes,
    components.mermaid,
    components.toc,
  ].join("|");
  if (cached && cached.key === key) return cached.md;

  const md = new MarkdownIt({
    html: false, // 禁止原始 HTML，避免本地文档注入脚本
    linkify: components.gfm,
    typographer: false,
    breaks: false,
  });

  if (components.gfm) {
    md.use(taskLists, { enabled: true, label: true });
  } else {
    md.disable("table");
    md.disable("strikethrough");
    md.disable("autolink");
  }
  if (components.footnotes) md.use(footnote);

  // markdown-it 默认只放行 png/jpeg/gif/webp 的 data URI，粘贴或插入的
  // svg / bmp / avif / ico 会被当成不可信链接，图片退化成纯文本链接。
  // 这里仅放行「内联图片」这一类 data URI，其余协议仍交给默认校验拦截。
  const originalValidateLink = md.validateLink.bind(md);
  md.validateLink = (url: string) => {
    const s = url.trim().toLowerCase();
    if (s.startsWith("data:image/") && s.includes(";base64,")) return true;
    return originalValidateLink(url);
  };

  // 为每个块级元素写入源行号，供滚动同步使用
  const originalRenderToken = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, options) => {
    const token = tokens[idx];
    if (token.map && token.nesting === 1 && token.type !== "inline") {
      token.attrPush(["data-line", String(token.map[0])]);
    }
    return originalRenderToken(tokens, idx, options);
  };

  md.renderer.rules.heading_open = (tokens, idx) => {
    const token = tokens[idx];
    const h = headingsForRender[headingCursor];
    const id = h?.id ?? slug(tokens[idx + 1]?.content ?? "section");
    headingCursor += 1;
    const line = token.map ? token.map[0] : 0;
    return `<${token.tag} id="${escapeHtml(id)}" data-line="${line}">`;
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info.trim().split(/\s+/)[0] ?? "";
    const lang = info.toLowerCase();
    const line = token.map ? token.map[0] : 0;
    const code = escapeHtml(token.content);
    if (lang === "mermaid" && components.mermaid) {
      return `<pre class="mermaid" data-line="${line}">${code}</pre>\n`;
    }
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
    return `<pre data-line="${line}"><code${cls}>${code}</code></pre>\n`;
  };

  cached = { key, md };
  return md;
}

function collectHeadings(md: MarkdownIt, src: string): Heading[] {
  const tokens = md.parse(src, {});
  const used = new Set<string>();
  const result: Heading[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type !== "heading_open") continue;
    const level = Number(t.tag.slice(1)) || 1;
    const text = tokens[i + 1]?.content ?? "";
    let id = slug(text);
    let n = 2;
    while (used.has(id)) id = `${slug(text)}-${n++}`;
    used.add(id);
    result.push({ level, text, id, line: t.map ? t.map[0] : 0 });
  }
  return result;
}

function buildToc(headings: Heading[]): string {
  if (!headings.length) return "";
  const items = headings
    .map(
      (h) =>
        `<li style="padding-left:${(h.level - 1) * 16}px"><a href="#${escapeHtml(
          h.id,
        )}" data-line="${h.line}">${escapeHtml(h.text)}</a></li>`,
    )
    .join("");
  return `<nav class="md-toc"><div class="md-toc-title">目录</div><ul>${items}</ul></nav>`;
}

/** 抽取 $...$ / $$...$$ 数学公式，用纯文本占位符替换，避免放开原始 HTML。 */
function extractMath(src: string) {
  const map = new Map<string, { tex: string; display: boolean }>();
  let count = 0;
  const token = () => `MDNOTEMATH${count++}ENDMATH`;
  let out = src.replace(/^\s*\$\$([\s\S]*?)\$\$\s*$/gm, (_m, tex: string) => {
    const id = token();
    map.set(id, { tex: tex.trim(), display: true });
    return `\n\n${id}\n\n`;
  });
  out = out.replace(/\$([^$\n]+?)\$/g, (m, tex: string) => {
    if (!tex.trim()) return m;
    const id = token();
    map.set(id, { tex: tex.trim(), display: false });
    return id;
  });
  return { out, map };
}

export function renderMarkdown(source: string, components: Components): RenderResult {
  const md = getEngine(components);
  const { out, map } = components.katex ? extractMath(source) : { out: source, map: new Map<string, { tex: string; display: boolean }>() };
  const headings = collectHeadings(md, out);
  headingsForRender = headings;
  headingCursor = 0;
  let html = md.render(out);
  headingsForRender = [];
  headingCursor = 0;

  // 数学占位符 -> 可被 KaTeX 渐进增强的容器
  map.forEach((info, id) => {
    const inner = escapeHtml(info.tex);
    if (info.display) {
      html = html.replace(
        new RegExp(`<p>\\s*${id}\\s*</p>`, "g"),
        `<div class="md-math" data-display="1" data-tex="${inner}">${inner}</div>`,
      );
    }
  });
  map.forEach((info, id) => {
    if (info.display) return;
    const inner = escapeHtml(info.tex);
    html = html.replace(
      new RegExp(id, "g"),
      `<span class="md-math" data-display="0" data-tex="${inner}">${inner}</span>`,
    );
  });
  // 兜底：未被 <p> 包裹的块级公式
  html = html.replace(/MDNOTEMATH(\d+)ENDMATH/g, (m, _n) => {
    const info = map.get(m);
    return info ? `<div class="md-math" data-display="1" data-tex="${escapeHtml(info.tex)}">${escapeHtml(info.tex)}</div>` : m;
  });

  const tocHtml = components.toc ? buildToc(headings) : "";
  if (components.toc) {
    html = html.replace(/<p>\[\[toc\]\]<\/p>/gi, tocHtml);
    html = html.replace(/\[\[toc\]\]/gi, tocHtml);
  }

  return { html, headings, tocHtml };
}

export function escapeHtmlText(s: string) {
  return escapeHtml(s);
}
