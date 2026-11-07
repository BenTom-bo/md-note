type Listener = (line: number) => void;

const editorScrollListeners: Listener[] = [];
const previewScrollListeners: Listener[] = [];

function subscribe(list: Listener[], fn: Listener) {
  list.push(fn);
  return () => {
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

/** 预览区订阅编辑区滚动 */
export const subscribeToEditorScroll = (fn: Listener) => subscribe(editorScrollListeners, fn);
export const publishEditorScroll = (line: number) => editorScrollListeners.forEach((f) => f(line));

/** 编辑区订阅预览区滚动 */
export const subscribeToPreviewScroll = (fn: Listener) => subscribe(previewScrollListeners, fn);
export const publishPreviewScroll = (line: number) => previewScrollListeners.forEach((f) => f(line));

// ---------------------------------------------------------------------------
// 滚动同步的「单向」保证
//
// 如果两侧都无条件地把对方发来的行号再转成滚动，就会形成反馈环：
//   编辑区滚动 -> 预览区滚动 -> 预览区 scroll 事件 -> 编辑区 scrollIntoView
//   -> 编辑区滚动 -> ... 循环
// 长文档时（可滚动空间大）表现为滚动位置被反复拉回、根本滑不下去。
// 因此在程序化改变某一侧 scrollTop 前打标记，该侧随后的 scroll 事件
// 只被忽略，不再反向发布；只有用户真正主动滚动的一侧才发起同步。
// ---------------------------------------------------------------------------

type Side = "editor" | "preview";
const suppressUntil: Record<Side, number> = { editor: 0, preview: 0 };
const SUPPRESS_MS = 180;

/** 即将由同步逻辑程序化滚动某一侧时调用。 */
export function markSyncScroll(side: Side): void {
  suppressUntil[side] = performance.now() + SUPPRESS_MS;
}

/** 该侧刚发生的 scroll 是否由同步引起（应忽略）。 */
export function isSyncScroll(side: Side): boolean {
  return performance.now() < suppressUntil[side];
}
