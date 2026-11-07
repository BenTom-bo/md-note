/** 中英文混排字数统计：CJK 逐字 + 拉丁词按空白/标点切分。 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const latin = text
    .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .match(/[A-Za-z0-9_'’-]+/g) || [];
  return cjk + latin.length;
}

export function countChars(text: string): number {
  return Array.from(text.replace(/\r\n/g, "\n")).length;
}

export function countLines(text: string): number {
  return text ? text.split("\n").length : 1;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 300));
}
