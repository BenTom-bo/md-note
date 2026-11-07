import { useEffect, useRef } from "react";
import { renderMarkdown } from "../lib/markdown";
import { enhancePreview } from "../lib/enhance";
import { resolveLocalImages } from "../lib/images";
import {
  isSyncScroll,
  markSyncScroll,
  publishPreviewScroll,
  subscribeToEditorScroll,
} from "../lib/scrollSync";
import { useStore } from "../store";

export default function Preview() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const activeId = useStore((s) => s.activeId);
  const content = useStore((s) => s.tabs.find((t) => t.id === s.activeId)?.content ?? "");
  const docPath = useStore((s) => s.tabs.find((t) => t.id === s.activeId)?.path ?? null);
  const components = useStore((s) => s.components);
  const theme = useStore((s) => s.theme);
  const setPreviewHtml = useStore((s) => s.setPreviewHtml);
  const setHeadings = useStore((s) => s.setHeadings);
  const seqRef = useRef(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const result = renderMarkdown(content, components);
    el.innerHTML = result.html;
    setHeadings(result.headings);
    setPreviewHtml(el.innerHTML);
    const seq = ++seqRef.current;
    void (async () => {
      // 先把文档里写的本地图片路径读成内联 data URI，再做代码/公式/图表增强。
      // 两次都回写 previewHtml，保证导出 HTML 与复制 HTML 自带图片和高亮结果。
      await resolveLocalImages(el, docPath);
      if (seq !== seqRef.current) return;
      setPreviewHtml(el.innerHTML);
      await enhancePreview(el, components, theme === "dark");
      if (seq === seqRef.current) setPreviewHtml(el.innerHTML);
    })();
  }, [content, docPath, components, theme, activeId, setPreviewHtml, setHeadings]);

  /** 编辑区滚动 -> 预览区定位到对应块 */
  useEffect(() => {
    return subscribeToEditorScroll((line) => {
      const scroll = scrollRef.current;
      const body = bodyRef.current;
      if (!scroll || !body) return;
      const nodes = Array.from(body.querySelectorAll<HTMLElement>("[data-line]"));
      if (!nodes.length) return;
      let target = nodes[0];
      for (const n of nodes) {
        const l = Number(n.dataset.line ?? 0);
        if (l <= line) target = n;
        else break;
      }
      // 用视口坐标换算，避免 offsetParent 不确定导致的定位偏差
      const baseTop = scroll.getBoundingClientRect().top;
      const top = scroll.scrollTop + (target.getBoundingClientRect().top - baseTop) - 16;
      // 瞬时滚动：smooth 会在动画期间持续触发 scroll 事件，放大同步震荡
      markSyncScroll("preview");
      scroll.scrollTop = Math.max(0, top);
    });
  }, []);

  const onScroll = () => {
    // 由编辑区同步引起的滚动不再反向发布，避免把编辑区拉回
    if (isSyncScroll("preview")) return;
    const scroll = scrollRef.current;
    const body = bodyRef.current;
    if (!scroll || !body) return;
    const nodes = Array.from(body.querySelectorAll<HTMLElement>("[data-line]"));
    const threshold = scroll.scrollTop + 24;
    let line = 0;
    for (const n of nodes) {
      if (n.offsetTop - body.offsetTop <= threshold) line = Number(n.dataset.line ?? 0);
      else break;
    }
    publishPreviewScroll(line);
  };

  return (
    <div className="preview-scroll" ref={scrollRef} onScroll={onScroll}>
      <div className="markdown-body" ref={bodyRef} />
    </div>
  );
}
