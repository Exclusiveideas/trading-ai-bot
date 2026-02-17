"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PairSelectorProps = {
  pairs: string[];
  selected: string;
  onSelect: (pair: string) => void;
};

export function PairSelector({ pairs, selected, onSelect }: PairSelectorProps) {
  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="w-[130px] h-8 text-sm font-mono">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pairs.map((pair) => (
          <SelectItem key={pair} value={pair} className="font-mono">
            {pair}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
