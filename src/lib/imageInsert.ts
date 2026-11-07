import { readImageAsDataUri } from "./files";
import { isTauri } from "./tauri";

/**
 * 图片插入统一入口：工具栏选图、拖入图片、剪贴板粘贴都走这里。
 *
 * 图片直接以 data URI 内联进 Markdown：不需要先保存文档，也不需要新建
 * assets/ 目录，未命名文档同样可以插图并立刻在预览区看到。
 * 编辑器里这一长串会被 lib/imageFold.ts 折叠成带缩略图的短标签，
 * 因此源码文本自包含，视觉上却只有一行。
 */

function labelOf(src: string): string {
  if (src.startsWith("data:")) return "图片";
  return src.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "图片";
}

/** 返回可直接插入编辑器的 Markdown 片段；失败时返回空串。 */
export async function imagesToMarkdown(sources: string[]): Promise<string> {
  const lines: string[] = [];
  for (const src of sources) {
    // 浏览器调试降级时 pickImageFiles 已经给出 data URI；Tauri 下走 Rust 读取磁盘图片。
    const uri = src.startsWith("data:image/")
      ? src
      : isTauri()
        ? await readImageAsDataUri(src)
        : null;
    if (uri) lines.push(`![${labelOf(src)}](${uri})`);
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}
