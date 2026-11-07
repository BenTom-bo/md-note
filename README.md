# MDNote

MDNote 是一款面向 Windows 的 Markdown 编辑器，基于 Tauri 2、React 19 与 CodeMirror 6 构建，界面由系统自带的 WebView2 渲染，不附带浏览器内核，安装包约 3.3 MB。

安装版与免安装版可在 [Releases](https://github.com/BenTom-bo/md-note/releases/latest) 下载：`MDNote_0.1.0_x64-setup.exe` 支持在安装时选择功能组件，`MDNote_0.1.0_x64-portable.zip` 解压后直接运行 `mdnote.exe`。运行环境为 Windows 10 1809 或更高版本（x64），需已安装 WebView2 Runtime，Windows 11 通常已预装。源码压缩包由 GitHub 在 Release 页面自动生成，也可直接浏览本仓库。

编辑器提供双栏实时预览与滚动同步，支持 GFM 表格、任务列表、代码高亮、KaTeX 公式、Mermaid 图表与目录。图片可从剪贴板粘贴或拖拽导入，在编辑器中折叠为缩略图标签，并以内联形式保存在文档中，单独移动文件不会丢图。此外还包含多标签、查找替换、自动保存与崩溃恢复、导出 HTML、打印 PDF、明暗主题与专注模式。关闭窗口即退出程序，不驻留系统托盘；启动时可选择恢复上次编辑或新建文档。

从源码构建需 Node 20.19+、Rust 1.85+ 与 Visual Studio Build Tools 2022，执行 `npm install` 与 `npm run tauri build`。完整的构建与实现说明见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

许可证：MIT · Copyright (c) 2026 BenTom-bo
