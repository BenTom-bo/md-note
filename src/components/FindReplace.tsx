import { useEffect, useRef, useState } from "react";
import {
  applySearchQuery,
  findNextMatch,
  findPrevMatch,
  replaceAllMatches,
  replaceOneMatch,
} from "../lib/editorBridge";
import { useStore } from "../store";

export default function FindReplace() {
  const open = useStore((s) => s.findOpen);
  const setOpen = useStore((s) => s.setFindOpen);
  const showToast = useStore((s) => s.showToast);
  const [search, setSearch] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    applySearchQuery({ search, replacement, caseSensitive, regexp });
  }, [open, search, replacement, caseSensitive, regexp]);

  if (!open) return null;

  return (
    <div className="findbar">
      <div className="find-row">
        <input
          ref={inputRef}
          className="find-input"
          placeholder="查找…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") findNextMatch();
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button type="button" className="tool-btn" onClick={findPrevMatch} title="上一个">
          上一个
        </button>
        <button type="button" className="tool-btn" onClick={findNextMatch} title="下一个">
          下一个
        </button>
        <label className="find-check">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          区分大小写
        </label>
        <label className="find-check">
          <input type="checkbox" checked={regexp} onChange={(e) => setRegexp(e.target.checked)} />
          正则
        </label>
        <button type="button" className="tool-btn" onClick={() => setOpen(false)} title="关闭 (Esc)">
          ×
        </button>
      </div>
      <div className="find-row">
        <input
          className="find-input"
          placeholder="替换为…"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button type="button" className="tool-btn" onClick={replaceOneMatch}>
          替换
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => {
            replaceAllMatches();
            showToast("已全部替换");
          }}
        >
          全部替换
        </button>
      </div>
    </div>
  );
}
