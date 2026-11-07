import { pickHtmlSavePath, writeFile } from "./files";
import { isTauri } from "./tauri";
import type { ThemeMode } from "../types";

/** 导出用的自包含 CSS（内嵌 style，不依赖外部资源）。 */
export const PREVIEW_CSS = `
:root{--fg:#24292f;--muted:#6e7781;--border:#d0d7de;--link:#0969da;--code-bg:#f6f8fa}
*{box-sizing:border-box}
body{margin:0;padding:40px 20px 80px;background:#fff;color:var(--fg);
 font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
.markdown-body{max-width:860px;margin:0 auto;word-wrap:break-word}
h1,h2,h3,h4,h5,h6{margin:24px 0 12px;line-height:1.3;font-weight:700}
h1{font-size:2em;border-bottom:1px solid var(--border);padding-bottom:.3em}
h2{font-size:1.5em;border-bottom:1px solid var(--border);padding-bottom:.3em}
h3{font-size:1.25em}
p,ul,ol,blockquote,table,pre{margin:0 0 16px}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:.9em;background:var(--code-bg);padding:.15em .35em;border-radius:4px}
pre{background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px;overflow:auto}
pre code{background:none;padding:0;font-size:.9em;line-height:1.6}
blockquote{border-left:4px solid var(--border);color:var(--muted);padding:0 16px;margin-left:0}
ul,ol{padding-left:2em}
li{margin:4px 0}
hr{border:0;border-top:1px solid var(--border);margin:24px 0}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid var(--border);padding:8px 12px;text-align:left}
th{background:var(--code-bg)}
img{max-width:100%}
input[type=checkbox]{margin-right:6px}
.md-toc{background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:20px}
.md-toc-title{font-weight:700;margin-bottom:6px}
.md-toc ul{list-style:none;margin:0;padding:0}
.md-toc a{color:var(--link)}
pre.mermaid{border:none;background:transparent;text-align:center}
pre.mermaid svg{max-width:100%}
.hljs-comment,.hljs-quote{color:#6a737d}.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#cf222e}
.hljs-string,.hljs-attr,.hljs-template-tag{color:#0a3069}.hljs-number,.hljs-built_in,.hljs-type{color:#0550ae}
.hljs-title,.hljs-function,.hljs-section{color:#8250df}.hljs-variable,.hljs-params{color:#953800}
.hljs-tag,.hljs-name,.hljs-selector-class{color:#116329}
@media print{body{padding:0}.markdown-body{max-width:none}pre{white-space:pre-wrap}}
`;

export function buildStandaloneHtml(title: string, bodyHtml: string, dark: boolean): string {
  const darkCss = dark
    ? `\nbody{background:#0d1117;color:#e6edf3}:root{--fg:#e6edf3;--muted:#8b949e;--border:#30363d;--link:#58a6ff;--code-bg:#161b22}\nth,.md-toc,pre,code{background:#161b22}`
    : "";
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<>&"]/g, "")}</title>
<style>${PREVIEW_CSS}${darkCss}</style></head>
<body><article class="markdown-body">${bodyHtml}</article></body></html>`;
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportHtmlFile(standalone: string, suggested: string): Promise<boolean> {
  const path = await pickHtmlSavePath(suggested);
  if (!path) return false;
  if (isTauri()) await writeFile(path, standalone);
  else downloadText(standalone, suggested, "text/html;charset=utf-8");
  return true;
}

export async function copyRenderedHtml(bodyHtml: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(bodyHtml);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = bodyHtml;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/** 调用 WebView2 的系统打印对话框，用户选择「Microsoft Print to PDF」即可导出 PDF。 */
export function printHtml(standalone: string): void {
  const old = document.getElementById("mdnote-print-frame");
  if (old) old.remove();
  const frame = document.createElement("iframe");
  frame.id = "mdnote-print-frame";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px;top:0";
  document.body.appendChild(frame);
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.print();
    }
  };
  frame.srcdoc = standalone;
}
