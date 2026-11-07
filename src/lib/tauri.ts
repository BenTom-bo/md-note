import { invoke } from "@tauri-apps/api/core";

export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 在浏览器预览（非 Tauri 环境）时降级，保证同一份代码可在 Vite dev server 中调试。 */
export async function call<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauri()) return fallback as T;
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[MDNote] ${cmd} failed`, e);
    return fallback as T;
  }
}
