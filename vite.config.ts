import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// 动态 import 的 highlight.js / KaTeX / Mermaid 会自动拆成独立 chunk，
// 不进入主 bundle；只有用户在安装向导或设置中启用后才会被加载。
export default defineConfig(() => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    target: "es2022",
    // 不清空 dist：避免重复构建时批量删除受环境策略限制，也避免旧 chunk 被误删
    emptyOutDir: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Mermaid 及其依赖（d3 / cytoscape / dagre / elkjs 等）不要手工分组：
            // 手工分组会把入口共享的小工具函数一并塞进该 chunk，反过来让入口产生
            // 静态 import，导致 3 MB 图表库在启动时被预加载。交由 Vite 按
            // `await import("mermaid")` 自动生成纯异步 chunk，才能实现真正懒加载。
            if (id.includes("katex")) return "vendor-katex";
            if (id.includes("highlight.js") || id.includes("highlightjs")) return "vendor-highlight";
            if (id.includes("@codemirror") || id.includes("@lezer") || id.includes("codemirror")) return "vendor-editor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
