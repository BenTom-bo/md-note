import { readImageAsDataUri } from "./files";

/**
 * 预览区里的本地图片路径解析。
 *
 * WebView2 页面的源是 tauri.localhost，`![x](./a.png)` 会被解析到应用资源目录，
 * `![x](C:\...\a.png)` 更不会被当成可加载地址，两者都显示成破图。
 * 这里把本地路径读成 data URI 内联，顺带让导出的 HTML / 复制的 HTML 自包含图片。
 */

const cache = new Map<string, string | null>();

function isRemote(src: string): boolean {
  const s = src.trim();
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith("\\\\")) return false; // Windows 绝对路径 / UNC
  if (s.startsWith("//")) return true; // 协议相对 URL
  return /^(?:https?:|data:|blob:|asset:|mailto:|about:|javascript:)/i.test(s);
}

export function resolveImagePath(base: string | null, src: string): string {
  let s = src.trim().replace(/^file:\/\//i, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 非法转义保持原样 */
  }
  if (/^[a-zA-Z]:[\\/]/.test(s) || s.startsWith("\\\\")) return s;
  if (!base) return s;
  const dir = base.replace(/[\\/][^\\/]*$/, "");
  return `${dir}\\${s.replace(/\//g, "\\")}`;
}

/** 把预览区里指向本地文件的 <img> 换成内联 data URI。 */
export async function resolveLocalImages(root: HTMLElement, base: string | null): Promise<void> {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || isRemote(src)) return;
      const path = resolveImagePath(base, src);
      if (!cache.has(path)) cache.set(path, await readImageAsDataUri(path));
      const uri = cache.get(path);
      if (uri) img.src = uri;
    }),
  );
}

/** 文档保存 / 切换后清空缓存，避免同名文件被换内容后仍显示旧图。 */
export function clearImageCache(path?: string): void {
  if (path) cache.delete(path);
  else cache.clear();
}
