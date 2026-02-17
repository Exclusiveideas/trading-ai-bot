"use client";

type PairSelectorProps = {
  pairs: string[];
  selected: string;
  onSelect: (pair: string) => void;
};

export function PairSelector({ pairs, selected, onSelect }: PairSelectorProps) {
  return (
    <select
      value={selected}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
    >
      {pairs.map((pair) => (
        <option key={pair} value={pair}>
          {pair}
        </option>
      ))}
    </select>
  );
}
