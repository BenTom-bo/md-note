# MDNote · 轻量 Windows Markdown 编辑器

基于 **Tauri 2.0 + React 19 + TypeScript + CodeMirror 6 + markdown-it + Vite + Zustand**，Rust 后端，前端复用系统 **WebView2**（不打包 Chromium）。交付物为 NSIS 安装包与绿色 `mdnote.exe`。

---

## 1. 环境要求

| 组件 | 版本 / 说明 |
| --- | --- |
| 操作系统 | Windows 10 1809+ / Windows 11（x64） |
| Node.js | 20.19+（本项目在 Node 22.22 构建） |
| Rust | 1.85+（`rustup` 安装 `stable-x86_64-pc-windows-msvc`） |
| MSVC | Visual Studio Build Tools 2022（"使用 C++ 的桌面开发"）；本机构建使用免管理员的便携 MSVC 14.44 + Windows SDK 26100 |
| WebView2 Runtime | 目标机器需已安装（Win11 自带）。安装包默认 `downloadBootstrapper`，缺失时联网下载引导程序 |
| NSIS | **无需手动安装**，`tauri build` 会自动下载并缓存到 `%LOCALAPPDATA%\tauri\NSIS` |

## 2. 构建步骤

```bash
# 1. 初始化（本项目已由该命令生成 react-ts 模板）
npm create tauri-app@latest -- --name md-note --template react-ts --manager npm --yes

cd md-note
npm install

# 2. 开发调试
npm run tauri dev

# 3. 生产构建（前端 + Rust + NSIS 安装包）
npm run tauri build
```

产物位置：

```
md-note/src-tauri/target/release/mdnote.exe                               # 免安装主程序
md-note/src-tauri/target/release/bundle/nsis/MDNote_0.1.0_x64-setup.exe # 安装包
```

> 若只需要 exe 不需要安装包：`npm run tauri build -- --no-bundle`。

### 体积优化（`src-tauri/Cargo.toml`）

```toml
[profile.release]
opt-level = "z"      # 最小体积优先
lto = true           # 链接期优化
codegen-units = 1    # 单个代码生成单元
strip = true         # 去除符号表
panic = "abort"      # 不生成栈展开代码
```

配套措施：Vite 动态 import 拆包、NSIS LZMA 压缩、`downloadBootstrapper` 不内嵌 WebView2 离线安装包、图标与 KaTeX 字体按资源单独压缩。安装包目标 **5–10 MB**。

---

## 3. 安装期功能组件选择

使用 Tauri 官方 NSIS 安装器：

- `bundle.windows.nsis.installMode = "both"` → 安装时可选择「仅当前用户 / 所有用户」。
- `bundle.windows.nsis.template = "nsis/installer.nsi"` → 基于 tauri-bundler 2.10.4 官方模板，在目录页之后插入 `Page custom MDNoteComponentsPage MDNoteComponentsPageLeave` 自定义勾选页。
- `bundle.windows.nsis.installerHooks = "nsis"` → 指向钩子目录；自定义模板用 `!addincludedir` 挂载该目录后 `!include "hooks.nsh"`（NSIS 3.13 限制 `!include` 只能引用脚本目录内的路径，因此不能直接包含绝对路径）。`hooks.nsh` 定义 `NSIS_HOOK_PREINSTALL` / `NSIS_HOOK_POSTINSTALL` / `NSIS_HOOK_PREUNINSTALL` / `NSIS_HOOK_POSTUNINSTALL`。

组件清单（核心编辑器必选且不可取消）：

| 组件 | 作用 |
| --- | --- |
| 核心编辑器 | 编辑 + 预览主程序（强制） |
| 文件关联 | `.md` / `.markdown` 关联（安装时按勾选决定是否注册） |
| 右键菜单集成 | 资源管理器右键「用 MDNote 打开」 |
| KaTeX 公式支持 | `$...$` / `$$...$$` 数学公式 |
| Mermaid 图表支持 | ` ```mermaid ` 代码块图表 |
| GFM / highlight.js / TOC / 脚注 / 图片粘贴 | 同页附加的渲染增强选项 |
| 开机自启 | 同页附加的系统集成选项 |

勾选结果写入安装目录下的 `components.ini`，应用启动时通过 Rust `read_install_components` 读取；之后可在「设置 → 组件」随时修改，修改会同步写入注册表（`apply_components`）。若未检测到 `components.ini`（例如绿色版直接运行 exe），应用会显示**首次启动向导页**让用户勾选。

卸载钩子会清理右键菜单与开机自启注册表项。

---

## 4. 功能清单

### 编辑核心
- 双栏实时预览 + 双向滚动同步（源码行号通过 `data-line` 映射）
- Markdown 语法高亮（CodeMirror 6 + `@lezer/highlight`）
- 工具栏快捷插入：加粗、斜体、删除线、行内代码、H1/H2/H3、引用、链接、图片、代码块、无序/有序/任务列表、表格、分隔线、公式、Mermaid、TOC
- 自动配对（`*`、反引号、`_`、`~`、括号与引号）、列表自动续写（含有序编号递增与任务项 `[ ]`）、Tab / Shift+Tab 缩进
- 撤销重做（CodeMirror history）、查找替换（区分大小写 / 正则 / 单个 / 全部）
- 字数（中英文混排）/ 行数 / 字符数 / 阅读时间统计、行列光标位置
- 打开 / 保存 / 另存为 `.md`、最近文件列表、多标签页
- 自动保存（2 秒空闲写盘）+ 崩溃恢复快照（`localStorage` + Rust `recovery.json`）
- **启动方式可选**：每次启动时询问「恢复上次编辑 / 新建空白文档」，也可在「设置 → 常规」固定为恢复或新建
- 拖拽导入 `.md` / `.markdown` / `.txt`；拖入图片直接嵌入文档并在预览区实时显示（`onDragDropEvent`）
- 明暗主题、专注模式、全屏、可拖拽分栏比例
- **关闭窗口即直接退出**：不最小化到托盘、不后台驻留；系统托盘默认不创建，需要时可在「设置 → 常规」开启（重启生效），开启后关闭窗口仍是直接退出

### 渲染增强（按安装选项启用，运行时懒加载）
- GFM：表格、任务列表、删除线、自动链接（`markdown-it-task-lists`）
- highlight.js 代码高亮：**动态 import**，生成独立 chunk，不进入主 bundle
- KaTeX 数学公式：动态 import JS + CSS
- Mermaid 图表：动态 import + `mermaid.run` 懒渲染
- TOC 目录：`[[toc]]` 占位符 + 可点击目录侧栏
- 脚注：`markdown-it-footnote`
- **图片完整链路**（单文件自包含，编辑器里看不到长串 base64）：
  - 工具栏「图片」→ 选择本地图片 → Rust `read_image` 读成 data URI → 直接内联进 Markdown；**不需要先保存文档、不创建 `assets/` 目录**，未命名文档也能插图
  - 粘贴截图 / 拖入图片：走同一入口 `lib/imageInsert.ts`，插入后预览区立刻显示真实图片
  - 编辑器里 `lib/imageFold.ts` 用 CodeMirror `StateField` + `WidgetType` 把 `](data:image/…;base64,…)` 折叠成一枚**带缩略图和文件大小**的短标签；点击标签可展开原始文本，光标移开自动折回
  - 预览区由 markdown-it 直接渲染图片（`validateLink` 放行所有 `data:image/*;base64,`），**导出 HTML / 复制 HTML / 打印 / PDF** 同样自包含，不依赖外部文件
  - 文档中已有的 `./a.png`、`C:\…\a.png` 等本地路径仍由 `lib/images.ts` 按当前 `.md` 目录解析并内联显示

### 导出
- 导出 HTML：渲染结果 + 内嵌 CSS（`<style>`）
- 导出 PDF：调用 WebView2 系统打印对话框（`window.print()` / iframe），选择「Microsoft Print to PDF」
- 复制渲染后 HTML、打印

### 系统集成
- `bundle.fileAssociations` 声明 `.md` / `.markdown`
- 右键菜单「用 MDNote 打开」、开机自启、系统托盘（默认关闭，可在设置中开启）
- 单实例（`tauri-plugin-single-instance`）：双击 md 文件在已有窗口中打开
- 关闭主窗口直接结束进程（`WindowEvent::CloseRequested` → `app.exit(0)`），不缩托盘、不驻留后台

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S | 新建 / 打开 / 保存 / 另存为 |
| Ctrl+Z / Ctrl+Y | 撤销 / 重做 |
| Ctrl+F / Ctrl+H | 查找 / 替换 |
| Ctrl+B / Ctrl+I / Ctrl+K | 加粗 / 斜体 / 链接 |
| Ctrl+Tab / Ctrl+W | 切换 / 关闭标签 |
| Ctrl+P | 打印 |
| Ctrl+Shift+F | 专注模式 |
| F11 | 全屏 |
| Esc | 关闭面板 / 退出专注 |

---

## 5. 目录结构

```
md-note/
├── src/
│   ├── App.tsx                 主布局 / 快捷键 / 拖拽导入 / 分栏
│   ├── store.ts                Zustand 状态、配置持久化、文件与导出动作
│   ├── styles.css              明暗主题与全部 UI 样式
│   ├── lib/
│   │   ├── markdown.ts         markdown-it 渲染器、行号映射、TOC、公式占位
│   │   ├── enhance.ts          highlight.js / KaTeX / Mermaid 动态 import
│   │   ├── editor.ts           CodeMirror 6 扩展（配对、续写、Tab、主题）
│   │   ├── editorBridge.ts     工具栏 / 查找替换命令桥
│   │   ├── exporter.ts         导出 HTML / PDF / 复制 / 打印
│   │   ├── files.ts            文件对话框、读写、本地图片转 data URI
│   │   ├── imageInsert.ts      选图 / 拖入 / 粘贴统一转内联 data URI
│   │   ├── imageFold.ts        编辑器内折叠长 base64 为缩略图标签
│   │   ├── images.ts           预览区本地图片路径解析与缓存
│   │   ├── scrollSync.ts       双栏滚动同步（含程序化滚动抑制）
│   │   ├── stats.ts            字数统计
│   │   └── tauri.ts            invoke 封装（浏览器调试降级）
│   └── components/             Toolbar / TabBar / Editor / Preview / StatusBar /
│                               FindReplace / Overlays（向导、设置、TOC、Toast）
├── design/                    图标源文件与方案对比
│   ├── icon-a.svg             当前采用的「双栏」图标
│   ├── icon-b.svg / icon-c.svg 备选方案（M↓ / 文档）
│   └── preview.png            三方案对比图（含 16/24/32/48px 小尺寸效果）
├── src-tauri/
│   ├── Cargo.toml              release profile 体积优化
│   ├── tauri.conf.json         fileAssociations / NSIS both / 自定义模板与钩子
│   ├── capabilities/default.json
│   ├── nsis/installer.nsi      自定义 NSIS 模板（含组件页）
│   ├── nsis/hooks.nsh          组件页函数 + 安装/卸载钩子
│   ├── icons/                 由 `npx tauri icon` 生成的全套平台图标
│   └── src/lib.rs              Rust 命令与系统集成
└── README.md
```

### 应用图标

不使用 Tauri 模板自带的默认 logo。当前图标为自绘的「双栏」标识：紫蓝渐变圆角底，左侧白色 `M` 代表编辑区，右侧三条文字条代表渲染结果，中间竖线呼应可拖拽分栏；线条加粗以保证 16px 下仍可辨识。

源文件是 `design/icon-a.svg`（另有 `icon-b.svg` 的 M↓ 极简版、`icon-c.svg` 的文档版，`design/preview.png` 是三者对比）。换图标时替换该 SVG 后重新生成并打包：

```bash
npx tauri icon design/icon-a.svg -o src-tauri/icons
npm run tauri build
```

`npx tauri icon` 会一次性产出 `.ico`（Windows exe / NSIS 安装包用）、`.icns`、各尺寸 PNG、Windows 商店图标与 iOS/Android 资源，无需手工拼 ICO。

`tauri.conf.json` 的 `bundle.windows.nsis.installerIcon` / `uninstallerIcon` 也指向同一 `.ico`，否则 NSIS 安装包与卸载程序会退回 NSIS 自带默认图标。

> 注意：`src-tauri/build.rs` 中已声明 `cargo:rerun-if-changed=icons/icon.ico`。缺少这行时 Cargo 会复用缓存的 Windows 资源（`.res`），出现「`icons/` 已替换、但 exe 内嵌图标还是旧图」的情况。

## 6. 本次构建实测结果

环境：Windows 11 x64 / Rust 1.99.1 / Node 22.22 / MSVC 14.44 + Windows SDK 26100 / WebView2 Runtime 156。

| 项目 | 实测值 |
| --- | --- |
| NSIS 安装包 | `MDNote_0.1.0_x64-setup.exe`，**3.32 MiB**（3,478,478 字节），低于 5–10 MB 目标上限 |
| 免安装主程序 | `mdnote.exe`，**5.09 MiB**（5,341,696 字节） |
| 前端主 bundle | 402.66 KB（gzip 140.52 KB），只含 React 与应用逻辑 |
| 启动时预加载 | 仅 `rolldown-runtime` + `vendor-editor`（CodeMirror 内核） |
| 异步 chunk | highlight.js 921 KB、KaTeX 259 KB、Mermaid 拆为 `mermaid.core` + 十余个图表 chunk，均按需加载 |
| 冷启动（进程创建 → 主窗口出现） | **1281 ms** |
| 二次启动 | **1258 ms** |
| 启动后主进程内存 | 约 28.5 MB（WebView2 子进程复用系统运行时，另计） |
| 构建耗时 | 前端 1.0 s；Rust release 全量（LTO）3 m 08 s、增量 1 m 04 s（第五轮） |

### 功能可用性验证

- **编译层**：`tsc --noEmit` 无错误；`cargo build --release` 零 warning / 零 error；`makensis` 退出码 0；`npm run tauri build` 退出码 0。
- **启动层**：`mdnote.exe` 成功创建标题 `MDNote · 轻量 Markdown 编辑器` 的窗口，并拉起 1 个 WebView2 子进程。
- **渲染层**：用系统 Edge 无头模式加载构建产物，DOM 中**实际出现** CodeMirror 编辑器、双栏工作区、工具栏、标签栏、状态栏、GFM 表格、任务列表复选框、`<s>` 删除线、`hljs-*` 代码高亮、`.katex` 公式、Mermaid `<svg>`、脚注、TOC、`data-line` 行号映射；示例文档 6 个标题全部生成；状态栏显示 `50 行 / 186 词 / 648 字符 / 约 1 分钟 / UTF-8 / 自动保存 ON`。
- **打包层**：生成的 `src-tauri/target/release/nsis/x64/installer.nsi` 中确认包含 `!addincludedir …\src-tauri\nsis`、`!include "hooks.nsh"`、`Page custom MDNoteComponentsPage …`（第 416 行）与 `${If} $CompFileAssoc == 1`（第 700 行），组件选择页与条件化文件关联确实编入安装包。
- **资源层**：`mdnote.exe` 内可检出全部前端资源文件名及 `read_install_components`、`apply_components`、`write_recovery`、`read_image` 等 Rust 命令名（第四轮的 `store_image` 已在第五轮移除）。
- **布局/图片层**：用无头浏览器注入 500 行与 300 节长文档，实测三种视图的容器几何、滚动极限、滚动同步跟随曲线与图片 `<img>` 渲染结果（详见下文第二轮修复）。
- **交互行为层（第四轮）**：`tsc --noEmit` + `vite build` + `npm run tauri build` 全链路退出码 0，构建日志零 warning / 零 error；exe 内可检出当时新增的 `store_image`、不再检出 `check_update`，生成的 NSIS 脚本保留组件页但不包含 `CompUpdater`。PowerShell 启动 exe 后发送 `CloseMainWindow()`，连续 3 次均在约 110 ms 内进程退出、`Get-Process mdnote` 残留为 0。无头浏览器注入恢复会话后，DOM 实测出现启动选择弹窗（两个选项 + 「记住选择」）；点击「恢复上次编辑」后编辑器与预览都只有 `assets/shot.png` 短链接（该轮方案，第五轮已替换为内联 + 折叠标签）；设置页只剩「组件 / 常规 / 关于」，含启动方式下拉（询问 / 恢复 / 新建）与托盘开关，无自动更新项。
- **交互行为层（第五轮）**：无头浏览器在**未保存文档**（`path: null`）注入 11,567 字符的 Markdown（含 8,632 字节 PNG 的 base64）后，编辑器可见文本只有 **44 字符**、不含 `data:image/` 也不含 `assets/`，DOM 出现 1 枚 `.cm-image-chip`（标签 `PNG · 8 KB`，缩略图 `naturalWidth > 0`）；预览区渲染真实 `<img src="data:image/png;base64,…">` 且加载成功。点击标签可展开原始 base64，光标移到别处自动折回。启动选择弹窗（两个选项 + 记住选择）、设置页三个标签、启动方式下拉、托盘开关、无自动更新项均保持；`CloseMainWindow()` 后 126 ms 进程退出、残留 0。exe 中 `store_image` / `check_update` 均不再检出。

> 交互式操作（鼠标点击工具栏、文件对话框、打印对话框、安装向导点击、注册表写入）需图形界面人工确认；本次以「启动 + DOM 渲染 + 产物结构」三层自动化验证覆盖，未做 GUI 点击自动化。

### 关于 Mermaid 懒加载的一处修正

首轮构建发现 `vite.config.ts` 把 mermaid 及其依赖手工 `manualChunks` 到 `vendor-mermaid`，使打包器把入口共享的小工具函数一并归入该 chunk，入口因此产生**静态** `import … from "./vendor-mermaid-….js"`，3.1 MB 图表库在启动时被 `modulepreload`。已移除该规则，改由 `await import("mermaid")` 自动生成纯异步 chunk；重建后 `index.html` 的预加载项只剩 `rolldown-runtime` 与 `vendor-editor`。

### 长文档布局、滚动同步与图片链路修复（第二轮）

针对「长文档时仅编辑 / 双栏滑不动，且仅编辑缩成窄条」，用系统 Edge 无头模式做几何探测后定位到三处根因：

| 现象 | 根因 | 修复 |
| --- | --- | --- |
| 仅编辑缩成窄条 | `.editor-pane { flex: 0 0 auto }`，非双栏时没有宽度，按内容收缩（实测仅 `976/1265 px`） | 改为 `flex: 1 1 0`；双栏时用 inline `flex: 0 0 <ratio>%` 覆盖 |
| 滚动被反复拉回 | 双向同步无来源标记：「编辑区滚动 → 预览区 smooth 滚动 → 预览 scroll 事件 → 编辑区 `scrollIntoView` → 编辑区滚动」形成反馈环 | `scrollSync.ts` 加入 `markSyncScroll` / `isSyncScroll` 抑制窗口，程序化滚动的一侧不再反向发布；去掉 `behavior:"smooth"`，改为瞬时 `scrollTop` |
| 长内容撑破容器 | flex 子项默认 `min-height:auto`，内容变长时阻止收缩 | `.workspace` / `.pane` / `.editor-host` 全部补 `min-height: 0` |

顺带修好"滚动同步几乎不跟随"：CodeMirror 只渲染视口内的行，`lineBlockAtHeight(scrollTop)` 在这种虚拟化下常返回首行（实测预览只移动 6 px）。改为按 `scrollTop / (scrollHeight - clientHeight)` 换算行号，并用时间戳节流替代 `requestAnimationFrame`（后者在后台/最小化时不推进，会让节流标记卡死）。

图片只能插入链接的原因与修复见第 4 节。第二轮实测：仅编辑 `1265/1265`、双栏 `50.0%`、三种视图均可滚到底；300 节长文档滚动同步比例 `0.24→0.19 / 0.50→0.39 / 0.75→0.58`（单调跟随），位置连续 6 次采样零漂移；PNG、SVG 的 data URI 与本地路径图片全部渲染为 `<img>`，无 JS 错误。

### 第四轮：短链接图片 / 退出行为 / 启动方式（用户反馈；图片方案已由第五轮替换）

| 反馈 | 处理 |
| --- | --- |
| 插入图片是一长串 base64，看着很长 | 当轮新增 Rust `store_image` 与 `lib/imageInsert.ts`，把图片存到文档旁 `assets/`、Markdown 只写短链接（**此方案已被第五轮移除**）。退出行为、启动方式、移除自动更新三项保留 |
| 关闭窗口缩到托盘、进程不退出 | 去掉 `api.prevent_close()` + `window.hide()`，改为 `WindowEvent::CloseRequested` → `app.exit(0)`；托盘默认不创建，`trayEnabled` 可在「设置 → 常规」开启（重启生效），开启后关闭窗口仍直接退出 |
| 每次启动自动恢复上次内容 | 新增 `startupBehavior`：`ask`（默认，弹「恢复上次编辑 / 新建空白文档」并支持「记住本次选择」）、`restore`、`blank`；「设置 → 常规 → 启动方式」可随时修改 |
| 不需要自动更新模块 | 删除 `Components.updater`、设置中的「自动更新」页、`updateEndpoint` 配置、Rust `check_update` 命令与 NSIS 组件页对应勾选项 |

启动弹窗只在确实存在可恢复内容（写过的文字、打开过的文件、未保存修改）时出现；首次启动向导与命令行双击打开 `.md` 时不弹窗，避免重复打扰。

### 第五轮：图片改为「内联 + 编辑器折叠」（用户反馈）

| 反馈 | 处理 |
| --- | --- |
| `assets/` 短链接很 low，插图还要先新建 / 保存一个 md 文件，不能即时查看 | 删除 Rust `store_image`、`image_ext`、`base64_decode` 与前端落盘逻辑；`lib/imageInsert.ts` 统一把选图 / 拖入 / 粘贴转成内联 data URI，**不需要先保存文档、不创建任何目录**；新增 `lib/imageFold.ts`（CodeMirror `StateField` + `WidgetType`）把 `](data:image/…;base64,…)` 折叠成带缩略图、类型与大小的短标签，点击可展开源码，光标移开自动折回 |

效果：未命名文档里粘贴截图，预览区立即显示大图，编辑器一行只显示一枚缩略图标签；`.md` 仍是单文件自包含，移动 / 备份不丢图，导出 HTML / 打印同样自包含。设置页「图片粘贴」与「关于」文案同步更新。

## 7. 已知限制与说明

- **注册表范围**：运行时组件开关写入 `HKCU`（当前用户，无需管理员）。以「所有用户」模式安装时，NSIS 自身写入的 `HKLM` 关联由安装器管理；应用内的开关只影响当前用户。
- **PDF 导出**：通过 WebView2 系统打印对话框完成，需用户在打印机列表中选择「Microsoft Print to PDF」，不内嵌 PDF 引擎以保持体积。
- **KaTeX / Mermaid / highlight.js** 的 chunk 与字体随安装包分发（LZMA 压缩），但**只在组件启用且首次使用时动态加载**，不进入主 bundle，也不增加冷启动开销。
- **内联图片体积**：图片以 base64 写进 `.md`（约为原图的 1.33 倍），换来单文件自包含、随意移动 / 备份不丢图；编辑器会自动折叠成长度很短的缩略图标签，不影响阅读。大图建议先压缩，避免文档与导出的 HTML 过大。浏览器调试降级模式不支持读取本地路径图片（无 Rust 后端），但工具栏选图与粘贴图片仍可用。
- **WebView2**：应用不包含浏览器内核；目标机器必须有 WebView2 Runtime。
- 关闭主窗口直接退出程序；自动保存快照仍在，下次启动可按「启动方式」决定是否恢复。

## 8. 附录：构建环境

Windows 上从源码构建需要：

- Node.js 20+ 与 npm
- Rust stable（`rustup` 默认 MSVC 工具链）
- Visual Studio Build Tools（提供链接器与 Windows SDK）
- NSIS 3（Tauri bundler 首次打包时会自动准备）
- WebView2 Runtime（运行期依赖，应用不内置浏览器内核）

```bash
npm install
npm run tauri build
```

产物位于 `src-tauri/target/release/bundle/nsis/`。无管理员权限、无法安装 Visual Studio 时，可自行准备便携 MSVC + Windows SDK 并导出 `INCLUDE` / `LIB` / `LIBPATH` / `PATH` 再构建；本机验证用的便携脚本不属于本仓库。

## 9. 许可证

本项目采用 [MIT License](LICENSE)，版权归 BenTom-bo（2026）。可自由使用、修改与分发，需保留版权与许可声明。
