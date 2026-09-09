/* ============================================================
   ARINDIR — dil-farkındalıklı sezgisel kod analiz motoru v1.1
   Önce dili tanır, sonra YALNIZCA o dilin kurallarını uygular.
   Emin olamazsa sadece güvenli ortak kontrolleri çalıştırır.
   ============================================================ */

export type Lang = "js" | "ts" | "dart" | "python" | "html" | "css" | "unknown";

export const LANG_META: Record<Lang, { label: string; color: string; ext: string }> = {
  js: { label: "JavaScript", color: "#ffbe66", ext: ".js" },
  ts: { label: "TypeScript", color: "#79c0ff", ext: ".ts" },
  dart: { label: "Dart / Flutter", color: "#6fe3a5", ext: ".dart" },
  python: { label: "Python", color: "#9df0c2", ext: ".py" },
  html: { label: "HTML", color: "#ffa29b", ext: ".html" },
  css: { label: "CSS", color: "#d2a8ff", ext: ".css" },
  unknown: { label: "Metin / bilinmiyor", color: "#7b91ab", ext: ".txt" },
};

export type Severity = "eksik" | "kritik" | "uyari" | "bilgi";
export type Impact = "yuksek" | "orta" | "dusuk";

export const SEVERITY_META: Record<Severity, { label: string; hex: string; rank: number }> = {
  eksik: { label: "eksik", hex: "#ff8fab", rank: 0 },
  kritik: { label: "kritik", hex: "#f2554a", rank: 1 },
  uyari: { label: "uyarı", hex: "#ffab3d", rank: 2 },
  bilgi: { label: "bilgi", hex: "#79c0ff", rank: 3 },
};

export const IMPACT_META: Record<Impact, { label: string; hex: string; rank: number }> = {
  yuksek: { label: "yüksek etki", hex: "#f2554a", rank: 0 },
  orta: { label: "orta etki", hex: "#ffab3d", rank: 1 },
  dusuk: { label: "düşük etki", hex: "#79c0ff", rank: 2 },
};

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  lines: number[];
  fixable: boolean;
}

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  impact: Impact;
  snippet?: string;
}

export interface Analysis {
  empty: boolean;
  lang: Lang;
  langLabel: string;
  score: number;
  grade: string;
  gradeHex: string;
  findings: Finding[];
  suggestions: Suggestion[];
  fixableCount: number;
  missingCount: number;
  chars: number;
  metrics: {
    totalLines: number;
    codeLines: number;
    maxDepth: number;
    avgLineLen: number;
    functions: number;
    dupExtra: number;
    commentRatio: number;
  };
}

interface Line {
  no: number;
  raw: string;
  code: string; // yorumlar ve string içleri maskelenmiş hâl
}

/* ---------- yardımcılar ---------- */

function maskCommentsAndStrings(raw: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "line" | "block" | "s" | "d" | "t" = "code";
  while (i < raw.length) {
    const c = raw[i];
    const n = raw[i + 1];
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; out += "  "; i += 2; continue; }
      if (c === "'") { mode = "s"; out += '"'; i++; continue; }
      if (c === '"') { mode = "d"; out += '"'; i++; continue; }
      if (c === "`") { mode = "t"; out += '"'; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === "line") { out += " "; i++; continue; }
    if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; out += "  "; i += 2; continue; }
      out += " "; i++; continue;
    }
    // string modları
    if (c === "\\") { out += "  "; i += 2; continue; }
    const close = mode === "s" ? "'" : mode === "d" ? '"' : "`";
    if (c === close) { mode = "code"; out += '"'; i++; continue; }
    out += " "; i++;
  }
  return out;
}

function stripStrings(raw: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "s" | "d" | "t" = "code";
  while (i < raw.length) {
    const c = raw[i];
    if (mode === "code") {
      if (c === "'") { mode = "s"; out += '"'; i++; continue; }
      if (c === '"') { mode = "d"; out += '"'; i++; continue; }
      if (c === "`") { mode = "t"; out += '"'; i++; continue; }
      out += c; i++; continue;
    }
    if (c === "\\") { out += "  "; i += 2; continue; }
    const close = mode === "s" ? "'" : mode === "d" ? '"' : "`";
    if (c === close) { mode = "code"; out += '"'; i++; continue; }
    out += " "; i++;
  }
  return out;
}

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/* ---------- dil algılama ---------- */

export function detectLang(code: string): Lang {
  const c = code;
  const signals: [Lang, number][] = [
    ["dart", 6 * countMatches(c, /\bwidget\./g)
      + 8 * countMatches(c, /\bState<(Stateful)?Widget>\b/g)
      + 6 * countMatches(c, /\bsetState\s*\(/g)
      + 5 * countMatches(c, /\b(BuildContext|StatelessWidget|StatefulWidget|Key\?|EdgeInsets|BoxDecoration)\b/g)
      + 4 * countMatches(c, /^\s*(final|var)\s+\w+\s*=\s*new\s/gm)
      + 4 * countMatches(c, /\brequired\s+this\./g)
      + 6 * countMatches(c, /@(override|required|immutable)\b/g)
      + 5 * countMatches(c, /^\s*import\s+'package:/gm)
      + 3 * countMatches(c, /\bvoid\s+main\s*\(/g)],
    ["ts", 4 * countMatches(c, /:\s*(string|number|boolean|void|any|unknown|never)\b/g)
      + 5 * countMatches(c, /\binterface\s+[A-Z]/g)
      + 4 * countMatches(c, /\bas\s+(const|[A-Z])/g)
      + 3 * countMatches(c, /<[A-Z]\w*(\s+extends[^>]+)?>/g)
      + 4 * countMatches(c, /\b(enum|namespace)\s+[A-Z]/g)
      + 3 * countMatches(c, /!:/g)],
    ["js", 2 * countMatches(c, /\b(const|let)\s+/g)
      + 3 * countMatches(c, /=>/g)
      + 3 * countMatches(c, /\bconsole\./g)
      + 3 * countMatches(c, /\b(document|window|require\(|module\.exports|import\s+.*from\s+['"])/g)
      + 2 * countMatches(c, /\bfunction\s*[(\s]/g)
      + 2 * countMatches(c, /===|!==/g)
      + 2 * countMatches(c, /\b(var|true|false|null)\b/g)],
    ["python", 8 * countMatches(c, /^\s*def\s+\w+\s*\(/gm)
      + 4 * countMatches(c, /^\s*import\s+\w+/gm)
      + 4 * countMatches(c, /^\s*from\s+[\w.]+\s+import/gm)
      + 5 * countMatches(c, /\bself\./g)
      + 4 * countMatches(c, /:\s*$/gm)
      + 4 * countMatches(c, /\belif\b/g)
      + 4 * countMatches(c, /\bprint\s*\(/g)],
    ["html", 8 * countMatches(c, /<!DOCTYPE/gi)
      + 3 * countMatches(c, /<\/?(div|span|section|header|footer|nav|main|article|body|head|ul|li|p|a|img|button)\b/gi)
      + 5 * countMatches(c, /<[a-z][^>]*>/g)],
    ["css", 4 * countMatches(c, /:\s*(hover|focus|root|before|after)/g)
      + 2 * countMatches(c, /[.#][\w-]+\s*\{/g)
      + 2 * countMatches(c, /@(media|keyframes|import|font-face)\b/g)
      + 2 * countMatches(c, /\b(margin|padding|display|font-size|background(-color)?|border-radius)\s*:/g)],
  ];

  let best: Lang = "unknown";
  let bestScore = 0;
  for (const [lang, s] of signals) {
    if (s > bestScore) { best = lang; bestScore = s; }
  }
  if (best === "unknown" && bestScore === 0) {
    if (/[{};]/.test(c) && /\b(var|let|const|function|return|if|for)\b/.test(c)) best = "js";
    else if (/^\s*(def|import|from)\s/m.test(c)) best = "python";
  }
  if (best === "js" && /(interface\s+[A-Z]|:\s*(string|number|boolean|void)\b|<[A-Z]\w+>)/.test(c)) best = "ts";
  return best;
}

/* ---------- eksiklik taraması (parantez dengesi + dosya sonu) ---------- */

interface BalanceLeftover { ch: string; line: number }

function scanBalance(code: string): BalanceLeftover[] {
  const stack: BalanceLeftover[] = [];
  const pair: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let mode: "code" | "line" | "block" | "s" | "d" | "t" = "code";
  let line = 1;
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];
    if (c === "\n") {
      line++;
      if (mode === "line") mode = "code";
      if (mode === "s" || mode === "d") mode = "code"; // sonlanmamış string
      i++;
      continue;
    }
    if (mode === "code") {
      if (c === "/" && n === "/") { mode = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { mode = "block"; i += 2; continue; }
      if (c === "#") { mode = "line"; i++; continue; } // python yorumu
      if (c === "'") { mode = "s"; i++; continue; }
      if (c === '"') { mode = "d"; i++; continue; }
      if (c === "`") { mode = "t"; i++; continue; }
      if (c === "(" || c === "[" || c === "{") stack.push({ ch: c, line });
      else if (c === ")" || c === "]" || c === "}") {
        if (stack.length && stack[stack.length - 1].ch === pair[c]) stack.pop();
        else stack.push({ ch: c, line });
      }
      i++;
      continue;
    }
    if (mode === "block") {
      if (c === "*" && n === "/") { mode = "code"; i += 2; continue; }
      i++;
      continue;
    }
    if (mode === "line") { i++; continue; }
    // string modları
    if (c === "\\") { i += 2; continue; }
    const close = mode === "s" ? "'" : mode === "d" ? '"' : "`";
    if (c === close) mode = "code";
    i++;
  }
  return stack;
}

const CH_NAME: Record<string, string> = {
  "(": "yuvarlak (", ")": "yuvarlak )",
  "[": "köşeli [", "]": "köşeli ]",
  "{": "süslü {", "}": "süslü }",
};

function balanceFindings(code: string, totalLines: number): Finding[] {
  const leftovers = scanBalance(code);
  if (leftovers.length === 0) return [];
  const openers = leftovers.filter((l) => "([{".includes(l.ch));
  const closers = leftovers.filter((l) => ")]}".includes(l.ch));
  const out: Finding[] = [];
  if (openers.length) {
    out.push({
      id: "missing-close",
      severity: "eksik",
      title: `Kapanmamış parantez: ${[...new Set(openers.map((o) => o.ch))].join(" ")}`,
      detail: `${openers.length} açılan parantez hiç kapanmamış — kod derlenmez / çalışmaz. İşaretli satırdaki blokları kontrol et.`,
      count: openers.length,
      lines: [...new Set(openers.map((o) => o.line))].slice(0, 6),
      fixable: false,
    });
  }
  if (closers.length) {
    out.push({
      id: "extra-close",
      severity: "eksik",
      title: `Fazladan kapama: ${[...new Set(closers.map((o) => o.ch))].join(" ")}`,
      detail: `${closers.length} kapama parantezinin eşleşen açılışı yok — yapı bozuk.`,
      count: closers.length,
      lines: [...new Set(closers.map((o) => o.line))].slice(0, 6),
      fixable: false,
    });
  }
  void totalLines;
  return out;
}

/* ---------- bulgu kuralları ---------- */

function runChecks(lines: Line[], code: string, lang: Lang): Finding[] {
  const findings: Finding[] = [];
  const codeLines = lines.filter((l) => l.code.trim().length > 0);
  const add = (f: Omit<Finding, "count" | "lines">, hits: number[]) => {
    if (hits.length > 0)
      findings.push({ ...f, count: hits.length, lines: [...new Set(hits)].slice(0, 8) });
  };

  /* --- ortak kontroller (her dilde güvenli) --- */

  const todoHits: number[] = [];
  const longHits: number[] = [];
  const trailHits: number[] = [];
  for (const l of lines) {
    if (/\b(TODO|FIXME|HACK|XXX)\b/.test(l.code)) todoHits.push(l.no);
    if (l.raw.length > 100) longHits.push(l.no);
    if (l.raw.length > 0 && /[ \t]+$/.test(l.raw)) trailHits.push(l.no);
  }
  add({ id: "todo", severity: "uyari", title: "TODO / FIXME işaretleri", detail: "Açık işler kodla birlikte yayına girmesin — takip sistemine taşı.", fixable: false }, todoHits);
  add({ id: "long-line", severity: "bilgi", title: "100+ karakter satırlar", detail: "Uzun satırlar yan yana incelemeyi ve diff okumayı zorlaştırır.", fixable: false }, longHits);
  add({ id: "trailing-space", severity: "bilgi", title: "Satır sonu boşlukları", detail: "Görünmez gürültü; diff'lerde gereksiz değişiklik üretir.", fixable: true }, trailHits);

  // iç içe geçme derinliği (ortak; girinti tabanlı sezgi)
  let maxDepth = 0;
  const deepHits: number[] = [];
  for (const l of codeLines) {
    const indent = l.raw.match(/^[ \t]*/)?.[0] ?? "";
    const depth = Math.floor(indent.replace(/\t/g, "    ").length / 4);
    if (depth > maxDepth) maxDepth = depth;
    if (depth >= 4) deepHits.push(l.no);
  }
  if (maxDepth >= 4)
    add({ id: "deep-nesting", severity: "uyari", title: "Derin iç içe geçme", detail: "4+ seviye girinti 'ok biçimli kod' kokusu — erken dönüş (early return) ile düzleştirilebilir.", fixable: false }, deepHits.slice(0, 8));

  // kopyala-yapıştır blokları (ortak)
  const seen = new Map<string, number[]>();
  for (const l of codeLines) {
    const norm = l.code.replace(/\s+/g, " ").trim();
    if (norm.length < 12) continue;
    const arr = seen.get(norm) ?? [];
    arr.push(l.no);
    seen.set(norm, arr);
  }
  const dupHits: number[] = [];
  let dupExtra = 0;
  for (const arr of seen.values()) {
    if (arr.length > 1) {
      dupExtra += arr.length - 1;
      dupHits.push(...arr);
    }
  }
  if (dupExtra > 0)
    add({ id: "duplicates", severity: "uyari", title: "Kopyala-yapıştır satırları", detail: "Birebir tekrarlanan satırlar; tek yerde tanımla, her yerde kullan.", fixable: false }, dupHits.slice(0, 8));

  /* --- dil bazlı kurallar --- */

  if (lang === "js" || lang === "ts") {
    const varHits: number[] = [];
    const eqHits: number[] = [];
    const consoleHits: number[] = [];
    for (const l of lines) {
      const c = l.code;
      if (/(^|[^\w.])(var|let)\s+[\w$]/.test(c)) varHits.push(l.no);
      if (/(?<![=!<>])==(?!=)|!=(?!=)/.test(c)) eqHits.push(l.no);
      if (/\bconsole\.(log|warn|error|debug)\s*\(/.test(c)) consoleHits.push(l.no);
    }
    add({ id: "var-usage", severity: "kritik", title: "var / let kullanımı", detail: "var kapsam sızdırır; let → const tercih et. Tek tıkla var→let temizlenir.", fixable: true }, varHits);
    add({ id: "loose-eq", severity: "kritik", title: "Gevşek eşitlik (== / !=)", detail: "Gizli tip dönüşümü tuzağı; === ve !== kullan. Tek tıkla temizlenir.", fixable: true }, eqHits);
    add({ id: "console-log", severity: "uyari", title: "console.log kalıntıları", detail: "Debug çıktısı yayına gitmesin; log katmanına taşı ya da kaldır.", fixable: false }, consoleHits);
  }

  if (lang === "dart") {
    const newHits: number[] = [];
    const printHits: number[] = [];
    const dynamicHits: number[] = [];
    const runtimeHits: number[] = [];
    for (const l of lines) {
      const c = l.code;
      if (/(^|[^\w.])new\s+[A-Z_$]/.test(c)) newHits.push(l.no);
      if (/(^|[^\w.])print\s*\(/.test(c)) printHits.push(l.no);
      if (/\bdynamic\b/.test(c)) dynamicHits.push(l.no);
      if (/\.runtimeType\b/.test(c)) runtimeHits.push(l.no);
    }
    add({ id: "dart-new", severity: "uyari", title: "Gereksiz new (Dart 2+)", detail: "new anahtar sözcüğü Dart 2'den beri isteğe bağlı — kaldırması güvenlidir.", fixable: true }, newHits);
    add({ id: "dart-print", severity: "uyari", title: "print() kalıntıları", detail: "Prodüksiyonda debugPrint kullan; çıplak print release'te de çalışır.", fixable: false }, printHits);
    add({ id: "dart-dynamic", severity: "bilgi", title: "dynamic kullanımı", detail: "Tip güvenliğini devre dışı bırakır; somut tip ya da generic tercih et.", fixable: false }, dynamicHits);
    add({ id: "dart-runtime-type", severity: "bilgi", title: ".runtimeType karşılaştırması", detail: "Alt sınıflarda yanılır; 'is' kontrolü daha güvenli ve hızlıdır.", fixable: false }, runtimeHits);
  }

  if (lang === "python") {
    const starHits: number[] = [];
    const printHits: number[] = [];
    for (const l of lines) {
      const c = l.code;
      if (/^\s*from\s+[\w.]+\s+import\s+\*/.test(c)) starHits.push(l.no);
      if (/(^|[^\w.])print\s*\(/.test(c)) printHits.push(l.no);
    }
    add({ id: "py-star-import", severity: "kritik", title: "Yıldızlı import (import *)", detail: "İsim alanını kirletir, çakışma gizler; açık import yaz.", fixable: false }, starHits);
    add({ id: "py-print", severity: "bilgi", title: "print() kalıntıları", detail: "2+ print varsa logging modülüne geçmeyi düşün.", fixable: false }, printHits);
  }

  if (lang === "css") {
    const impHits: number[] = [];
    const pxHits: number[] = [];
    for (const l of lines) {
      const c = l.code;
      if (/!important/.test(c)) impHits.push(l.no);
      if (/font-size\s*:\s*\d+px/.test(c)) pxHits.push(l.no);
    }
    add({ id: "css-important", severity: "uyari", title: "!important kullanımı", detail: "Özgüllük savaşını kaybedenlerin silahı; seçiciyi güçlendirerek kaldır.", fixable: false }, impHits);
    add({ id: "css-px-font", severity: "bilgi", title: "px ile font-size", detail: "Kullanıcı ölçeklemesini kırar; rem tercih et.", fixable: false }, pxHits);
  }

  if (lang === "html") {
    const styleHits: number[] = [];
    for (const l of lines) {
      if (/<[a-z][^>]*\bstyle\s*=/i.test(l.code)) styleHits.push(l.no);
    }
    add({ id: "html-inline-style", severity: "bilgi", title: "Satır içi style özniteliği", detail: "Stilleri CSS dosyasına / sınıflara taşı; yeniden kullanım ve bakım kolaylaşır.", fixable: false }, styleHits);
  }

  /* --- eksiklikler (yapısal) --- */
  const totalLines = lines.length;
  findings.push(...balanceFindings(code, totalLines));

  if (code.length > 0 && !code.endsWith("\n")) {
    findings.push({
      id: "missing-final-nl",
      severity: "eksik",
      title: "Dosya sonu yeni satır eksik",
      detail: "POSIX araçları ve diff'ler dosyanın boş satırla bitmesini bekler. Tek tıkla eklenir.",
      count: 1,
      lines: [totalLines],
      fixable: true,
    });
  }

  return findings;
}

/* ---------- öneri motoru ---------- */

function buildSuggestions(lines: Line[], code: string, lang: Lang, findings: Finding[], metrics: Analysis["metrics"]): Suggestion[] {
  const out: Suggestion[] = [];
  const has = (id: string) => findings.some((f) => f.id === id);

  if (has("duplicates"))
    out.push({
      id: "sug-extract",
      title: "Tekrarlanan blokları fonksiyona çıkar",
      detail: "Birebir aynı satırlar birden çok yerde geçiyor. Tek bir fonksiyon tanımlayıp parametreyle çağırmak hata yüzeyini daraltır.",
      impact: "yuksek",
      snippet: `funksiyonOrtak(param) {\n  // tekrarlanan 6 satır burada bir kez yaşar\n}`,
    });

  if (has("deep-nesting"))
    out.push({
      id: "sug-early-return",
      title: "Erken dönüşle düzleştir",
      detail: "Koşulları ters çevirip fonksiyonun başında dön; else blokları ve girinti kendiliğinden erir.",
      impact: "yuksek",
      snippet: `if (user == null) return;\n// else sarmalından kurtuldun →`,
    });

  if (has("missing-close") || has("extra-close"))
    out.push({
      id: "sug-balance",
      title: "Parantez dengesini onar",
      detail: "Yapısal eksik varken diğer tüm öneriler anlamsız — önce derlenir hâle getir. Editörün eşleştirme vurgusunu kullan.",
      impact: "yuksek",
    });

  if (lang === "js" || lang === "ts") {
    if (has("var-usage"))
      out.push({
        id: "sug-const-default",
        title: "const varsayılan olsun",
        detail: "Yeniden atanmayan her değişken const; yalnızca gerçekten mutasyon varsa let. Ekipçe 'prefer-const' lint kuralı açın.",
        impact: "orta",
        snippet: `const limit = 42;      // değişmiyor\nlet cursor = 0;        // değişiyor`,
      });
    if (has("console-log"))
      out.push({
        id: "sug-logger",
        title: "Logları merkezileştir",
        detail: "console.* çağrılarını tek bir logger arkasına al; seviye, ortam ve format tek yerden yönetilir.",
        impact: "orta",
        snippet: `const log = createLogger("app");\nlog.info("ödeme tamam", { id });`,
      });
  }

  if (lang === "dart") {
    if (has("dart-print"))
      out.push({
        id: "sug-debugprint",
        title: "debugPrint'e geç",
        detail: "debugPrint uzun mesajları boğmadan basar ve kDebugMode ile kolayca kapatılır.",
        impact: "orta",
        snippet: `debugPrint("vakit: $vakit");`,
      });
    if (has("dart-dynamic"))
      out.push({
        id: "sug-dart-types",
        title: "Tipi açıkça belirt",
        detail: "dynamic, analizörün hata yakalamasını kapatır. Somut tip yaz; en kötü Object? + 'is' daraltması kullan.",
        impact: "orta",
        snippet: `final Vakit vakit = ...;\nif (value is TimeOfDay) { ... }`,
      });
    if (has("dart-runtime-type"))
      out.push({
        id: "sug-is-check",
        title: "runtimeType yerine 'is' kullan",
        detail: "runtimeType alt sınıflarda false-negative verir; 'is' hem güvenli hem JIT dostudur.",
        impact: "dusuk",
        snippet: `if (vakit is _TimeField) { ... }`,
      });
  }

  if (lang === "python") {
    if (has("py-star-import"))
      out.push({
        id: "sug-explicit-import",
        title: "Açık import yaz",
        detail: "Yalnızca kullandığın isimleri getir; çakışmalar görünür olur, IDE tamamlaması düzelir.",
        impact: "orta",
        snippet: `from math import sqrt, pi`,
      });
    if (has("py-print"))
      out.push({
        id: "sug-logging",
        title: "logging modülüne geç",
        detail: "print yerine logging: seviye, dosya çıktısı ve format tek yerden ayarlanır.",
        impact: "orta",
        snippet: `import logging\nlogging.info("islem tamam")`,
      });
  }

  if (lang === "css") {
    if (has("css-important"))
      out.push({
        id: "sug-specificity",
        title: "Özgüllüğü düzenle",
        detail: "!important'ı kaldırmak için seçiciyi güçlendir ya da katman (cascade layers) kullan.",
        impact: "orta",
        snippet: `.kart .baslik { color: var(--ink); }`,
      });
  }

  if (lang === "html") {
    if (has("html-inline-style"))
      out.push({
        id: "sug-css-class",
        title: "Stilleri sınıflara taşı",
        detail: "Satır içi style'lar temalanmayı ve yeniden kullanımı engeller; adlandırılmış sınıflara dönüştür.",
        impact: "orta",
        snippet: `<div class="kart kart--genis">`,
      });
  }

  if (metrics.commentRatio < 0.04 && metrics.codeLines >= 25)
    out.push({
      id: "sug-comments",
      title: "Niyet yorumları ekle",
      detail: `Kodun %${Math.round(metrics.commentRatio * 100)}'i yorum. "Ne" zaten okunuyor; "neden" ve sınır durumları için kısa yorumlar ekle.`,
      impact: "dusuk",
      snippet: `// yaz saati geçişinde dakikalar tekrarlanır → UTC karşılaştır`,
    });

  if (has("long-line"))
    out.push({
      id: "sug-wrap",
      title: "Uzun satırları böl",
      detail: "100 karakter üstü satırlar yan yana code review'da kaybolur; formatter (dart format / prettier) otomatik çözer.",
      impact: "dusuk",
    });

  void lines; void code;
  const order: Record<Impact, number> = { yuksek: 0, orta: 1, dusuk: 2 };
  return out.sort((a, b) => order[a.impact] - order[b.impact]).slice(0, 7);
}

/* ---------- puanlama ---------- */

function computeScore(findings: Finding[], metrics: Analysis["metrics"]): number {
  let penalty = 0;
  for (const f of findings) {
    const per =
      f.severity === "eksik" ? 10 : f.severity === "kritik" ? 8 : f.severity === "uyari" ? 4 : 2;
    penalty += Math.min(per * f.count, f.severity === "eksik" ? 30 : 36);
  }
  if (metrics.commentRatio < 0.03 && metrics.codeLines > 30) penalty += 5;
  if (metrics.maxDepth >= 6) penalty += 5;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

const GRADES: { min: number; label: string; hex: string }[] = [
  { min: 90, label: "Pırıl Pırıl", hex: "#6fe3a5" },
  { min: 75, label: "Gayet Temiz", hex: "#9df0c2" },
  { min: 60, label: "İdare Eder", hex: "#ffbe66" },
  { min: 40, label: "Bakım Gerekli", hex: "#ff9d5c" },
  { min: 0, label: "Kritik Durum", hex: "#f2554a" },
];

/* ---------- ana analiz ---------- */

export function analyze(code: string, forceLang: Lang = "unknown"): Analysis {
  const rawLines = code.split("\n");
  const totalLines = rawLines.length;
  const lines: Line[] = rawLines.map((raw, i) => ({
    no: i + 1,
    raw,
    code: maskCommentsAndStrings(raw),
  }));
  const codeLines = lines.filter((l) => l.code.trim().length > 0);

  const lang = forceLang === "unknown" ? detectLang(code) : forceLang;

  const empty = code.trim().length === 0;
  if (empty) {
    return {
      empty: true,
      lang,
      langLabel: LANG_META[lang].label,
      score: 0,
      grade: "—",
      gradeHex: "#33465f",
      findings: [],
      suggestions: [],
      fixableCount: 0,
      missingCount: 0,
      chars: 0,
      metrics: { totalLines, codeLines: 0, maxDepth: 0, avgLineLen: 0, functions: 0, dupExtra: 0, commentRatio: 0 },
    };
  }

  const findings = runChecks(lines, code, lang)
    .sort((a, b) => SEVERITY_META[a.severity].rank - SEVERITY_META[b.severity].rank);

  const maxDepth = (() => {
    let m = 0;
    for (const l of codeLines) {
      const indent = l.raw.match(/^[ \t]*/)?.[0] ?? "";
      const d = Math.floor(indent.replace(/\t/g, "    ").length / 4);
      if (d > m) m = d;
    }
    return m;
  })();

  const dupCounted = findings.find((f) => f.id === "duplicates");
  const commentLines = rawLines.filter((r) => /^\s*(\/\/|#|\/\*|\*)/.test(r)).length;
  const fnRe =
    lang === "python"
      ? /^\s*def\s+\w+/
      : lang === "html" || lang === "css"
        ? /$^/
        : /\b(function\s+[\w$]+\s*\(|[\w$]+\s*(?::\s*\([^)]*\)|\([^)]*\))\s*=>)/;
  const functions = codeLines.filter((l) => fnRe.test(l.code)).length;

  const metrics: Analysis["metrics"] = {
    totalLines,
    codeLines: codeLines.length,
    maxDepth,
    avgLineLen: codeLines.length
      ? Math.round(codeLines.reduce((s, l) => s + l.raw.length, 0) / codeLines.length)
      : 0,
    functions,
    dupExtra: dupCounted ? dupCounted.count - [...new Set(dupCounted.lines)].length + (dupCounted.count - 1) : 0,
    commentRatio: codeLines.length ? commentLines / Math.max(1, codeLines.length) : 0,
  };
  metrics.dupExtra = dupCounted ? Math.max(0, dupCounted.count - 1) : 0;

  const score = computeScore(findings, metrics);
  const grade = GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1];
  const suggestions = buildSuggestions(lines, code, lang, findings, metrics);

  return {
    empty: false,
    lang,
    langLabel: LANG_META[lang].label,
    score,
    grade: grade.label,
    gradeHex: grade.hex,
    findings,
    suggestions,
    fixableCount: findings.filter((f) => f.fixable).reduce((s, f) => s + f.count, 0),
    missingCount: findings.filter((f) => f.severity === "eksik").length,
    chars: code.length,
    metrics,
  };
}

/* ---------- güvenli otomatik düzeltme (dil kurallarına saygılı) ---------- */

export function autoFix(code: string, lang: Lang): { code: string; applied: number } {
  if (lang === "unknown") lang = detectLang(code);
  let applied = 0;

  if (lang === "js" || lang === "ts") {
    code = code
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("//");
        let head = idx >= 0 ? line.slice(0, idx) : line;
        const tail = idx >= 0 ? line.slice(idx) : "";
        const before = head;
        head = head
          .replace(/(^|[^.\w$])(var|let)(\s+[\w$])/g, (_m, a, _kw, c) => `${a}let${c}`)
          .replace(/(^|[^=!<>])==(?!=)/g, "$1===")
          .replace(/!=(?!=)/g, "!==");
        if (head !== before) applied++;
        return head + tail;
      })
      .join("\n");
  }

  if (lang === "dart") {
    code = code
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("//");
        let head = idx >= 0 ? line.slice(0, idx) : line;
        const tail = idx >= 0 ? line.slice(idx) : "";
        const before = head;
        head = head.replace(/(^|[^\w.])new(\s+)([A-Z_$][\w$]*)/g, "$1$3");
        if (head !== before) applied++;
        return head + tail;
      })
      .join("\n");
  }

  // ortak: satır sonu boşlukları
  const cleaned = code
    .split("\n")
    .map((l) => {
      const t = l.replace(/[ \t]+$/, "");
      if (t !== l) applied++;
      return t;
    })
    .join("\n");
  code = cleaned;

  // ortak: dosya sonu yeni satır
  if (code.length > 0 && !code.endsWith("\n")) {
    code += "\n";
    applied++;
  }

  return { code, applied };
}

/* ---------- markdown rapor ---------- */

export function buildMarkdownReport(a: Analysis, code: string): string {
  const now = new Date().toLocaleString("tr-TR");
  const L: string[] = [];
  L.push(`# ARINDIR — Arınma Raporu`);
  L.push("");
  L.push(`- **Tarih:** ${now}`);
  L.push(`- **Dil:** ${a.langLabel} (\`${a.lang}\`)`);
  L.push(`- **Puan:** ${a.empty ? "—" : `${a.score} / 100 (${a.grade})`}`);
  L.push(`- **Satır / karakter:** ${a.metrics.totalLines} / ${a.chars.toLocaleString("tr-TR")}`);
  L.push("");

  if (a.empty) {
    L.push("> Analiz edilecek kod yok.");
    return L.join("\n");
  }

  L.push(`## Bulgular (${a.findings.length})`);
  if (a.findings.length === 0) L.push("- Bulgu yok — kod temiz görünüyor.");
  for (const f of a.findings) {
    L.push(`- **[${SEVERITY_META[f.severity].label}]** ${f.title} — ${f.count}× ${f.fixable ? "_(oto-düzeltilebilir)_" : ""}`);
    L.push(`  - ${f.detail}`);
    L.push(`  - Satırlar: ${f.lines.join(", ")}`);
  }
  L.push("");

  L.push(`## Öneriler (${a.suggestions.length})`);
  if (a.suggestions.length === 0) L.push("- Ek öneri yok.");
  for (const s of a.suggestions) {
    L.push(`- **[${IMPACT_META[s.impact].label}]** ${s.title}`);
    L.push(`  - ${s.detail}`);
    if (s.snippet) {
      L.push("  ```");
      for (const sl of s.snippet.split("\n")) L.push(`  ${sl}`);
      L.push("  ```");
    }
  }
  L.push("");

  L.push(`## Metrikler`);
  L.push(`| ölçüt | değer |`);
  L.push(`|---|---|`);
  L.push(`| kod satırı | ${a.metrics.codeLines} |`);
  L.push(`| yorum oranı | %${Math.round(a.metrics.commentRatio * 100)} |`);
  L.push(`| ortalama satır | ${a.metrics.avgLineLen} karakter |`);
  L.push(`| maks. derinlik | ${a.metrics.maxDepth} |`);
  L.push(`| fonksiyon sayısı | ${a.metrics.functions} |`);
  L.push(`| kopya satır | ${a.metrics.dupExtra} |`);
  L.push("");
  L.push(`---`);
  L.push(`_Kod (${code.length.toLocaleString("tr-TR")} karakter) rapora eklenmedi; cihazdan çıkmadı._`);
  return L.join("\n");
}

/* ---------- örnek kodlar ---------- */

export const MESSY_SAMPLE = `// sepet yardımcısı — v1
var VERGI_ORANI = 0.18;

function sepetHesapla(urunler, kupon, kullanici, bolge, paraBirimi, callback) {
  var toplam = 0;
  for (var i = 0; i < urunler.length; i++) {
    var u = urunler[i];
    if (u.fiyat != null) {
      toplam = toplam + u.fiyat * u.adet;
      if (kupon != null) {
        if (kupon.gecerliMi) {
          if (kupon.tip == "yuzde") {
            toplam = toplam - toplam * kupon.deger / 100;
          } else {
            if (kupon.tip == "tutar") { toplam = toplam - kupon.deger; }
          }
        }
      }
    }
  }
  if (kullanici != null) {
    if (kullanici.tip == "premium") { toplam = toplam * 0.95; }
  }
  var kdv = toplam * VERGI_ORANI;
  console.log("sepet toplam: " + toplam);
  console.log("kdv: " + kdv);
  var sonuc = toplam + kdv;
  var yuvarla = Math.round(sonuc * 100) / 100;
  if (callback != null) {
    if (typeof callback == "function") { callback(yuvarla, sonuc, kdv, toplam); }
  }
  return yuvarla;
}

// TODO: para birimi dönüşümü eklenecek
function paraCevir(tutar, kaynak, hedef) {
  if (kaynak == hedef) { return tutar; }
  if (kaynak == "TRY" && hedef == "USD") { return tutar / 28.4; }
  if (kaynak == "USD" && hedef == "TRY") { return tutar * 28.4; }
  if (kaynak == "TRY" && hedef == "EUR") { return tutar / 30.9; }
  if (kaynak == "EUR" && hedef == "TRY") { return tutar * 30.9; }
  return tutar;
}

var stokKontrol = function (urunler) {
  var eksik = [];
  for (var i = 0; i < urunler.length; i++) {
    var u = urunler[i];
    if (u.stok != null) {
      if (u.stok <= 0) {
        eksik.push(u.ad);
        console.log("stok bitti: " + u.ad);
      }
    }
  }
  return eksik;
};`;

export const CLEAN_SAMPLE = `// vakit yardımcısı — saf sürüm
const VERGI_ORANI = 0.18;

function vergiHesapla(tutar: number): number {
  return Math.round(tutar * VERGI_ORANI * 100) / 100;
}

function sepetToplam(urunler: Urun[]): number {
  return urunler.reduce((toplam, u) => toplam + u.fiyat * u.adet, 0);
}`;

export const DART_SAMPLE = `import 'package:flutter/material.dart';

enum _TimeField { hour, minute }

class TimePickerDialog extends StatefulWidget {
  final String? title;
  final String? subtitle;
  final TimeOfDay? value;

  const TimePickerDialog({super.key, this.title, this.subtitle, this.value});

  @override
  State<TimePickerDialog> createState() => _TimePickerDialogState();
}

class _TimePickerDialogState extends State<TimePickerDialog> {
  late TimeOfDay selectedTime;
  _TimeField? selectedField = _TimeField.hour;

  @override
  void initState() {
    super.initState();
    selectedTime = widget.value != null
        ? widget.value!
        : TimeOfDay(hour: 12, minute: 0);
    print('TimePickerDialog açıldı'); // TODO: kaldırılacak
  }

  @override
  void didUpdateWidget(TimePickerDialog oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      print('değer güncellendi');
    }
  }

  void _setField(_TimeField field) {
    setState(() { selectedField = field; });
  }

  List<TimeOfDay> _buildSuggestions() {
    var vakitler = <TimeOfDay>[
      TimeOfDay(hour: 9, minute: 0),
      TimeOfDay(hour: 12, minute: 30),
      TimeOfDay(hour: 18, minute: 45),
    ];
    var result = <TimeOfDay>[];
    for (var vakit in vakitler) {
      result.add(new TimeOfDay(hour: vakit.hour, minute: vakit.minute));
    }
    return result;
  }

  Future<void> _showPicker(BuildContext context) async {
    var picked = await showTimePicker(context: context, initialTime: selectedTime);
    if (picked != null) {
      print('seçilen vakit: $picked');
    }
  }

  @override
  Widget build(BuildContext context) {
    final suggestions = _buildSuggestions();
    return new AlertDialog(
      title: widget.title != null ? new Text(widget.title!) : new Text('Vakit seç'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.subtitle != null) new Text(widget.subtitle!),
          for (var i = 0; i < suggestions.length; i++)
            new ListTile(
              title: new Text(
                '\${suggestions[i].hour}:\${suggestions[i].minute}',
              ),
              selected: selectedField == _TimeField.hour && i == 0,
              onTap: () => _setField(i == suggestions.length - 1
                  ? _TimeField.minute
                  : _TimeField.hour),
            ),
        ],
      ),
    );
  }
}`;
