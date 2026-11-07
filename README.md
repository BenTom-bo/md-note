# MDNote

一个轻量的 Windows Markdown 编辑器。基于 Tauri 2 / React 19 / CodeMirror 6，Rust 后端，复用系统 WebView2，**安装包仅约 3.3 MB**。


## 下载

| 文件 | 说明 |
| --- | --- |
| `MDNote_0.1.0_x64-setup.exe` | 安装版，安装时可勾选功能组件（文件关联、右键菜单、渲染增强等） |
| `MDNote_0.1.0_x64-portable.zip` | 免安装版，解压后运行 `mdnote.exe` |
| Source code (zip / tar.gz) | 源码，GitHub 在 Release 中自动附带 |

需要 **Windows 10 1809+ / Windows 11（x64）** 与 **WebView2 Runtime**（Win11 通常已自带）。

## 主要功能

- 双栏实时预览、滚动同步、明暗主题、专注模式、全屏、可拖拽调整分栏
- GFM 表格 / 任务列表、代码高亮、KaTeX 公式、Mermaid 图表、目录、脚注
- 语法高亮、自动配对、列表续写、查找替换、字数统计、撤销重做
- 多标签、自动保存、崩溃恢复、最近文件、拖拽导入、启动时可选恢复或新建
- 图片可直接选图 / 拖入 / 粘贴截图，编辑器折叠成缩略图，文档单文件自包含
- 导出 HTML、复制 HTML、打印 / PDF；关闭窗口直接退出

## 从源码构建

```bash
npm install
npm run tauri build
```

需要 Node.js 20.19+、Rust 1.85+、VS Build Tools 2022。安装包生成在 `src-tauri/target/release/bundle/nsis/`。

完整文档（环境要求、组件清单、快捷键、架构、实测数据、已知限制）见 **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**。

## 许可证

[MIT](LICENSE) © 2026 BenTom-bo
