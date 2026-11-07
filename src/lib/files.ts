import { open, save } from "@tauri-apps/plugin-dialog";
import { call, isTauri } from "./tauri";

const FILTERS = [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }];
const HTML_FILTERS = [{ name: "HTML", extensions: ["html", "htm"] }];
const IMAGE_FILTERS = [
  { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "svg", "ico"] },
];

export async function readFile(path: string): Promise<string> {
  return call<string>("read_file", { path }, "");
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (!isTauri()) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split(/[\\/]/).pop() || "document.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await call<void>("write_file", { path, content });
}

export async function pickOpenFiles(): Promise<string[]> {
  if (!isTauri()) {
    // 浏览器调试：用 <input type=file> 兜底
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".md,.markdown,.txt";
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return resolve([]);
        const reader = new FileReader();
        reader.onload = () => {
          window.__mdnoteBrowserImport = { name: f.name, content: String(reader.result ?? "") };
          resolve([f.name]);
        };
        reader.readAsText(f);
      };
      input.click();
    });
  }
  const picked = await open({ multiple: true, filters: FILTERS });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export async function pickSavePath(suggestion?: string): Promise<string | null> {
  if (!isTauri()) return "示例文档.md";
  const path = await save({ filters: FILTERS, defaultPath: suggestion });
  return path ?? null;
}

export async function pickHtmlSavePath(suggestion?: string): Promise<string | null> {
  if (!isTauri()) return "导出.html";
  const path = await save({ filters: HTML_FILTERS, defaultPath: suggestion });
  return path ?? null;
}

/** 选择本地图片文件（可多选），返回磁盘路径；取消返回空数组。 */
export async function pickImageFiles(): Promise<string[]> {
  if (!isTauri()) {
    // 浏览器调试降级：<input type=file> + FileReader，直接给出 data URI
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/*";
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        Promise.all(
          files.map(
            (f) =>
              new Promise<string>((done) => {
                const reader = new FileReader();
                reader.onload = () => done(String(reader.result ?? ""));
                reader.onerror = () => done("");
                reader.readAsDataURL(f);
              }),
          ),
        ).then((uris) => resolve(uris.filter(Boolean)));
      };
      input.click();
    });
  }
  const picked = await open({ multiple: true, filters: IMAGE_FILTERS });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

/** 把磁盘上的图片读成 data URI（用于预览里已写好的本地路径）。 */
export async function readImageAsDataUri(path: string): Promise<string | null> {
  if (!isTauri()) return null;
  const uri = await call<string>("read_image", { path }, "");
  return uri.startsWith("data:image/") ? uri : null;
}

export async function getRecent(): Promise<string[]> {
  return call<string[]>("get_recent", undefined, []);
}

export async function addRecent(path: string): Promise<string[]> {
  return call<string[]>("add_recent", { path }, [path]);
}

export async function clearRecent(): Promise<void> {
  await call<void>("clear_recent");
}

export async function getOpenPaths(): Promise<string[]> {
  return call<string[]>("get_open_paths", undefined, []);
}

declare global {
  interface Window {
    __mdnoteBrowserImport?: { name: string; content: string };
  }
}
