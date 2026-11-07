import { useState } from "react";
import { scrollEditorToLine } from "../lib/editorBridge";
import { clearRecentList, useStore } from "../store";
import { DEFAULT_COMPONENTS, type Components, type StartupBehavior } from "../types";

type Key = keyof Components;

const GROUPS: { name: string; items: { key: Key; label: string; desc: string }[] }[] = [
  {
    name: "安装组件",
    items: [
      { key: "core", label: "核心编辑器", desc: "双栏预览、CodeMirror 6 编辑内核（必选）" },
      { key: "fileAssociation", label: "文件关联", desc: "把 .md / .markdown 关联到 MDNote" },
      { key: "contextMenu", label: "右键菜单集成", desc: "资源管理器右键「用 MDNote 打开」" },
    ],
  },
  {
    name: "渲染增强（按需懒加载）",
    items: [
      { key: "gfm", label: "GFM 扩展", desc: "表格、任务列表、删除线、自动链接" },
      { key: "highlight", label: "highlight.js 代码高亮", desc: "动态 import，不打进主 bundle" },
      { key: "katex", label: "KaTeX 数学公式", desc: "$...$ / $$...$$ 公式渲染" },
      { key: "mermaid", label: "Mermaid 图表", desc: "mermaid 代码块懒加载渲染" },
      { key: "toc", label: "TOC 目录", desc: "[[toc]] 标记与目录侧栏" },
      { key: "footnotes", label: "脚注支持", desc: "[^id] 脚注语法" },
      { key: "pasteImage", label: "粘贴图片", desc: "剪贴板截图直接嵌入文档，编辑器折叠显示" },
    ],
  },
  {
    name: "系统集成",
    items: [{ key: "autostart", label: "开机自启", desc: "写入 HKCU Run 启动项" }],
  },
];

function ComponentChecks({
  value,
  onChange,
  disabledCore = true,
}: {
  value: Components;
  onChange: (key: Key, v: boolean) => void;
  disabledCore?: boolean;
}) {
  return (
    <div className="component-groups">
      {GROUPS.map((g) => (
        <section key={g.name} className="component-group">
          <h4>{g.name}</h4>
          {g.items.map((it) => (
            <label key={it.key} className={`component-row ${it.key === "core" ? "is-core" : ""}`}>
              <input
                type="checkbox"
                checked={value[it.key]}
                disabled={it.key === "core" && disabledCore}
                onChange={(e) => onChange(it.key, e.target.checked)}
              />
              <span className="component-label">{it.label}</span>
              <span className="component-desc">{it.desc}</span>
            </label>
          ))}
        </section>
      ))}
    </div>
  );
}

export function Wizard() {
  const open = useStore((s) => s.wizardOpen);
  const initial = useStore((s) => s.components);
  const finish = useStore((s) => s.finishWizard);
  const [draft, setDraft] = useState<Components>(initial);

  if (!open) return null;
  return (
    <div className="overlay">
      <div className="modal modal-wide">
        <div className="modal-head">
          <div>
            <h2>首次启动 · 选择功能组件</h2>
            <p className="modal-sub">安装器未写入组件配置时显示此向导；之后可在「设置 → 组件」修改。</p>
          </div>
        </div>
        <div className="modal-body">
          <ComponentChecks
            value={draft}
            onChange={(key, v) => setDraft({ ...draft, [key]: v, core: true })}
          />
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn"
            onClick={() => setDraft({ ...DEFAULT_COMPONENTS })}
          >
            恢复默认
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void finish(draft)}>
            保存并启用
          </button>
        </div>
      </div>
    </div>
  );
}

/** 启动方式设为「每次询问」时弹出，让用户自己选恢复还是新建。 */
export function StartupPrompt() {
  const open = useStore((s) => s.startupPromptOpen);
  const choose = useStore((s) => s.chooseStartup);
  const [remember, setRemember] = useState(false);
  if (!open) return null;
  return (
    <div className="overlay">
      <div className="modal startup-modal">
        <div className="modal-head">
          <div>
            <h2>欢迎回来</h2>
            <p className="modal-sub">检测到上次的编辑记录，请选择本次打开方式。</p>
          </div>
        </div>
        <div className="modal-body">
          <div className="startup-choices">
            <button type="button" className="startup-choice" onClick={() => void choose("restore", remember)}>
              <strong>恢复上次编辑</strong>
              <span>继续上次的标签页、内容和未保存修改</span>
            </button>
            <button type="button" className="startup-choice" onClick={() => void choose("blank", remember)}>
              <strong>新建空白文档</strong>
              <span>丢弃恢复快照，从一张空白页开始</span>
            </button>
          </div>
          <label className="switch-row startup-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            记住本次选择，以后不再询问（可在「设置 → 常规 → 启动方式」修改）
          </label>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const s = useStore();
  const [tab, setTab] = useState<"components" | "general" | "about">("components");
  if (!s.settingsOpen) return null;

  return (
    <div className="overlay">
      <div className="modal modal-wide">
        <div className="modal-head">
          <h2>设置</h2>
          <button type="button" className="icon-btn" onClick={() => s.setSettingsOpen(false)}>
            ×
          </button>
        </div>
        <div className="settings-tabs">
          {(["components", "general", "about"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`settings-tab ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "components" ? "组件" : t === "general" ? "常规" : "关于"}
            </button>
          ))}
        </div>
        <div className="modal-body">
          {tab === "components" && (
            <>
              <p className="settings-note">
                关闭增强功能后不会动态加载对应模块；系统集成分项变更会同步写入注册表。
              </p>
              <ComponentChecks
                value={s.components}
                onChange={(key, v) => void s.updateComponent(key, v)}
              />
            </>
          )}
          {tab === "general" && (
            <div className="settings-form">
              <label>
                主题
                <select value={s.theme} onChange={(e) => s.setTheme(e.target.value as "light" | "dark")}>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </label>
              <label>
                默认视图
                <select value={s.view} onChange={(e) => s.setView(e.target.value as "split" | "editor" | "preview")}>
                  <option value="split">双栏</option>
                  <option value="editor">仅编辑</option>
                  <option value="preview">仅预览</option>
                </select>
              </label>
              <label>
                启动方式
                <select
                  value={s.startupBehavior}
                  onChange={(e) => void s.setStartupBehavior(e.target.value as StartupBehavior)}
                >
                  <option value="ask">每次启动时询问</option>
                  <option value="restore">恢复上次编辑记录</option>
                  <option value="blank">新建空白文档</option>
                </select>
              </label>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={s.autosaveEnabled}
                  onChange={(e) => s.setAutosaveEnabled(e.target.checked)}
                />
                启用自动保存（2 秒空闲写盘 + 崩溃恢复快照）
              </label>
              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={s.trayEnabled}
                  onChange={(e) => void s.setTrayEnabled(e.target.checked)}
                />
                启用系统托盘图标（默认关闭，重启 MDNote 后生效）
              </label>
              <p className="muted">
                关闭主窗口即直接退出程序，不会最小化到托盘、也不会后台驻留；即使开启托盘，关闭窗口仍然直接退出。
                自动保存会保留恢复快照，下次启动可按上面的「启动方式」决定恢复或新建。
              </p>
              <div className="recent-box">
                <div className="recent-head">
                  <strong>最近文件</strong>
                  <button type="button" className="btn" onClick={() => void clearRecentList()}>
                    清空
                  </button>
                </div>
                {s.recent.length ? (
                  s.recent.map((p) => (
                    <button key={p} type="button" className="recent-item" onClick={() => void s.openPaths([p])}>
                      {p}
                    </button>
                  ))
                ) : (
                  <p className="muted">暂无最近文件</p>
                )}
              </div>
            </div>
          )}
          {tab === "about" && (
            <div className="settings-form about">
              <h3>MDNote v{s.version}</h3>
              <p>轻量、快速的 Windows Markdown 编辑器。</p>
              <ul>
                <li>Tauri 2 + Rust 后端，复用系统 WebView2（无需打包 Chromium）</li>
                <li>React 19 + TypeScript + Vite + Zustand</li>
                <li>CodeMirror 6 编辑内核 · markdown-it 渲染</li>
                <li>release profile：opt-level=z / LTO / codegen-units=1 / strip / panic=abort</li>
                <li>NSIS 安装器：both 模式 + 自定义组件勾选页</li>
              </ul>
              <p className="muted">
                关闭主窗口直接退出程序，不驻留托盘。图片直接嵌入文档，编辑器折叠成缩略图标签，
                预览区实时显示大图，导出 HTML / 打印时自包含。
              </p>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={() => s.setSettingsOpen(false)}>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

export function TocPanel() {
  const open = useStore((s) => s.tocOpen);
  const enabled = useStore((s) => s.components.toc);
  const headings = useStore((s) => s.headings);
  const setOpen = useStore((s) => s.setTocOpen);
  if (!open || !enabled) return null;
  return (
    <aside className="toc-panel">
      <div className="toc-head">
        <strong>目录</strong>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      {headings.length ? (
        <ul>
          {headings.map((h) => (
            <li key={`${h.id}-${h.line}`} style={{ paddingLeft: `${(h.level - 1) * 14}px` }}>
              <button
                type="button"
                onClick={() => {
                  scrollEditorToLine(h.line);
                  document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">当前文档没有标题</p>
      )}
    </aside>
  );
}

export function RecoveryBanner() {
  const open = useStore((s) => s.recoveryBanner);
  const setOpen = useStore((s) => s.setRecoveryBanner);
  const clear = useStore((s) => s.clearRecovery);
  if (!open) return null;
  return (
    <div className="recovery-banner">
      <span>已自动恢复上次的会话与未保存内容（自动保存 / 崩溃恢复）。</span>
      <button type="button" className="btn" onClick={() => void clear()}>
        丢弃并新建
      </button>
      <button type="button" className="icon-btn" onClick={() => setOpen(false)}>
        ×
      </button>
    </div>
  );
}

export function Toast() {
  const msg = useStore((s) => s.toast);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
