--- src/lib/analyze.ts (原始)


+++ src/lib/analyze.ts (修改后)
export type Severity = "kritik" | "uyari" | "bilgi";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  lines: number[];
  fixable?: boolean;
}

export interface Metrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  commentRatio: number;
  avgLineLen: number;
  longestLine: number;
  maxDepth: number;
  dupExtra: number;
  functions: number;
}

export interface Analysis {
  empty: boolean;
  score: number;
  grade: string;
  gradeHex: string;
  findings: Finding[];
  metrics: Metrics;
  chars: number;
  fixableCount: number;
}

export const SEVERITY_META: Record<Severity, { label: string; hex: string; rank: number }> = {
  kritik: { label: "kritik", hex: "#ff7b72", rank: 0 },
  uyari: { label: "uyarı", hex: "#ffab3d", rank: 1 },
  bilgi: { label: "bilgi", hex: "#79c0ff", rank: 2 },
};

const cap = (n: number, c: number) => Math.min(n, c);

export function gradeFor(score: number): { label: string; hex: string } {
  if (score >= 90) return { label: "Pırıl Pırıl", hex: "#6fe3a5" };
  if (score >= 75) return { label: "Temiz", hex: "#79c0ff" };
  if (score >= 55) return { label: "İdare Eder", hex: "#ffab3d" };
  if (score >= 35) return { label: "Dağınık", hex: "#ff7b72" };
  return { label: "Kritik", hex: "#f2554a" };
}

export function analyze(code: string): Analysis {
  const empty = code.trim().length === 0;
  const lines = code.split("\n");
  const totalLines = lines.length;

  let codeLines = 0;
  let commentLines = 0;
  let inBlock = false;
  let maxDepth = 0;
  let lenSum = 0;
  let longestLine = 0;
  let fnCount = 0;

  const longLines: number[] = [];
  const varLines: number[] = [];
  let varCount = 0;
  const looseLines: number[] = [];
  let looseCount = 0;
  const consoleLines: number[] = [];
  let consoleCount = 0;
  const todoLines: number[] = [];
  let todoCount = 0;
  const trailingLines: number[] = [];
  let trailingCount = 0;
  const fatFnLines: number[] = [];
  let fatFnCount = 0;
  const dupLines: number[] = [];
  let dupExtra = 0;
  const seen = new Map<string, number>();

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const t = line.trim();

    if (line.length > 0 && /[ \t]+$/.test(line)) {
      trailingCount++;
      trailingLines.push(n);
    }

    let isComment = false;
    if (inBlock) {
      isComment = true;
      if (t.includes("*/")) inBlock = false;
    } else if (t.startsWith("//")) {
      isComment = true;
    } else if (t.startsWith("/*")) {
      isComment = true;
      if (!t.includes("*/")) inBlock = true;
    }

    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
      todoCount++;
      todoLines.push(n);
    }

    if (t.length === 0) return;

    if (isComment) {
      commentLines++;
      return;
    }
    codeLines++;

    const lead = line.match(/^\s*/)?.[0] ?? "";
    const tabs = (lead.match(/\t/g) ?? []).length;
    const spaces = lead.replace(/\t/g, "").length;
    const depth = tabs + Math.floor(spaces / 2);
    if (depth > maxDepth) maxDepth = depth;

    if (line.length > 100) longLines.push(n);
    if (line.length > longestLine) longestLine = line.length;
    lenSum += line.length;

    const varMatches = line.match(/\bvar\s+/g);
    if (varMatches) {
      varCount += varMatches.length;
      varLines.push(n);
    }

    const looseMatches = line.match(/([^=!<>])==(?!=)|!=(?!=)/g);
    if (looseMatches) {
      looseCount += looseMatches.length;
      looseLines.push(n);
    }

    const consoleMatches = line.match(/console\.log/g);
    if (consoleMatches) {
      consoleCount += consoleMatches.length;
      consoleLines.push(n);
    }

    const fnMatches = [
      ...line.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g),
      ...line.matchAll(/\(([^()]*)\)\s*(?::[^=]*)?=>/g),
    ];
    if (fnMatches.length > 0) {
      fnCount += fnMatches.length;
      for (const m of fnMatches) {
        const params = (m[1] ?? "")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (params.length > 3) {
          fatFnCount++;
          fatFnLines.push(n);
        }
      }
    }

    const key = t.toLowerCase();
    if (key.length >= 12) {
      const prev = seen.get(key) ?? 0;
      if (prev > 0) {
        dupExtra++;
        dupLines.push(n);
      }
      seen.set(key, prev + 1);
    }
  });

  const findings: Finding[] = [];
  let penalty = 0;

  if (varCount > 0) {
    penalty += cap(varCount * 5, 20);
    findings.push({
      id: "var",
      severity: "uyari",
      title: "var kullanımı",
      detail: "var blok kapsamından sızar; const / let daha öngörülebilir.",
      count: varCount,
      lines: varLines,
      fixable: true,
    });
  }

  if (looseCount > 0) {
    penalty += cap(looseCount * 6, 24);
    findings.push({
      id: "loose",
      severity: "uyari",
      title: "Gevşek eşitlik (==, !=)",
      detail: "Tip dönüşümü sürprizlerine karşı === ve !== kullan.",
      count: looseCount,
      lines: looseLines,
      fixable: true,
    });
  }

  if (consoleCount > 0) {
    penalty += cap(consoleCount * 3, 12);
    findings.push({
      id: "console",
      severity: "uyari",
      title: "console.log kalıntısı",
      detail: "Hata ayıklama izleri canlı koda sızmış görünüyor.",
      count: consoleCount,
      lines: consoleLines,
    });
  }

  if (maxDepth > 4) {
    penalty += cap((maxDepth - 4) * 4, 16);
    findings.push({
      id: "depth",
      severity: maxDepth >= 6 ? "kritik" : "uyari",
      title: "Derin iç içe geçme",
      detail: `Maks derinlik ${maxDepth} katman — erken return ile düzleştir.`,
      count: 1,
      lines: [],
    });
  }

  if (dupExtra > 0) {
    penalty += cap(dupExtra * 4, 16);
    findings.push({
      id: "dup",
      severity: dupExtra >= 3 ? "kritik" : "uyari",
      title: "Kopyala-yapıştır izi",
      detail: "Aynı satır birden fazla yerde geçiyor; ortak fonksiyon çıkar.",
      count: dupExtra,
      lines: dupLines,
    });
  }

  if (fatFnCount > 0) {
    penalty += cap(fatFnCount * 5, 10);
    findings.push({
      id: "params",
      severity: "uyari",
      title: "Kalabalık parametre listesi",
      detail: "3'ten çok parametre genellikle tek bir nesneye işaret eder.",
      count: fatFnCount,
      lines: fatFnLines,
    });
  }

  if (longLines.length > 0) {
    penalty += cap(longLines.length * 2, 10);
    findings.push({
      id: "long",
      severity: "bilgi",
      title: "100+ karakter satırlar",
      detail: "Uzun satırlar okumayı ve diff incelemeyi zorlaştırır.",
      count: longLines.length,
      lines: longLines,
    });
  }

  if (todoCount > 0) {
    penalty += cap(todoCount * 3, 9);
    findings.push({
      id: "todo",
      severity: "bilgi",
      title: "TODO / FIXME bekliyor",
      detail: "Bitmemiş iş işaretleri açık kalmış.",
      count: todoCount,
      lines: todoLines,
    });
  }

  if (trailingCount > 0) {
    penalty += cap(trailingCount, 5);
    findings.push({
      id: "trailing",
      severity: "bilgi",
      title: "Satır sonu boşlukları",
      detail: "Görünmez gürültü — otomatik temizlenebilir.",
      count: trailingCount,
      lines: trailingLines,
      fixable: true,
    });
  }

  const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;
  if (codeLines >= 15 && commentRatio < 0.06) {
    penalty += 5;
    findings.push({
      id: "comments",
      severity: "bilgi",
      title: "Yorum oranı düşük",
      detail: "Kod ne yaptığını anlatıyor; neden yaptığını da ekle.",
      count: 1,
      lines: [],
    });
  }

  const score = empty ? 0 : Math.max(2, Math.round(100 - penalty));
  const g = gradeFor(score);

  findings.sort(
    (a, b) =>
      SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank || b.count - a.count
  );

  return {
    empty,
    score,
    grade: g.label,
    gradeHex: g.hex,
    findings,
    metrics: {
      totalLines,
      codeLines,
      commentLines,
      commentRatio,
      avgLineLen: codeLines > 0 ? Math.round(lenSum / codeLines) : 0,
      longestLine,
      maxDepth,
      dupExtra,
      functions: fnCount,
    },
    chars: code.length,
    fixableCount: findings.filter((f) => f.fixable).reduce((a, f) => a + f.count, 0),
  };
}

export function autoFix(code: string): { code: string; applied: number } {
  let applied = 0;
  let out = code;
  out = out.replace(/\bvar\s+/g, () => {
    applied++;
    return "let ";
  });
  out = out.replace(/([^=!<>])==(?!=)/g, (_m, p: string) => {
    applied++;
    return `${p}===`;
  });
  out = out.replace(/!=(?!=)/g, () => {
    applied++;
    return "!==";
  });
  out = out.replace(/[ \t]+$/gm, () => {
    applied++;
    return "";
  });
  return { code: out, applied };
}

export const MESSY_SAMPLE = `// kullanıcı kayıt servisi — hızlı yazıldı, gözden geçirilmedi
var kullaniciListesi = []
var servisAdi = "kullanici-servisi"

function kullaniciEkle(ad, soyad, yas, rol, sehir) {
  var kayit = { ad: ad, soyad: soyad, yas: yas }
  if (yas == null) {
    console.log("yas eksik")
    kayit.yas = 0
  }
  if (ad != "") {
    if (soyad != "") {
      if (rol == "admin") {
        if (sehir == "istanbul") {
          console.log("istanbul admin geldi")
          kayit.onay = true
        } else {
          kayit.onay = false
        }
      }
    }
  }
  kullaniciListesi.push(kayit)
  return kayit
}

// TODO: hata yönetimi ekle
function raporAl(liste) {
  var toplam = 0
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].yas == 0) {
      toplam = toplam + 1
    }
  }
  console.log("rapor:", toplam)
  return toplam
}

var kullaniciListesi = []

function uzunSatir() {
  return "bu satir bilerek cok uzun yazildi cunku analiz motorunun uzun satir kontrolunu tetiklemesi gerekiyor ve bu yuzden hic durmadan devam ediyor"
}
`;

export const CLEAN_SAMPLE = `// Kullanıcı kayıtlarını yöneten küçük servis.
// Neden: pano, bu listeyi her açılışta yeniden çiziyor.

type Kullanici = { ad: string; yas: number };

const kayitlar: Kullanici[] = [];

export function kullaniciEkle(ad: string, yas: number): Kullanici {
  const kayit: Kullanici = { ad, yas };
  kayitlar.push(kayit);
  return kayit;
}

export function toplamKayit(): number {
  return kayitlar.length;
}

export function temizle(): void {
  kayitlar.length = 0;
}
`;
