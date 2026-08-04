import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface SlipItem {
  id: string;
  matchId: string;
  fixture: string;
  market: string;
  label: string;
  probability: number;
  fairOdds: number;
}

interface SlipContext {
  items: SlipItem[];
  toggle: (item: SlipItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  combinedProbability: number;
  combinedOdds: number;
}

const Ctx = createContext<SlipContext | null>(null);
const STORAGE_KEY = "pitchiq.slip.v1";

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SlipItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as SlipItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const toggle = useCallback((item: SlipItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev.filter((i) => i.id !== item.id);
      // one selection per match+market
      const cleaned = prev.filter((i) => !(i.matchId === item.matchId && i.market === item.market));
      return [...cleaned, item];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<SlipContext>(() => {
    const combinedProbability = items.reduce((a, i) => a * i.probability, 1);
    return {
      items,
      toggle,
      remove,
      clear,
      has: (id: string) => items.some((i) => i.id === id),
      combinedProbability: items.length ? combinedProbability : 0,
      combinedOdds: items.length ? items.reduce((a, i) => a * i.fairOdds, 1) : 0,
    };
  }, [items, toggle, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBetSlip() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBetSlip must be used inside BetSlipProvider");
  return ctx;
}
