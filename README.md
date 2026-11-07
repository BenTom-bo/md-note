# MDNote

Windows 上写 Markdown 用的。左边写，右边跟着出预览。用 Tauri 2 + React 19 + CodeMirror 6 做的，界面跑在系统自带的 WebView2 里，所以安装包只有 3.3 MB。

装好的版本去 [Releases](https://github.com/BenTom-bo/md-note/releases/latest) 下：`setup.exe` 一路下一步，里面的勾选项按需选；不想装就下 `portable.zip`，解压双击 `mdnote.exe`。要 Win10/11 64 位和 WebView2（Win11 自带）。源码在 Release 页面也能直接打包下载。

表格、任务列表、代码高亮、公式、Mermaid、目录这些都能渲染。截图可以直接粘进去或拖进来，编辑器里收成一枚小缩略图，不会糊一屏字符，文档拷走也不会丢图。多标签、自动保存、崩溃恢复、查找替换、导出 HTML、打印 PDF 都有。点 × 是真的退出，不躲托盘；下次打开会问要不要接着上次的写。

自己编译：`npm install` 再 `npm run tauri build`，要 Node 20.19+、Rust 1.85+、VS Build Tools 2022。更细的说明在 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

MIT，© 2026 BenTom-bo
