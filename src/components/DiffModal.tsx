import { useEffect } from "react";
import type { DiffResult } from "../lib/diff";

interface DiffModalProps {
  diff: DiffResult;
  filename: string;
  scoreDelta: number | null;
  onClose: () => void;
  onDownload: () => void;
}

export default function DiffModal({ diff, filename, scoreDelta, onClose, onDownload }: DiffModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-950/85 backdrop-blur-sm" onClick={onClose} />

      <div className="modal-in relative flex h-[min(80vh,680px)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-ink-600 bg-ink-900 shadow-[0_50px_140px_-30px_rgba(0,0,0,1)]">
        {/* başlık */}
        <div className="flex items-center gap-3 border-b border-ink-700 bg-ink-850 px-4 py-3">
          <svg className="h-4 w-4 text-ember-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3v12M6 15a3 3 0 103 3M18 21V9M18 9a3 3 0 10-3-3" strokeLinecap="round" />
          </svg>
          <div className="mr-auto">
            <p className="font-display text-[15px] font-bold tracking-tight text-ink-50">Ne değişti?</p>
            <p className="font-mono text-[10.5px] text-ink-400">
              {filename} — güvenli dönüşümlerin satır satır dökümü
            </p>
          </div>
          <span className="rounded-md bg-mint-500/15 px-2 py-1 font-mono text-[11px] font-bold text-mint-400">
            +{diff.added}
          </span>
          <span className="rounded-md bg-coral-500/15 px-2 py-1 font-mono text-[11px] font-bold text-coral-400">
            −{diff.removed}
          </span>
          {scoreDelta !== null && (
            <span className="hidden rounded-md border border-ember-500/40 px-2 py-1 font-mono text-[11px] font-bold text-ember-400 sm:inline">
              puan {scoreDelta >= 0 ? "+" : ""}
              {scoreDelta}
            </span>
          )}
          <button
            onClick={onClose}
            className="ml-1 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100"
            aria-label="Kapat"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* diff gövdesi */}
        <div className="flex-1 overflow-y-auto bg-ink-950/60">
          {diff.ops.map((op, idx) => {
            const isAdd = op.type === "add";
            const isDel = op.type === "del";
            return (
              <div
                key={idx}
                className={`flex items-stretch font-mono text-[12px] leading-[1.6] ${
                  isAdd ? "bg-mint-500/[0.09]" : isDel ? "bg-coral-500/[0.09]" : ""
                }`}
              >
                <span className="w-11 shrink-0 select-none border-r border-ink-800 px-1.5 text-right text-[10.5px] text-ink-500">
                  {op.oldLine ?? ""}
                </span>
                <span className="w-11 shrink-0 select-none border-r border-ink-800 px-1.5 text-right text-[10.5px] text-ink-500">
                  {op.newLine ?? ""}
                </span>
                <span
                  className={`w-6 shrink-0 select-none pl-2 font-bold ${
                    isAdd ? "text-mint-400" : isDel ? "text-coral-400" : "text-ink-600"
                  }`}
                >
                  {isAdd ? "+" : isDel ? "−" : ""}
                </span>
                <span
                  className={`whitespace-pre pr-4 ${
                    isAdd ? "text-mint-300" : isDel ? "text-coral-300 line-through decoration-coral-500/40" : "text-ink-300"
                  }`}
                >
                  {op.text || " "}
                </span>
              </div>
            );
          })}
          {diff.truncated && (
            <p className="px-4 py-3 font-mono text-[11px] text-ink-400">
              ⚠ Dosya çok uzun — ilk 1000 satır karşılaştırıldı.
            </p>
          )}
        </div>

        {/* alt bilgi */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 bg-ink-850 px-4 py-3">
          <p className="font-mono text-[10.5px] text-ink-400">
            Silinen satırlar <span className="text-coral-400">üstü çizili</span>, eklenenler{" "}
            <span className="text-mint-400">yeşil</span> — geri almak için Ctrl+Z.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-ink-600 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-200 transition-all hover:-translate-y-px hover:border-ink-400 active:translate-y-0"
            >
              kapat
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-md bg-mint-500 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-950 shadow-[0_6px_24px_-8px_rgba(67,207,135,0.7)] transition-all hover:-translate-y-px hover:bg-mint-400 active:translate-y-0"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 3v12M7 10l5 5 5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              sonucu indir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
