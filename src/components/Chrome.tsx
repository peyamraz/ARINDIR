import { useReveal } from "../lib/hooks";

/* ---------- logo ---------- */

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M11 6.5c-3.2 0-3.2 3.2-3.2 5.4 0 1.9.4 3.6-3.3 4.1 3.7.5 3.3 2.2 3.3 4.1 0 2.2 0 5.4 3.2 5.4"
        stroke="#79c0ff"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M21 6.5c3.2 0 3.2 3.2 3.2 5.4 0 1.9-.4 3.6 3.3 4.1-3.7.5-3.3 2.2-3.3 4.1 0 2.2 0 5.4-3.2 5.4"
        stroke="#79c0ff"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M16 10.2l1.7 4.1 4.1 1.7-4.1 1.7-1.7 4.1-1.7-4.1-4.1-1.7 4.1-1.7 1.7-4.1z"
        fill="#ffab3d"
      />
    </svg>
  );
}

/* ---------- üst çubuk ---------- */

export function Masthead() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight text-ink-50">
            ARINDIR
          </span>
          <span className="mt-0.5 hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-400 sm:inline">
            kod arındırma stüdyosu
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-ink-600 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-300 md:flex">
            <svg className="h-3 w-3 text-arc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3" strokeLinecap="round" />
              <path d="M18 3v3.5h-3.5M6 21v-3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            tarayıcı içi · sunucusuz
          </div>
          <div className="flex items-center gap-2 rounded-full border border-mint-500/35 bg-mint-500/10 px-3 py-1">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint-400" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-mint-300">analiz canlı</span>
          </div>
          <div className="rounded-full border border-ink-600 px-2.5 py-1 font-mono text-[10px] text-ink-300">
            v0.9
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------- akan kontrol bandı ---------- */

const TICKER_ITEMS = [
  "var taraması",
  "gevşek eşitlik",
  "console kalıntıları",
  "todo / fixme",
  "uzun satırlar",
  "kopya bloklar",
  "iç içe derinlik",
  "yorum oranı",
  "parametre sayısı",
  "gizli boşluklar",
];

function TickerRun({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {TICKER_ITEMS.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
            {item}
          </span>
          <svg className="h-2 w-2 text-ember-500" viewBox="0 0 8 8" fill="currentColor">
            <path d="M4 0l4 4-4 4-4-4z" />
          </svg>
        </span>
      ))}
    </div>
  );
}

export function Ticker() {
  return (
    <div className="ticker ticker-mask overflow-hidden border-b border-ink-700/60 bg-ink-900/70 py-2">
      <div className="tick-track flex w-max">
        <TickerRun />
        <TickerRun hidden />
      </div>
    </div>
  );
}

/* ---------- neler taranıyor ---------- */

const CHECKS = [
  { t: "var → let / const dönüşümü", d: "kapsam sızıntısı" },
  { t: "Gevşek eşitlik (==, !=)", d: "tip dönüşümü tuzağı" },
  { t: "console.log kalıntıları", d: "debug sızıntısı" },
  { t: "TODO / FIXME / HACK", d: "açık işareler" },
  { t: "100+ karakter satırlar", d: "okunabilirlik" },
  { t: "Kopyala-yapıştır blokları", d: "tekrar kokusu" },
  { t: "İç içe geçme derinliği", d: "ok biçimli kod" },
  { t: "Yorum oranı", d: "niyet belgelenmesi" },
  { t: "Parametre şişkinliği", d: "imza tasarımı" },
  { t: "Satır sonu boşlukları", d: "görünmez gürültü" },
];

export function ScanStrip() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section ref={ref} className={`reveal ${shown ? "shown" : ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ember-400">
            neler taranıyor
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 md:text-4xl">
            On kontrol, tek geçiş.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ink-300">
          Her tuş vuruşunda motor kodu baştan süzer; bulgular önem sırasına göre dizilir ve
          doğrudan satıra bağlanır.
        </p>
      </div>
      <div className="mt-7 flex flex-wrap gap-2.5">
        {CHECKS.map((c, i) => (
          <div
            key={c.t}
            className="group cursor-default rounded-md border border-ink-600/80 bg-ink-900/70 px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ember-400/60 hover:bg-ink-800"
            style={{ transitionDelay: `${i * 10}ms` }}
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 text-mint-400 transition-transform duration-200 group-hover:scale-125"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <circle cx="12" cy="12" r="9" strokeWidth="1.6" opacity="0.45" />
                <path d="M8.5 12.3l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-medium text-ink-100">{c.t}</span>
              <span className="font-mono text-[10px] text-ink-500">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-1 pl-[22px] font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {c.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- süreç ---------- */

const STEPS = [
  {
    n: "01",
    t: "Yapıştır",
    d: "Kodu editöre bırak; motor sen daha yazarken taramaya başlar, hiçbir şey yüklemezsin.",
    hex: "#ffab3d",
  },
  {
    n: "02",
    t: "İncele",
    d: "Puan kadranı, metrikler ve satıra inen bulgular anında raporlanır; bulguya tıkla, satır yanar.",
    hex: "#79c0ff",
  },
  {
    n: "03",
    t: "Arındır",
    d: "Güvenli düzeltmeleri tek tıkla uygula, sonucu panoya kopyala, kod review'a öyle gönder.",
    hex: "#6fe3a5",
  },
];

export function HowItWorks() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section ref={ref} className={`reveal ${shown ? "shown" : ""}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-arc-400">süreç</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 md:text-4xl">
        Üç adımda arınma.
      </h2>
      <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-0">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className={`group relative md:px-8 ${i === 0 ? "md:pl-0" : "md:border-l md:border-ink-700"} ${
              i === 2 ? "md:pr-0" : ""
            }`}
          >
            <span
              className="font-display text-[68px] font-bold leading-none tracking-tight transition-colors duration-300"
              style={{ WebkitTextStroke: `1.5px ${s.hex}66`, color: "transparent" }}
            >
              {s.n}
            </span>
            <h3
              className="mt-3 font-display text-xl font-bold tracking-tight transition-colors duration-300"
              style={{ color: s.hex }}
            >
              {s.t}
            </h3>
            <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-ink-300">{s.d}</p>
            <span
              className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-500 group-hover:w-full md:bottom-auto md:top-0"
              style={{ background: `${s.hex}55` }}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- alt bilgi ---------- */

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-700/60 bg-ink-900/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 font-mono text-[11px] text-ink-400 sm:flex-row sm:items-center md:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={18} />
          <span>
            ARINDIR — kodun cihazından çıkmaz; tüm analiz tarayıcıda çalışır.
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-ink-500">Space Grotesk · IBM Plex · JetBrains Mono</span>
          <span className="rounded-sm border border-ink-600 px-1.5 py-0.5 text-[10px] text-ink-300">
            v0.9
          </span>
        </div>
      </div>
    </footer>
  );
}
