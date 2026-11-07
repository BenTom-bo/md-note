import type { Components } from "../types";

type HLJS = { highlightElement: (el: HTMLElement) => void };
type Katex = { render: (tex: string, el: HTMLElement, opts: Record<string, unknown>) => void };
type Mermaid = {
  initialize: (opts: Record<string, unknown>) => void;
  run: (opts: Record<string, unknown>) => Promise<void>;
};

let hljsModule: HLJS | null = null;
let katexModule: Katex | null = null;
let mermaidModule: Mermaid | null = null;
let mermaidTheme = "";

/** highlight.js / KaTeX / Mermaid 均通过动态 import 加载，绝不进入主 bundle。 */
export async function enhancePreview(
  root: HTMLElement,
  components: Components,
  dark: boolean,
): Promise<void> {
  if (components.highlight) {
    try {
      if (!hljsModule) {
        const mod = await import("highlight.js");
        hljsModule = (mod.default ?? mod) as unknown as HLJS;
      }
      root.querySelectorAll<HTMLElement>("pre code").forEach((el) => {
        if (el.dataset.highlighted) return;
        try {
          hljsModule?.highlightElement(el);
          el.dataset.highlighted = "1";
        } catch {
          /* 未知语言直接跳过 */
        }
      });
    } catch (e) {
      console.warn("[MDNote] highlight.js 加载失败", e);
    }
  }

  if (components.katex) {
    try {
      if (!katexModule) {
        const [mod] = await Promise.all([import("katex"), import("katex/dist/katex.min.css")]);
        katexModule = (mod.default ?? mod) as unknown as Katex;
      }
      root.querySelectorAll<HTMLElement>(".md-math").forEach((el) => {
        if (el.dataset.rendered) return;
        const tex = el.dataset.tex ?? el.textContent ?? "";
        try {
          katexModule?.render(tex, el, {
            displayMode: el.dataset.display === "1",
            throwOnError: false,
            output: "html",
          });
          el.dataset.rendered = "1";
        } catch {
          /* 保留原始 TeX 文本 */
        }
      });
    } catch (e) {
      console.warn("[MDNote] KaTeX 加载失败", e);
    }
  }

  if (components.mermaid) {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("pre.mermaid"));
    if (!nodes.length) return;
    try {
      if (!mermaidModule) {
        const mod = await import("mermaid");
        mermaidModule = (mod.default ?? mod) as unknown as Mermaid;
      }
      const theme = dark ? "dark" : "default";
      if (theme !== mermaidTheme) {
        mermaidModule.initialize({
          startOnLoad: false,
          theme,
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        mermaidTheme = theme;
      }
      await mermaidModule.run({ nodes });
    } catch (e) {
      console.warn("[MDNote] Mermaid 渲染失败", e);
    }
  }
}
