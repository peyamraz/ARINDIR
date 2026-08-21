--- src/components/Report.tsx (原始)
import { useMemo } from "react";
import type { Analysis } from "../lib/analyze";
import { SEVERITY_META } from "../lib/analyze";
import { useAnimatedNumber } from "../lib/hooks";

interface ReportProps {
  analysis: Analysis;
  history: number[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const R = 56;
const CIRC = 2 * Math.PI * R;

function Sparkline({ data }: {  number[] }) {
  const w = 128;
  const h = 34;
  const pts = data.slice(-16);
  if (pts.length < 2) {
    return (
      <div className="flex h-[34px] items-center font-mono text-[10px] uppercase tracking-wider text-ink-500">
        puan geçmişi birikiyor…
      </div>
    );
  }
  const coords = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * (w - 6) + 3;
      const y = h - 4 - (v / 100) * (h - 9);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = coords.split(" ").pop()!.split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={coords}
        fill="none"
        stroke="#ffab3d"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="#6fe3a5" />
    </svg>
  );
}

export default function Report({ analysis, history, selectedId, onSelect }: ReportProps) {
  const { empty, score, findings, metrics } = analysis;
  const anim = useAnimatedNumber(empty ? 0 : score, 650);

  const sig = useMemo(
    () => findings.map((f) => `${f.id}:${f.count}`).join("|"),
    [findings]
  );

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { kritik: 0, uyari: 0, bilgi: 0 };
    findings.forEach((f) => (c[f.severity] += 1));
    return c;
  }, [findings]);

  return (
    <div className="flex h-full flex-col">
      {/* başlık */}
      <div className="flex items-center justify-between border-b border-ink-700 bg-ink-850 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint-400" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-200">
            canlı rapor
          </span>
        </div>
        <Sparkline data={history} />
      </div>

      {/* kadran + özet */}
      <div className="flex items-center gap-5 border-b border-ink-700/70 px-5 py-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#182435" strokeWidth="10" />
            {!empty && (
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={analysis.gradeHex}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - anim / 100)}
                transform="rotate(-90 70 70)"
                style={{ filter: `drop-shadow(0 0 8px ${analysis.gradeHex}55)`, transition: "stroke .4s ease" }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-bold tracking-tight text-ink-50">
              {empty ? "—" : Math.round(anim)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">/ 100</span>
          </div>
        </div>

        <div className="min-w-0">
          {empty ? (
            <>
              <p className="font-display text-xl font-bold text-ink-300">Beklemede</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">
                Editöre kod yapıştır; motor yazarken taramaya başlar.
              </p>
            </>
          ) : (
            <>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                style={{ borderColor: `${analysis.gradeHex}55`, color: analysis.gradeHex }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: analysis.gradeHex }} />
                <span className="font-display text-sm font-bold tracking-tight">{analysis.grade}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {(["kritik", "uyari", "bilgi"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_META[s].hex }} />
                    {sevCounts[s]} {SEVERITY_META[s].label}
                  </span>
                ))}
              </div>
              {analysis.fixableCount > 0 && (
                <p className="mt-2 font-mono text-[11px] text-mint-400">
                  ⌁ {analysis.fixableCount} sorun tek tıkla düzeltilebilir
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* metrikler */}
      <div className="grid grid-cols-3 gap-px border-b border-ink-700/70 bg-ink-700/50">
        {[
          { label: "kod satırı", value: String(metrics.codeLines) },
          { label: "yorum oranı", value: `%${Math.round(metrics.commentRatio * 100)}` },
          { label: "ort. satır", value: `${metrics.avgLineLen} kr` },
          { label: "maks derinlik", value: String(metrics.maxDepth) },
          { label: "fonksiyon", value: String(metrics.functions) },
          { label: "kopya satır", value: String(metrics.dupExtra) },
        ].map((m) => (
          <div key={m.label} className="bg-ink-900 px-3 py-2.5 transition-colors hover:bg-ink-850">
            <p className="font-display text-xl font-bold leading-none text-ink-100">{m.value}</p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-400">{m.label}</p>
          </div>
        ))}
      </div>

      {/* bulgular */}
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="px-6 py-10">
            <div className="rounded-lg border border-dashed border-ink-600 px-5 py-8 text-center">
              <svg className="mx-auto h-8 w-8 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 9l-4 3 4 3M16 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
                Rapor burada canlanacak. Bir bulguya tıkladığında ilgili satırlar editörde yanar.
              </p>
            </div>
          </div>
        ) : findings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-mint-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12.2l2.4 2.4 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-mint-400">Pırıl pırıl.</p>
            <p className="mx-auto mt-2 max-w-[240px] text-[13px] leading-relaxed text-ink-300">
              Motor hiçbir sorun bulamadı — bu kod yayına hazır görünüyor.
            </p>
          </div>
        ) : (
          <div key={sig}>
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                bulgular
              </span>
              <span className="font-mono text-[10px] text-ink-500">satıra gitmek için tıkla</span>
            </div>
            {findings.map((f, i) => {
              const meta = SEVERITY_META[f.severity];
              const active = selectedId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelect(active ? null : f.id)}
                  className={`rise-in group w-full border-b border-ink-700/50 px-4 py-3 text-left transition-colors ${
                    active ? "bg-ink-800" : "hover:bg-ink-800/60"
                  }`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: meta.hex, boxShadow: active ? `0 0 8px ${meta.hex}` : undefined }}
                    />
                    <span className="font-mono text-[13px] font-medium text-ink-100">{f.title}</span>
                    <span className="rounded-sm bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-200">
                      {f.count}×
                    </span>
                    {f.fixable && (
                      <span className="rounded-sm border border-mint-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mint-400">
                        oto
                      </span>
                    )}
                    <span
                      className="ml-auto font-mono text-[9.5px] uppercase tracking-wider"
                      style={{ color: meta.hex }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 pl-4 text-[12px] leading-relaxed text-ink-300">{f.detail}</p>
                  {active && f.lines.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-4">
                      {f.lines.slice(0, 10).map((ln) => (
                        <span
                          key={ln}
                          className="rounded-sm px-1.5 py-0.5 font-mono text-[10px]"
                          style={{ background: `${meta.hex}1c`, color: meta.hex }}
                        >
                          satır {ln}
                        </span>
                      ))}
                      {f.lines.length > 10 && (
                        <span className="px-1 font-mono text-[10px] text-ink-400">
                          +{f.lines.length - 10} daha
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            <p className="px-4 py-3 font-mono text-[10px] leading-relaxed text-ink-500">
              ipucu: <span className="text-mint-400">OTO</span> etiketli bulgular üstteki “Arındır”
              düğmesiyle güvenle temizlenir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


+++ src/components/Report.tsx (修改后)
import { useMemo } from "react";
import type { Analysis } from "../lib/analyze";
import { LANG_META, SEVERITY_META } from "../lib/analyze";
import { useAnimatedNumber } from "../lib/hooks";

interface ReportProps {
  analysis: Analysis;
  history: number[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const R = 56;
const CIRC = 2 * Math.PI * R;

function Sparkline({ data }: {  number[] }) {
  const w = 128;
  const h = 34;
  const pts = data.slice(-16);
  if (pts.length < 2) {
    return (
      <div className="flex h-[34px] items-center font-mono text-[10px] uppercase tracking-wider text-ink-500">
        puan geçmişi birikiyor…
      </div>
    );
  }
  const coords = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * (w - 6) + 3;
      const y = h - 4 - (v / 100) * (h - 9);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = coords.split(" ").pop()!.split(",");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={coords}
        fill="none"
        stroke="#ffab3d"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="#6fe3a5" />
    </svg>
  );
}

export default function Report({ analysis, history, selectedId, onSelect }: ReportProps) {
  const { empty, score, findings, metrics, langLabel, lang } = analysis;
  const langColor = LANG_META[lang].color;
  const anim = useAnimatedNumber(empty ? 0 : score, 650);

  const sig = useMemo(
    () => findings.map((f) => `${f.id}:${f.count}`).join("|"),
    [findings]
  );

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { kritik: 0, uyari: 0, bilgi: 0 };
    findings.forEach((f) => (c[f.severity] += 1));
    return c;
  }, [findings]);

  return (
    <div className="flex h-full flex-col">
      {/* başlık */}
      <div className="flex items-center justify-between border-b border-ink-700 bg-ink-850 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-mint-400" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-200">
            canlı rapor
          </span>
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider"
            style={{ background: `${langColor}1a`, color: langColor }}
          >
            {langLabel}
          </span>
        </div>
        <Sparkline data={history} />
      </div>

      {/* kadran + özet */}
      <div className="flex items-center gap-5 border-b border-ink-700/70 px-5 py-5">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#182435" strokeWidth="10" />
            {!empty && (
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={analysis.gradeHex}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - anim / 100)}
                transform="rotate(-90 70 70)"
                style={{ filter: `drop-shadow(0 0 8px ${analysis.gradeHex}55)`, transition: "stroke .4s ease" }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-bold tracking-tight text-ink-50">
              {empty ? "—" : Math.round(anim)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-400">/ 100</span>
          </div>
        </div>

        <div className="min-w-0">
          {empty ? (
            <>
              <p className="font-display text-xl font-bold text-ink-300">Beklemede</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">
                Editöre kod yapıştır; motor yazarken taramaya başlar.
              </p>
            </>
          ) : (
            <>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
                style={{ borderColor: `${analysis.gradeHex}55`, color: analysis.gradeHex }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: analysis.gradeHex }} />
                <span className="font-display text-sm font-bold tracking-tight">{analysis.grade}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                {(["kritik", "uyari", "bilgi"] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEVERITY_META[s].hex }} />
                    {sevCounts[s]} {SEVERITY_META[s].label}
                  </span>
                ))}
              </div>
              {analysis.fixableCount > 0 && (
                <p className="mt-2 font-mono text-[11px] text-mint-400">
                  ⌁ {analysis.fixableCount} sorun tek tıkla düzeltilebilir
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* metrikler */}
      <div className="grid grid-cols-3 gap-px border-b border-ink-700/70 bg-ink-700/50">
        {[
          { label: "kod satırı", value: String(metrics.codeLines) },
          { label: "yorum oranı", value: `%${Math.round(metrics.commentRatio * 100)}` },
          { label: "ort. satır", value: `${metrics.avgLineLen} kr` },
          { label: "maks derinlik", value: String(metrics.maxDepth) },
          { label: "fonksiyon", value: String(metrics.functions) },
          { label: "kopya satır", value: String(metrics.dupExtra) },
        ].map((m) => (
          <div key={m.label} className="bg-ink-900 px-3 py-2.5 transition-colors hover:bg-ink-850">
            <p className="font-display text-xl font-bold leading-none text-ink-100">{m.value}</p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-ink-400">{m.label}</p>
          </div>
        ))}
      </div>

      {/* bulgular */}
      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="px-6 py-10">
            <div className="rounded-lg border border-dashed border-ink-600 px-5 py-8 text-center">
              <svg className="mx-auto h-8 w-8 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 9l-4 3 4 3M16 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
                Rapor burada canlanacak. Bir bulguya tıkladığında ilgili satırlar editörde yanar.
              </p>
            </div>
          </div>
        ) : findings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-mint-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12.2l2.4 2.4 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-mint-400">Pırıl pırıl.</p>
            <p className="mx-auto mt-2 max-w-[240px] text-[13px] leading-relaxed text-ink-300">
              Motor hiçbir sorun bulamadı — bu kod yayına hazır görünüyor.
            </p>
          </div>
        ) : (
          <div key={sig}>
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                bulgular
              </span>
              <span className="font-mono text-[10px] text-ink-500">satıra gitmek için tıkla</span>
            </div>
            {findings.map((f, i) => {
              const meta = SEVERITY_META[f.severity];
              const active = selectedId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onSelect(active ? null : f.id)}
                  className={`rise-in group w-full border-b border-ink-700/50 px-4 py-3 text-left transition-colors ${
                    active ? "bg-ink-800" : "hover:bg-ink-800/60"
                  }`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: meta.hex, boxShadow: active ? `0 0 8px ${meta.hex}` : undefined }}
                    />
                    <span className="font-mono text-[13px] font-medium text-ink-100">{f.title}</span>
                    <span className="rounded-sm bg-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-200">
                      {f.count}×
                    </span>
                    {f.fixable && (
                      <span className="rounded-sm border border-mint-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-mint-400">
                        oto
                      </span>
                    )}
                    <span
                      className="ml-auto font-mono text-[9.5px] uppercase tracking-wider"
                      style={{ color: meta.hex }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 pl-4 text-[12px] leading-relaxed text-ink-300">{f.detail}</p>
                  {active && f.lines.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-4">
                      {f.lines.slice(0, 10).map((ln) => (
                        <span
                          key={ln}
                          className="rounded-sm px-1.5 py-0.5 font-mono text-[10px]"
                          style={{ background: `${meta.hex}1c`, color: meta.hex }}
                        >
                          satır {ln}
                        </span>
                      ))}
                      {f.lines.length > 10 && (
                        <span className="px-1 font-mono text-[10px] text-ink-400">
                          +{f.lines.length - 10} daha
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
            <p className="px-4 py-3 font-mono text-[10px] leading-relaxed text-ink-500">
              ipucu: <span className="text-mint-400">OTO</span> etiketli bulgular üstteki “Arındır”
              düğmesiyle güvenle temizlenir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
