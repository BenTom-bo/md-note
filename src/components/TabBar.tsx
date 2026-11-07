import { useStore } from "../store";

export default function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const closeTab = useStore((s) => s.closeTab);
  const newTab = useStore((s) => s.newTab);

  return (
    <div className="tabbar">
      <div className="tablist">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeId ? "is-active" : ""}`}
            onClick={() => setActive(t.id)}
            title={t.path ?? "未保存的文件"}
          >
            <span className="tab-title">{t.title}</span>
            {t.dirty && <span className="tab-dirty" title="未保存" />}
            <button
              type="button"
              className="tab-close"
              title="关闭标签"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="tab-add" title="新建标签 (Ctrl+N)" onClick={() => newTab()}>
          +
        </button>
      </div>
      <div className="tabbar-right">Ctrl+Tab 切换标签 · Ctrl+W 关闭</div>
    </div>
  );
}
