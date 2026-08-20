import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "./components/Editor";
import Report from "./components/Report";
import { Footer, HowItWorks, Masthead, ScanStrip, Ticker } from "./components/Chrome";
import {
  analyze,
  autoFix,
  CLEAN_SAMPLE,
  DART_SAMPLE,
  LANG_META,
  MESSY_SAMPLE,
  SEVERITY_META,
} from "./lib/analyze";
import type { Lang } from "./lib/analyze";

const STORAGE_KEY = "arindir:code:v2";
const LANG_KEY = "arindir:lang:v1";

type LangChoice = Lang | "auto";

const LANG_OPTIONS: { value: LangChoice; label: string }[] = [
  { value: "auto", label: "Otomatik algıla" },
  { value: "dart", label: "Dart / Flutter" },
  { value: "js", label: "JavaScript" },
  { value: "ts", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
];

function loadInitialCode(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved;
  } catch {
    /* sessiz geç */
  }
  return MESSY_SAMPLE;
}

function loadInitialLang(): LangChoice {
  try {
    const saved = localStorage.getItem(LANG_KEY) as LangChoice | null;
    if (saved) return saved;
  } catch {
    /* sessiz geç */
  }
  return "auto";
}

export default function App() {
  const [code, setCode] = useState<string>(loadInitialCode);
  const [langChoice, setLangChoice] = useState<LangChoice>(loadInitialLang);
  const [history, setHistory] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef(0);

  const analysis = useMemo(() => analyze(code, langChoice), [code, langChoice]);
  const langMeta = LANG_META[analysis.lang];

  /* kodu + dil seçimini sakla */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem(LANG_KEY, langChoice);
    } catch {
      /* sessiz geç */
    }
  }, [code, langChoice]);

  /* puan geçmişini biriktir */
  useEffect(() => {
    if (analysis.empty) return;
    setHistory((h) => [...h.slice(-15), analysis.score]);
  }, [analysis.score, analysis.empty]);

  /* seçili bulgu artık yoksa bırak */
  useEffect(() => {
    if (selectedId && !analysis.findings.some((f) => f.id === selectedId)) {
      setSelectedId(null);
    }
  }, [analysis.findings, selectedId]);

  const showToast = (msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 2300);
  };

  /* sorunlu satırlar -> en ağır önem derecesinin rengi */
  const problems = useMemo(() => {
    const m: Record<number, { hex: string; rank: number }> = {};
    analysis.findings.forEach((f) => {
      const meta = SEVERITY_META[f.severity];
      f.lines.forEach((ln) => {
        if (!m[ln] || meta.rank < m[ln].rank) m[ln] = { hex: meta.hex, rank: meta.rank };
      });
    });
    const out: Record<number, string> = {};
    Object.entries(m).forEach(([k, v]) => (out[Number(k)] = v.hex));
    return out;
  }, [analysis]);

  const selected = analysis.findings.find((f) => f.id === selectedId) ?? null;
  const highlight = useMemo(() => new Set(selected?.lines ?? []), [selected]);
  const highlightHex = selected ? SEVERITY_META[selected.severity].hex : "#ffab3d";

  const handleFix = () => {
    const res = autoFix(code, analysis.lang);
    if (res.applied === 0) {
      showToast("Bu dilde uygulanacak güvenli düzeltme kalmadı.");
      return;
    }
    setCode(res.code);
    showToast(`${res.applied} güvenli düzeltme uygulandı ✦`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Kod panoya kopyalandı.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Kod panoya kopyalandı.");
    }
  };

  const loadSample = (kind: "js" | "dart" | "clean") => {
    const next = kind === "js" ? MESSY_SAMPLE : kind === "dart" ? DART_SAMPLE : CLEAN_SAMPLE;
    setCode(next);
    setSelectedId(null);
    showToast(
      kind === "js"
        ? "Dağınık JavaScript örneği yüklendi."
        : kind === "dart"
        ? "Flutter örneği yüklendi — Dart kuralları aktif."
        : "Temiz örnek yüklendi."
    );
  };

  const btnGhost =
    "rounded-md border border-ink-600 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-200 transition-all duration-150 hover:-translate-y-px hover:border-ink-400 hover:text-ink-50 active:translate-y-0 active:scale-[0.97]";

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ---- atmosfer ---- */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="bg-grid absolute inset-0" />
        <div className="glow-a absolute -left-44 -top-44 h-[36rem] w-[36rem] rounded-full bg-ember-500/[0.07] blur-3xl" />
        <div className="glow-b absolute -right-56 top-1/4 h-[40rem] w-[40rem] rounded-full bg-arc-500/[0.06] blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 h-[26rem] w-[26rem] rounded-full bg-mint-500/[0.05] blur-3xl" />
        <div className="bg-noise absolute inset-0 opacity-[0.05]" />
      </div>

      <div className="relative z-10">
        <Masthead />
        <Ticker />

        {/* ---- açılış ---- */}
        <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 md:px-6 md:pt-14">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.26em] text-ember-400">
                <svg className="h-3 w-3" viewBox="0 0 8 8" fill="currentColor">
                  <path d="M4 0l4 4-4 4-4-4z" />
                </svg>
                dil-farkındalıklı motor · gerçek zamanlı
                <span className="caret-blink -ml-1 inline-block h-3.5 w-[7px] bg-ember-400" />
              </p>
              <h1 className="mt-4 font-display text-[clamp(2.3rem,5.2vw,3.8rem)] font-bold leading-[1.03] tracking-tight text-ink-50">
                Kodunu yapıştır,
                <br />
                <span className="text-ember-400">saniyeler içinde</span> arınsın.
              </h1>
            </div>
            <div className="lg:pb-2">
              <p className="max-w-md text-[15px] leading-relaxed text-ink-300">
                Arındır önce kodun <em className="not-italic text-ink-100">dilini tanır</em>, sonra
                yalnızca o dilin kurallarını çalıştırır. Dart'ta{" "}
                <code className="rounded-sm bg-ink-800 px-1 font-mono text-[13px] text-mint-400">==</code>{" "}
                ve{" "}
                <code className="rounded-sm bg-ink-800 px-1 font-mono text-[13px] text-mint-400">var</code>{" "}
                doğrudur — JavaScript kuralları asla bulaşmaz.
              </p>
              <div className="mt-5 flex items-center gap-5 font-mono text-[11px] uppercase tracking-wider text-ink-400">
                <span>
                  <b className="font-display text-lg font-bold normal-case text-ember-400">6</b> dil
                </span>
                <span className="h-4 w-px bg-ink-600" />
                <span>
                  <b className="font-display text-lg font-bold normal-case text-arc-400">0</b> sunucu
                </span>
                <span className="h-4 w-px bg-ink-600" />
                <span>
                  <b className="font-display text-lg font-bold normal-case text-mint-400">~0 ms</b>{" "}
                  gecikme
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---- çalışma masası ---- */}
        <section className="mx-auto max-w-6xl px-4 md:px-6" id="masa">
          <div className="grid gap-5 lg:grid-cols-[7fr_5fr]">
            {/* editör paneli */}
            <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900/85 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.9)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2">
                <div className="mr-1 flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-3 py-1.5">
                  <svg className="h-3.5 w-3.5" style={{ color: langMeta.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-mono text-[11.5px] text-ink-100">
                    yapistirilan-kod{langMeta.ext}
                  </span>
                </div>

                {/* dil seçici */}
                <label className="flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-400">dil</span>
                  <select
                    value={langChoice}
                    onChange={(e) => setLangChoice(e.target.value as LangChoice)}
                    className="cursor-pointer bg-transparent font-mono text-[11.5px] text-ink-100 outline-none"
                  >
                    {LANG_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-ink-800 text-ink-100">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <button className={btnGhost} onClick={() => loadSample("js")}>
                    JS örneği
                  </button>
                  <button className={btnGhost} onClick={() => loadSample("dart")}>
                    Flutter örneği
                  </button>
                  <button className={btnGhost} onClick={() => loadSample("clean")}>
                    temiz
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`${btnGhost} flex items-center gap-1.5`}
                    title="Kodu panoya kopyala"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" />
                    </svg>
                    kopyala
                  </button>
                  <button
                    onClick={handleFix}
                    className="group relative flex items-center gap-2 rounded-md border border-transparent bg-ember-500 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-950 shadow-[0_6px_24px_-8px_rgba(255,171,61,0.7)] transition-all duration-150 hover:-translate-y-px hover:bg-ember-400 active:translate-y-0 active:scale-[0.97]"
                  >
                    <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" strokeLinecap="round" />
                    </svg>
                    arındır
                    {analysis.fixableCount > 0 && (
                      <span className="rounded-sm bg-ink-950/25 px-1.5 py-0.5 text-[10px] font-bold">
                        {analysis.fixableCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <Editor
                value={code}
                onChange={setCode}
                problems={problems}
                highlight={highlight}
                highlightHex={highlightHex}
              />

              <div className="flex items-center justify-between border-t border-ink-700 bg-ink-850 px-4 py-2 font-mono text-[10.5px] text-ink-400">
                <span>
                  {analysis.metrics.totalLines} satır · {analysis.chars.toLocaleString("tr-TR")} karakter
                  {selected && (
                    <span className="ml-2" style={{ color: highlightHex }}>
                      ⌖ “{selected.title}” satırları vurgulu
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1.5 rounded-sm px-1.5 py-0.5"
                    style={{ background: `${langMeta.color}1a`, color: langMeta.color }}
                  >
                    <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: langMeta.color }} />
                    {langChoice === "auto" ? "algılandı: " : "dil: "}
                    {langMeta.label}
                  </span>
                  <span className="hidden text-ink-500 sm:inline">çok-dilli motor v1.0</span>
                </span>
              </div>
            </div>

            {/* rapor paneli */}
            <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900/85 shadow-[0_24px_70px_-32px_rgba(0,0,0,0.9)] lg:max-h-[calc(520px+7.25rem)]">
              <Report
                analysis={analysis}
                history={history}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </section>

        {/* ---- alt bölümler ---- */}
        <div className="mx-auto mt-20 max-w-6xl space-y-20 px-4 md:px-6">
          <ScanStrip />
          <HowItWorks />
        </div>

        <Footer />
      </div>

      {/* ---- bildirim ---- */}
      {toast && (
        <div
          key={toast.id}
          className="toast-in fixed bottom-6 left-1/2 z-50 flex items-center gap-2.5 rounded-md border border-ink-600 bg-ink-800 px-4 py-2.5 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.9)]"
        >
          <svg className="h-3.5 w-3.5 text-ember-400" viewBox="0 0 8 8" fill="currentColor">
            <path d="M4 0l4 4-4 4-4-4z" />
          </svg>
          <span className="font-mono text-[12px] text-ink-100">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
