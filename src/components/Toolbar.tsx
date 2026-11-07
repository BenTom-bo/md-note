import { toolbarActions } from "../lib/editorBridge";
import { useStore } from "../store";

interface BtnProps {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

function Btn({ label, title, onClick, active, disabled, className }: BtnProps) {
  return (
    <button
      type="button"
      className={`tool-btn ${active ? "is-active" : ""} ${className ?? ""}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

const Sep = () => <span className="tool-sep" />;

export default function Toolbar() {
  const s = useStore();
  const c = s.components;

  return (
    <div className="toolbar-wrap">
      <div className="menubar">
        <span className="brand">MDNote</span>
        <Sep />
        <Btn label="新建" title="新建标签 (Ctrl+N)" onClick={() => s.newTab()} />
        <Btn label="打开" title="打开文件 (Ctrl+O)" onClick={() => void s.openFileDialog()} />
        <Btn label="保存" title="保存 (Ctrl+S)" onClick={() => void s.saveActive()} />
        <Btn label="另存为" title="另存为 (Ctrl+Shift+S)" onClick={() => void s.saveAsActive()} />
        <Sep />
        <Btn label="撤销" title="撤销 (Ctrl+Z)" onClick={toolbarActions.undo} />
        <Btn label="重做" title="重做 (Ctrl+Y)" onClick={toolbarActions.redo} />
        <Btn label="查找" title="查找替换 (Ctrl+F)" onClick={() => s.setFindOpen(!s.findOpen)} active={s.findOpen} />
        <Sep />
        <Btn label="双栏" title="双栏预览" onClick={() => s.setView("split")} active={s.view === "split"} />
        <Btn label="仅编辑" title="仅编辑区" onClick={() => s.setView("editor")} active={s.view === "editor"} />
        <Btn label="仅预览" title="仅预览区" onClick={() => s.setView("preview")} active={s.view === "preview"} />
        <Btn label="目录" title="TOC 目录侧栏" onClick={() => s.setTocOpen(!s.tocOpen)} active={s.tocOpen} disabled={!c.toc} />
        <Btn label={s.theme === "light" ? "深色" : "浅色"} title="明暗主题切换" onClick={s.toggleTheme} />
        <Btn label="专注" title="专注模式 (Ctrl+Shift+F)" onClick={s.toggleFocus} active={s.focusMode} />
        <Btn label="全屏" title="全屏 (F11)" onClick={() => void s.toggleFullscreen()} active={s.fullscreen} />
        <Sep />
        <Btn label="导出 HTML" title="导出渲染结果 + 内嵌 CSS" onClick={() => void s.exportHtml()} />
        <Btn label="导出 PDF" title="调用系统打印 API" onClick={s.exportPdf} />
        <Btn label="复制 HTML" title="复制渲染后的 HTML" onClick={() => void s.copyHtml()} />
        <Btn label="打印" title="打印 (Ctrl+P)" onClick={s.printDocument} />
        <Sep />
        <Btn label="设置" title="组件与常规设置" onClick={() => s.setSettingsOpen(true)} />
      </div>

      <div className="toolbar">
        <Btn label="B" title="加粗 (Ctrl+B)" onClick={toolbarActions.bold} className="fmt-strong" />
        <Btn label="I" title="斜体 (Ctrl+I)" onClick={toolbarActions.italic} className="fmt-em" />
        <Btn label="S" title="删除线" onClick={toolbarActions.strike} className="fmt-strike" />
        <Btn label="</>" title="行内代码" onClick={toolbarActions.code} />
        <Sep />
        <Btn label="H1" title="一级标题" onClick={toolbarActions.h1} />
        <Btn label="H2" title="二级标题" onClick={toolbarActions.h2} />
        <Btn label="H3" title="三级标题" onClick={toolbarActions.h3} />
        <Btn label="引用" title="引用块" onClick={toolbarActions.quote} />
        <Sep />
        <Btn label="链接" title="插入链接 (Ctrl+K)" onClick={toolbarActions.link} />
        <Btn label="图片" title="选择本地图片直接嵌入文档，编辑器显示缩略图，预览区实时查看" onClick={toolbarActions.image} />
        <Btn label="代码块" title="插入代码块" onClick={toolbarActions.codeblock} />
        <Btn label="列表" title="无序列表" onClick={toolbarActions.ul} />
        <Btn label="有序" title="有序列表" onClick={toolbarActions.ol} />
        <Btn label="任务" title="任务列表" onClick={toolbarActions.task} disabled={!c.gfm} />
        <Btn label="表格" title="插入表格" onClick={toolbarActions.table} disabled={!c.gfm} />
        <Btn label="分隔线" title="水平分割线" onClick={toolbarActions.hr} />
        <Sep />
        <Btn label="公式" title="插入 KaTeX 公式" onClick={toolbarActions.math} disabled={!c.katex} />
        <Btn label="Mermaid" title="插入 Mermaid 图表" onClick={toolbarActions.mermaid} disabled={!c.mermaid} />
        <Btn label="TOC" title="插入目录标记 [[toc]]" onClick={toolbarActions.toc} disabled={!c.toc} />
        <span className="toolbar-spacer" />
        <span className="component-hint">
          GFM {c.gfm ? "ON" : "OFF"} · HL {c.highlight ? "ON" : "OFF"} · KaTeX {c.katex ? "ON" : "OFF"} ·
          Mermaid {c.mermaid ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );
}
