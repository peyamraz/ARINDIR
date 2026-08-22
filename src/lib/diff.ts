/* Satır tabanlı LCS diff — "ne değişti" görünümü için. */

export type DiffOpType = "same" | "add" | "del";

export interface DiffOp {
  type: DiffOpType;
  text: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffResult {
  ops: DiffOp[];
  added: number;
  removed: number;
  truncated: boolean;
}

const CAP = 1000;

export function diffLines(oldText: string, newText: string): DiffResult {
  const aAll = oldText.split("\n");
  const bAll = newText.split("\n");
  const a = aAll.slice(0, CAP);
  const b = bAll.slice(0, CAP);
  const truncated = aAll.length > CAP || bAll.length > CAP;

  const m = a.length;
  const n = b.length;

  // LCS uzunluk tablosu (alt-sağ → üst-sol)
  const dp: Int32Array[] = [];
  for (let i = 0; i <= m; i++) dp.push(new Int32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", text: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", text: a[i], oldLine: i + 1 });
      i++;
      removed++;
    } else {
      ops.push({ type: "add", text: b[j], newLine: j + 1 });
      j++;
      added++;
    }
  }
  while (i < m) {
    ops.push({ type: "del", text: a[i], oldLine: i + 1 });
    i++;
    removed++;
  }
  while (j < n) {
    ops.push({ type: "add", text: b[j], newLine: j + 1 });
    j++;
    added++;
  }

  return { ops, added, removed, truncated };
}
