import { useEffect, useRef, type KeyboardEvent } from "react";

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  /** satır no (1) -> sorun rengi (hex) */
  problems: Record<number, string>;
  /** seçili bulgunun vurgulanacak satırları */
  highlight: Set<number>;
  highlightHex: string;
}

export default function Editor({ value, onChange, problems, highlight, highlightHex }: EditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);

  const lines = value.split("\n");
  const digits = Math.max(String(lines.length).length, 2);

  const sync = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (backRef.current) backRef.current.scrollTop = ta.scrollTop;
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop;
  };

  useEffect(() => {
    sync();
  }, [value]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
      onChange(ta.value);
    }
  };

  return (
    <div className="relative h-[420px] font-mono text-[12.5px] leading-6 md:h-[520px]">
      {/* satır numaraları */}
      <div
        ref={gutRef}
        className="absolute bottom-0 left-0 top-0 w-12 select-none overflow-hidden border-r border-ink-700/70 bg-ink-900/70"
        aria-hidden="true"
      >
        <div className="pb-8 pt-3">
          {lines.map((_, i) => {
            const n = i + 1;
            const hex = problems[n];
            const isHl = highlight.has(n);
            return (
              <div
                key={i}
                className="relative flex h-6 items-center justify-end pr-2.5 text-[10.5px] text-ink-500"
                style={
                  isHl
                    ? { background: `${highlightHex}22`, color: highlightHex }
                    : hex
                      ? { color: hex }
                      : undefined
                }
              >
                {hex && (
                  <span
                    className="absolute left-1.5 top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full"
                    style={{ background: hex, boxShadow: `0 0 6px ${hex}` }}
                  />
                )}
                {n}
              </div>
            );
          })}
        </div>
      </div>

      {/* vurgu arka katmanı */}
      <div
        ref={backRef}
        className="absolute bottom-0 left-12 right-0 top-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="w-max min-w-full pb-8 pl-4 pr-4 pt-3">
          {lines.map((_, i) => {
            const n = i + 1;
            if (!highlight.has(n)) return <div key={i} className="h-6" />;
            return (
              <div
                key={i}
                className="h-6 w-full rounded-[3px]"
                style={{
                  background: `${highlightHex}1f`,
                  boxShadow: `inset 2px 0 0 ${highlightHex}`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* yazma alanı */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={sync}
        onKeyDown={onKeyDown}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="// kodunu buraya yapıştır — analiz yazarken başlar"
        className="code-area absolute bottom-0 left-12 right-0 top-0 w-[calc(100%-3rem)] resize-none overflow-auto bg-transparent pb-8 pl-4 pr-4 pt-3 font-mono text-[12.5px] leading-6 text-ink-100 placeholder:text-ink-500"
      />
    </div>
  );
}
