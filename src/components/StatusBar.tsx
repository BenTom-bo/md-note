import { countChars, countLines, countWords, readingMinutes } from "../lib/stats";
import { useStore } from "../store";

export default function StatusBar() {
  const s = useStore();
  const tab = s.activeTab();
  const text = tab?.content ?? "";
  const words = countWords(text);

  return (
    <div className="statusbar">
      <span className="status-item">{tab?.dirty ? "● 未保存" : "✓ 已保存"}</span>
      <span className="status-item">{tab?.path ?? "新文件"}</span>
      <span className="status-spacer" />
      <span className="status-item">{s.cursor.line}:{s.cursor.column}</span>
      <span className="status-item">{countLines(text)} 行</span>
      <span className="status-item">{words} 词</span>
      <span className="status-item">{countChars(text)} 字符</span>
      <span className="status-item">约 {readingMinutes(words)} 分钟</span>
      <span className="status-item">UTF-8</span>
      <span className="status-item">Markdown</span>
      <span className="status-item">{s.autosaveEnabled ? "自动保存 ON" : "自动保存 OFF"}</span>
      <span className="status-item">{s.theme === "dark" ? "深色" : "浅色"}</span>
      <span className="status-item">v{s.version}</span>
    </div>
  );
}
