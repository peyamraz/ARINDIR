--- src/lib/analyze.ts (原始)
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


+++ src/lib/analyze.ts (修改后)
/* ============================================================
   ARINDIR · çok-dilli sezgisel analiz motoru v1.0
   Önce dili tanır, sonra YALNIZCA o dilin kurallarını uygular.
   Bilinmeyen dillerde sadece ortak/güvenli kontroller çalışır —
   hiçbir dil diğerinin syntax kurallarıyla "düzeltilmez".
   ============================================================ */

export type Severity = "kritik" | "uyari" | "bilgi";

export const SEVERITY_META: Record<
  Severity,
  { label: string; hex: string; soft: string; weight: number; rank: number }
> = {
  kritik: { label: "kritik", hex: "#ff7b72", soft: "rgba(255,123,114,0.13)", weight: 18, rank: 0 },
  uyari: { label: "uyarı", hex: "#ffbe66", soft: "rgba(255,190,102,0.12)", weight: 8, rank: 1 },
  bilgi: { label: "bilgi", hex: "#79c0ff", soft: "rgba(121,192,255,0.12)", weight: 3, rank: 2 },
};

/* ---------------- diller ---------------- */

export type Lang = "dart" | "js" | "ts" | "python" | "html" | "css" | "unknown";

export const LANG_META: Record<Lang, { label: string; ext: string; color: string }> = {
  dart: { label: "Dart / Flutter", ext: ".dart", color: "#79c0ff" },
  js: { label: "JavaScript", ext: ".js", color: "#ffbe66" },
  ts: { label: "TypeScript", ext: ".ts", color: "#4da3ff" },
  python: { label: "Python", ext: ".py", color: "#6fe3a5" },
  html: { label: "HTML", ext: ".html", color: "#ff7b72" },
  css: { label: "CSS", ext: ".css", color: "#d2a8ff" },
  unknown: { label: "Genel metin", ext: ".txt", color: "#7b91ab" },
};

/* ---------------- veri tipleri ---------------- */

export interface Finding {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  count: number;
  lines: number[];
  fixable: boolean;
}

export interface Metrics {
  codeLines: number;
  totalLines: number;
  avgLineLen: number;
  maxDepth: number;
  dupExtra: number;
  commentRatio: number;
  functions: number;
}

export interface Analysis {
  empty: boolean;
  lang: Lang;
  langLabel: string;
  score: number;
  grade: string;
  gradeHex: string;
  findings: Finding[];
  fixableCount: number;
  metrics: Metrics;
  chars: number;
}

/* ---------------- dil algılama ----------------
   Sinyal tabanlı puanlama: her dilin kendine özgü imzaları vardır.
   Eşik aşılmazsa "unknown" → yalnızca güvenli ortak kurallar. */

interface Signal {
  re: RegExp;
  w: number;
}

const DART_SIGNALS: Signal[] = [
  { re: /import\s+['"](?:package|dart):/g, w: 10 },
  { re: /\b(?:StatelessWidget|StatefulWidget)\b/g, w: 12 },
  { re: /\bWidget\s+build\s*\(/g, w: 12 },
  { re: /\bextends\s+State\s*</g, w: 12 },
  { re: /\bsetState\s*\(/g, w: 5 },
  { re: /\boldWidget\b/g, w: 10 },
  { re: /\bwidget\.[a-z]/g, w: 4 },
  { re: /@override\b/g, w: 4 },
  { re: /\bvoid\s+main\s*\(\s*\)/g, w: 6 },
  { re: /\b(?:Future|Stream)\s*</g, w: 5 },
  { re: /\blate\s+(?:final\s+)?[A-Za-z]/g, w: 4 },
  { re: /\?\?=/g, w: 4 },
  { re: /\b(?:EdgeInsets|TextStyle|Scaffold|BuildContext|MaterialApp)\b/g, w: 6 },
  { re: /\bchild:\s/g, w: 3 },
  { re: /\brequired\s+(?:this\.)?[A-Za-z]/g, w: 3 },
];

const JS_SIGNALS: Signal[] = [
  { re: /\bconst\s+[\w$]/g, w: 3 },
  { re: /\blet\s+[\w$]/g, w: 3 },
  { re: /=>/g, w: 3 },
  { re: /\bfunction\s/g, w: 4 },
  { re: /\bconsole\./g, w: 5 },
  { re: /import\s*{[^}]*}\s*from\b/g, w: 6 },
  { re: /\brequire\s*\(/g, w: 6 },
  { re: /\bdocument\./g, w: 6 },
  { re: /\bwindow\./g, w: 5 },
  { re: /===|!==/g, w: 5 },
  { re: /\bexport\s+(?:default|const|function|class)\b/g, w: 4 },
  { re: /\bMath\.|\bJSON\./g, w: 4 },
  { re: /\bnew\s+(?:Promise|Array|Map|Set|Date|Error)\b/g, w: 4 },
  { re: /`[^`]*\$\{/g, w: 4 },
];

const TS_SIGNALS: Signal[] = [
  { re: /\binterface\s+\w/g, w: 10 },
  { re: /\btype\s+\w+\s*=/g, w: 8 },
  { re: /\benum\s+\w/g, w: 8 },
  { re: /\bimplements\s/g, w: 8 },
  { re: /\breadonly\s/g, w: 6 },
  { re: /\b(?:private|public)\s+\w/g, w: 6 },
  { re: /:\s*(?:string|number|boolean|void|any|never|unknown)\b/g, w: 5 },
  { re: /\bas\s+(?:const|\w+)\b/g, w: 4 },
  { re: /\bReact\.\w+/g, w: 4 },
];

const PY_SIGNALS: Signal[] = [
  { re: /\bdef\s+\w+\s*\(/g, w: 10 },
  { re: /\bself\./g, w: 8 },
  { re: /\belif\b/g, w: 10 },
  { re: /if\s+__name__\s*==/g, w: 12 },
  { re: /\bclass\s+\w+\s*:/g, w: 10 },
  { re: /\blambda\b/g, w: 6 },
  { re: /^\s*import\s+\w+\s*$/gm, w: 5 },
  { re: /^\s*#[^\s!]/gm, w: 4 },
  { re: /:\s*$/gm, w: 2 },
];

const HTML_SIGNALS: Signal[] = [
  { re: /<!DOCTYPE\s+html/gi, w: 20 },
  { re: /<html[\s>]/gi, w: 15 },
  { re: /<\/[a-z][^>]*>/gi, w: 2 },
  { re: /\bclass="/g, w: 4 },
];

const CSS_SIGNALS: Signal[] = [
  { re: /(^|\n)\s*[.#:@][^{]*\{/g, w: 8 },
  { re: /(^|\n)\s*[\w-]+\s*:\s*[^;{]+;/g, w: 5 },
  { re: /!important/g, w: 3 },
];

function signalScore(code: string, signals: Signal[]): number {
  let total = 0;
  for (const s of signals) {
    const m = code.match(s.re);
    if (m) total += s.w * Math.min(m.length, 6);
  }
  return total;
}

export function detectLanguage(code: string): Lang {
  const scores: [Lang, number][] = [
    ["dart", signalScore(code, DART_SIGNALS)],
    ["ts", signalScore(code, TS_SIGNALS) + signalScore(code, JS_SIGNALS) * 0.4],
    ["js", signalScore(code, JS_SIGNALS)],
    ["python", signalScore(code, PY_SIGNALS)],
    ["html", signalScore(code, HTML_SIGNALS)],
    ["css", signalScore(code, CSS_SIGNALS)],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = scores[0];
  if (bestScore < 10) return "unknown";
  return best;
}

/* ---------------- kurallar ----------------
   Her kural yalnızca kendi dilinde geçerlidir. Ortak kurallar
   (TODO, uzun satır, kuyruk boşluğu…) tüm dillerde güvenlidir. */

interface Rule {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  fixable: boolean;
  match: (line: string) => boolean;
  fix?: (line: string) => string;
}

const isCommentLine = (line: string, lang: Lang): boolean => {
  const t = line.trim();
  if (!t) return false;
  if (lang === "python") return t.startsWith("#");
  if (lang === "html") return t.startsWith("<!--");
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
};

/* --- ortak kurallar (her dilde güvenli) --- */
function commonRules(): Rule[] {
  return [
    {
      id: "c-todo",
      title: "Bitirilmemiş iş yorumları",
      detail: "TODO / FIXME / HACK işaretleri yayından önce gözden geçirilmeli.",
      severity: "bilgi",
      fixable: false,
      match: (l) => /\b(TODO|FIXME|XXX|HACK)\b/.test(l),
    },
    {
      id: "c-longline",
      title: "100 karakteri aşan satırlar",
      detail: "Uzun satırlar okunabilirliği düşürür; 80–100 arası idealdir.",
      severity: "bilgi",
      fixable: false,
      match: (l) => l.length > 100,
    },
    {
      id: "c-trailingws",
      title: "Satır sonu boşlukları",
      detail: "Görünmez boşluklar diff'leri kirletir.",
      severity: "bilgi",
      fixable: true,
      match: (l) => /[ \t]+$/.test(l) && l.trim().length > 0,
      fix: (l) => l.replace(/[ \t]+$/, ""),
    },
  ];
}

/* --- JavaScript / TypeScript --- */
function jsRules(lang: Lang): Rule[] {
  return [
    {
      id: "js-var",
      title: "var kullanımı",
      detail: "var işlev kapsamlıdır ve hoisting sürprizleri yaratır; let / const tercih et.",
      severity: "uyari",
      fixable: true,
      match: (l) => !isCommentLine(l, lang) && /\bvar\s+[\w$]/.test(l),
      fix: (l) => l.replace(/\bvar\b/, "let"),
    },
    {
      id: "js-loose-eq",
      title: "Gevşek eşitlik (== / !=)",
      detail: "Tür dönüşümü yapan gevşek eşitlik beklenmedik sonuçlar doğurur; === ve !== kullan.",
      severity: "kritik",
      fixable: true,
      match: (l) =>
        !isCommentLine(l, lang) && (/(^|[^=!<>])==(?!=)/.test(l) || /!=(?!=)/.test(l)),
      fix: (l) => l.replace(/([^=!<>]|^)==(?!=)/g, "$1===").replace(/!=(?!=)/g, "!=="),
    },
    {
      id: "js-console",
      title: "console.log kalıntıları",
      detail: "Hata ayıklama çıktılarını yayına taşıma; bir logger kullan ya da kaldır.",
      severity: "bilgi",
      fixable: false,
      match: (l) => !isCommentLine(l, lang) && /\bconsole\.\w+\s*\(/.test(l),
    },
    ...commonRules(),
  ];
}

/* --- Dart / Flutter ---
   Dart'ta == / != DOĞRUDUR, var yaygındır; JS kuralları uygulanmaz. */
function dartRules(): Rule[] {
  return [
    {
      id: "dart-new",
      title: "Gereksiz new anahtar sözcüğü",
      detail: "Dart 2+ 'new' gerektirmez; kaldırılması lint (unnecessary_new) önerisidir.",
      severity: "uyari",
      fixable: true,
      match: (l) => !isCommentLine(l, "dart") && /\bnew\s+[A-Z]\w*\s*[(<]/.test(l),
      fix: (l) => l.replace(/\bnew\s+(?=[A-Z])/g, ""),
    },
    {
      id: "dart-print",
      title: "print() ifadeleri",
      detail: "Üretim kodunda print yerine debugPrint ya da bir log paketi kullan.",
      severity: "uyari",
      fixable: false,
      match: (l) => !isCommentLine(l, "dart") && /\bprint\s*\(/.test(l),
    },
    {
      id: "dart-dynamic",
      title: "dynamic / as dynamic kullanımı",
      detail: "Tür güvenliğini devre dışı bırakır; somut tür ya da generic tercih et.",
      severity: "uyari",
      fixable: false,
      match: (l) => !isCommentLine(l, "dart") && /\bas\s+dynamic\b|\bdynamic\s+\w+\s*=/.test(l),
    },
    {
      id: "dart-runtime-type",
      title: ".runtimeType karşılaştırması",
      detail: "Tür kontrolü için runtimeType yerine 'is' operatörü daha güvenli ve okunaklıdır.",
      severity: "bilgi",
      fixable: false,
      match: (l) => !isCommentLine(l, "dart") && /\.runtimeType\s*==/.test(l),
    },
    ...commonRules(),
  ];
}

/* --- Python --- */
function pyRules(): Rule[] {
  return [
    {
      id: "py-wildcard",
      title: "Yıldızlı import (import *)",
      detail: "İsim alanını kirletir ve çakışmalara yol açar; açık import kullan.",
      severity: "uyari",
      fixable: false,
      match: (l) => /^\s*from\s+\S+\s+import\s+\*/.test(l),
    },
    {
      id: "py-print",
      title: "print() kalıntıları",
      detail: "Betik dışında logging modülünü tercih et.",
      severity: "bilgi",
      fixable: false,
      match: (l) => !isCommentLine(l, "python") && /\bprint\s*\(/.test(l),
    },
    ...commonRules(),
  ];
}

/* --- HTML --- */
function htmlRules(): Rule[] {
  return [
    {
      id: "html-inline-style",
      title: "Satır içi style özniteliği",
      detail: "Stil mantığını CSS'e taşı; satır içi style yeniden kullanımı engeller.",
      severity: "bilgi",
      fixable: false,
      match: (l) => /\bstyle\s*=\s*["']/.test(l),
    },
    ...commonRules(),
  ];
}

/* --- CSS --- */
function cssRules(): Rule[] {
  return [
    {
      id: "css-important",
      title: "!important kullanımı",
      detail: "Özgüllük savaşını kaybedenlerin silahıdır; seçiciyi güçlendirmeyi dene.",
      severity: "uyari",
      fixable: false,
      match: (l) => /!important/.test(l),
    },
    ...commonRules(),
  ];
}

function getRules(lang: Lang): Rule[] {
  switch (lang) {
    case "dart":
      return dartRules();
    case "js":
    case "ts":
      return jsRules(lang);
    case "python":
      return pyRules();
    case "html":
      return htmlRules();
    case "css":
      return cssRules();
    default:
      /* Bilinmeyen dil → yalnızca güvenli ortak kontroller.
         Hiçbir dil varsayımı yapılmaz, syntax'a dokunulmaz. */
      return commonRules();
  }
}

/* ---------------- yapısal kontroller ---------------- */

function computeMaxDepth(lines: string[], lang: Lang): number {
  if (lang === "python") {
    let max = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const indent = line.match(/^ */)?.[0].length ?? 0;
      const depth = Math.floor(indent / 4);
      if (depth > max) max = depth;
    }
    return max;
  }
  if (lang === "html" || lang === "unknown") return 0;
  let depth = 0;
  let max = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        if (depth > max) max = depth;
      } else if (ch === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
  }
  return max;
}

function findDupLines(lines: string[]): { count: number; lineNums: number[] } {
  const seen = new Map<string, number[]>();
  lines.forEach((l, i) => {
    const norm = l.trim();
    if (norm.length < 12) return;
    if (/^[)}\]>,;]+$/.test(norm)) return;
    const arr = seen.get(norm) ?? [];
    arr.push(i + 1);
    seen.set(norm, arr);
  });
  let extra = 0;
  const nums: number[] = [];
  seen.forEach((arr) => {
    if (arr.length > 1) {
      extra += arr.length - 1;
      nums.push(...arr);
    }
  });
  nums.sort((a, b) => a - b);
  return { count: extra, lineNums: nums };
}

function countParams(lines: string[], lang: Lang): { count: number; lineNums: number[] } {
  if (lang === "html" || lang === "css" || lang === "unknown") return { count: 0, lineNums: [] };
  const defRe =
    lang === "python"
      ? /^\s*def\s+\w+\s*\(/
      : /\b(?:function\s+\w+|(?:const|let|var|final)\s+\w+\s*=|=>)\s*\(|\w+\s*\([^)]*\)\s*[{=>]/;
  let count = 0;
  const nums: number[] = [];
  lines.forEach((l, i) => {
    if (isCommentLine(l, lang)) return;
    if (!defRe.test(l)) return;
    const open = l.indexOf("(");
    if (open === -1) return;
    let depth = 0;
    let content = "";
    for (let j = open; j < l.length; j++) {
      const ch = l[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
      if (depth === 1 && j !== open) content += ch;
    }
    if (!content.trim()) return;
    let pd = 0;
    const parts = content.split(",").filter(() => true);
    for (const ch of content) {
      if (ch === "(" || ch === "[" || ch === "{") pd++;
      else if (ch === ")" || ch === "]" || ch === "}") pd--;
    }
    const top = parts.filter((p) => p.trim()).length;
    if (top > 4 && pd === 0) {
      count++;
      nums.push(i + 1);
    }
  });
  return { count, lineNums: nums };
}

/* ---------------- ana analiz ---------------- */

export function analyze(code: string, langOverride: Lang | "auto" = "auto"): Analysis {
  const lang = langOverride === "auto" ? detectLanguage(code) : langOverride;
  const lines = code.split("\n");
  const totalLines = lines.length;
  const codeLines = lines.filter((l) => l.trim().length > 0).length;
  const empty = code.trim().length === 0;

  const rules = getRules(lang);
  const findings: Finding[] = [];

  /* satır bazlı kurallar */
  for (const rule of rules) {
    const hits: number[] = [];
    lines.forEach((l, i) => {
      if (rule.match(l)) hits.push(i + 1);
    });
    if (hits.length > 0) {
      findings.push({
        id: rule.id,
        title: rule.title,
        detail: rule.detail,
        severity: rule.severity,
        count: hits.length,
        lines: hits,
        fixable: rule.fixable,
      });
    }
  }

  /* yapısal kontroller */
  const dup = findDupLines(lines);
  if (dup.count > 0) {
    findings.push({
      id: "c-dup",
      title: "Kopyala-yapıştır satırlar",
      detail: "Aynı satır birden çok yerde geçiyor; ortak fonksiyon ya da döngü çıkar.",
      severity: "uyari",
      count: dup.count,
      lines: dup.lineNums,
      fixable: false,
    });
  }

  const maxDepth = computeMaxDepth(lines, lang);
  if (maxDepth > 4) {
    findings.push({
      id: "c-depth",
      title: "Derin iç içe geçme",
      detail: `${maxDepth} seviye girinti/blok var; erken return ve küçük fonksiyonlarla sadeleştir.`,
      severity: "uyari",
      count: 1,
      lines: [],
      fixable: false,
    });
  }

  const commentLines = lines.filter((l) => isCommentLine(l, lang)).length;
  const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;
  if (!empty && codeLines >= 8 && commentRatio < 0.02) {
    findings.push({
      id: "c-comments",
      title: "Yorum neredeyse hiç yok",
      detail: "Karmaşık bölümlere kısa açıklamalar eklemek sonraki okuyucuya iyiliktir.",
      severity: "bilgi",
      count: 1,
      lines: [],
      fixable: false,
    });
  }

  const params = countParams(lines, lang);
  if (params.count > 0) {
    findings.push({
      id: "c-params",
      title: "Kalabalık parametre listesi",
      detail: "4'ten çok parametre yerine tek bir seçenek nesnesi / veri sınıfı düşün.",
      severity: "bilgi",
      count: params.count,
      lines: params.lineNums,
      fixable: false,
    });
  }

  /* fonksiyon sayısı (metrik için) */
  const fnRe =
    lang === "python"
      ? /^\s*def\s+\w+/
      : /\b(?:function\s+\w+|(?:const|let|var|final)\s+\w+\s*=\s*(?:async\s+)?\()/;
  const functions = lines.filter((l) => fnRe.test(l)).length;

  /* ortalama satır uzunluğu */
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const avgLineLen = nonEmpty.length
    ? Math.round(nonEmpty.reduce((a, l) => a + l.length, 0) / nonEmpty.length)
    : 0;

  /* puan */
  let penalty = 0;
  findings.forEach((f) => {
    penalty += SEVERITY_META[f.severity].weight * Math.min(f.count, 6);
  });
  const score = empty ? 0 : Math.max(0, Math.min(100, Math.round(100 - penalty)));

  const grade =
    score >= 90
      ? "Pırıl Pırıl"
      : score >= 75
      ? "Sağlam"
      : score >= 55
      ? "İdare Eder"
      : score >= 35
      ? "Sallantıda"
      : "Kritik";
  const gradeHex =
    score >= 90 ? "#6fe3a5" : score >= 75 ? "#a8d4a0" : score >= 55 ? "#ffbe66" : "#ff7b72";

  const fixableCount = findings.filter((f) => f.fixable).reduce((a, f) => a + f.count, 0);

  findings.sort((a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank);

  return {
    empty,
    lang,
    langLabel: LANG_META[lang].label,
    score,
    grade,
    gradeHex,
    findings,
    fixableCount,
    metrics: {
      codeLines,
      totalLines,
      avgLineLen,
      maxDepth,
      dupExtra: dup.count,
      commentRatio,
      functions,
    },
    chars: code.length,
  };
}

/* ---------------- güvenli otomatik düzeltme ----------------
   Yalnızca algılanan/seçilen dilin fixable kuralları çalışır. */

export function autoFix(code: string, lang: Lang): { code: string; applied: number } {
  const rules = getRules(lang).filter((r) => r.fixable && r.fix);
  let applied = 0;
  const fixed = code
    .split("\n")
    .map((line) => {
      let l = line;
      for (const r of rules) {
        if (r.fix && r.match(l)) {
          const before = l;
          l = r.fix(l);
          if (l !== before) applied++;
        }
      }
      return l;
    })
    .join("\n");
  return { code: fixed, applied };
}

/* ---------------- örnekler ---------------- */

export const MESSY_SAMPLE = `// Kullanıcı listesini getirip ekrana basar
var API_URL = "https://api.ornek.dev/v1"

function fetchUsers(token) {
  console.log("istek atılıyor...")
  return fetch(API_URL + "/users", {
    headers: { Authorization: "Bearer " + token }
  }).then(function (res) { return res.json() })
}

function renderList(users) {
  var list = document.getElementById("list")
  for (var i = 0; i < users.length; i++) {
    var user = users[i]
    if (user.role == "admin") {
      if (user.active == true) {
        if (user.score != undefined) {
          console.log(user.name, user.score)
          var li = document.createElement("li")
          li.textContent = user.name + " — " + user.score
          list.appendChild(li)
        }
      }
    }
  }
}

// TODO: hata yakalama ekle
function init(a, b, c, d, e, f) {
  fetchUsers(a).then(renderList)
}
init("tkn_123", 1, 2, 3, 4, 5)   `;

export const CLEAN_SAMPLE = `const API_URL = "https://api.ornek.dev/v1";

async function fetchUsers(token) {
  const res = await fetch(API_URL + "/users", {
    headers: { Authorization: "Bearer " + token },
  });
  return res.json();
}

function renderList(users) {
  const list = document.getElementById("list");
  for (const user of users) {
    if (user.role !== "admin" || !user.active) continue;
    if (user.score === undefined) continue;
    const li = document.createElement("li");
    li.textContent = user.name + " — " + user.score;
    list.appendChild(li);
  }
}

function init(token) {
  fetchUsers(token).then(renderList);
}
init("tkn_123");
`;

/* Dart örneği: == , != , var  Dart'ta DOĞRUDUR — dokunulmaz.
   Gereksiz 'new', print(), derin iç içe geçme ve kopya satırlar yakalanır. */
export const DART_SAMPLE = `import 'package:flutter/material.dart';

class VakitKarti extends StatefulWidget {
  final String? subtitle;
  final String deger;
  const VakitKarti({Key? key, this.subtitle, required this.deger}) : super(key: key);

  @override
  State<VakitKarti> createState() => _VakitKartiState();
}

class _VakitKartiState extends State<VakitKarti> {
  final vakitler = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"];

  Widget vakitYap(int i) {
    var vakit = vakitler[i];
    var sonMu = false;
    if (i == vakitler.length - 1) {
      sonMu = true;
    }
    if (widget.subtitle != null) {
      print("vakit: \$vakit");
      if (sonMu == true) {
        if (vakit == "Yatsı") {
          return new Text(vakit);
        }
      }
    }
    return new Text(vakit);
  }

  @override
  Widget build(BuildContext context) {
    var liste = <Widget>[];
    for (var vakit in vakitler) {
      liste.add(new Text(vakit));
    }
    return new Column(children: liste);
  }
}
`;
