const LINES = [
  { text: "XI TEKNIK", outline: new Set([6, 7]) },
  { text: "PEMESINAN 2", outline: new Set([2, 3]) },
] as const;

export default function HeroShuffleTitle() {
  return (
    <h1 aria-label="XI Teknik Pemesinan 2" className="hero-title-font max-w-full text-center text-brand-50">
      {LINES.map((line, lineIndex) => (
        <span key={line.text} aria-hidden="true" className={`${lineIndex ? "mt-2 md:mt-3" : ""} block whitespace-nowrap`}>
          {Array.from(line.text).map((character, index) => character === " " ? (
            <span key={`${lineIndex}-${index}`} className="inline-block w-[0.28em]" />
          ) : (
            <span key={`${lineIndex}-${index}`} className={`inline-block align-baseline ${line.outline.has(index) ? "hero-title-outline" : ""}`}>{character}</span>
          ))}
        </span>
      ))}
    </h1>
  );
}
