"use client";

import { createContext, useContext, type ReactNode } from "react";
import { defaultMoney, type MoneyFmt } from "@/lib/money";

const MoneyContext = createContext<MoneyFmt>(defaultMoney);

export function MoneyProvider({ money, children }: { money: MoneyFmt; children: ReactNode }) {
  return <MoneyContext.Provider value={money}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  return useContext(MoneyContext);
}
