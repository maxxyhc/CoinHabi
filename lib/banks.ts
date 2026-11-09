export type BankBrand = {
  id: string;
  /** Short text shown inside the badge (2–4 characters). */
  label: string;
  /** Approximate brand color used as the badge background. */
  color: string;
  /** Lower-cased substrings matched against the account name. */
  aliases: string[];
};

const banks: BankBrand[] = [
  { id: "taishin", label: "台新", color: "#d7282f", aliases: ["台新", "taishin", "richart"] },
  { id: "cathay", label: "國泰", color: "#006b54", aliases: ["國泰", "cathay", "cube"] },
  { id: "ctbc", label: "中信", color: "#006e51", aliases: ["中信", "中國信託", "ctbc"] },
  { id: "esun", label: "玉山", color: "#006241", aliases: ["玉山", "e.sun", "esun"] },
  { id: "fubon", label: "富邦", color: "#007d8a", aliases: ["富邦", "fubon"] },
  { id: "first", label: "一銀", color: "#00755a", aliases: ["第一銀", "一銀", "first bank", "firstbank"] },
  { id: "mega", label: "兆豐", color: "#005bac", aliases: ["兆豐", "mega"] },
  { id: "tcb", label: "合庫", color: "#00873e", aliases: ["合庫", "合作金庫", "taiwan cooperative"] },
  { id: "bot", label: "台銀", color: "#00437b", aliases: ["台灣銀行", "臺灣銀行", "台銀", "bank of taiwan"] },
  { id: "post", label: "郵局", color: "#007a5e", aliases: ["郵局", "郵政", "中華郵政", "post"] },
  { id: "sinopac", label: "永豐", color: "#00857d", aliases: ["永豐", "sinopac", "dawho"] },
  { id: "huanan", label: "華南", color: "#c8102e", aliases: ["華南", "hua nan"] },
  { id: "chb", label: "彰銀", color: "#c8443c", aliases: ["彰化", "彰銀", "chang hwa"] },
  { id: "yuanta", label: "元大", color: "#6f2c91", aliases: ["元大", "yuanta"] },
  { id: "kgi", label: "凱基", color: "#00365f", aliases: ["凱基", "kgi"] },
  { id: "taichung", label: "台中", color: "#0072bc", aliases: ["台中銀", "台中商銀", "taichung"] },
  { id: "scsb", label: "上海", color: "#00539b", aliases: ["上海商銀", "上海儲蓄", "scsb"] },
  { id: "union", label: "聯邦", color: "#0091d0", aliases: ["聯邦", "union bank"] },
  { id: "obank", label: "王道", color: "#f5a200", aliases: ["王道", "o-bank", "obank"] },
  { id: "rakuten", label: "樂天", color: "#bf0000", aliases: ["樂天", "rakuten"] },
  { id: "linebank", label: "LINE", color: "#06c755", aliases: ["line bank", "line銀行", "連線"] },
  { id: "nextbank", label: "將來", color: "#4e37d8", aliases: ["將來", "next bank", "nextbank"] },
  { id: "dbs", label: "DBS", color: "#e4002b", aliases: ["星展", "dbs"] },
  { id: "hsbc", label: "HSBC", color: "#db0011", aliases: ["匯豐", "hsbc"] },
  { id: "sc", label: "渣打", color: "#005eb8", aliases: ["渣打", "standard chartered"] },
  { id: "citi", label: "花旗", color: "#003b70", aliases: ["花旗", "citi"] },
  { id: "chase", label: "Chase", color: "#117aca", aliases: ["chase"] },
  { id: "bofa", label: "BofA", color: "#e31837", aliases: ["bank of america", "bofa"] },
  { id: "wells", label: "WF", color: "#d71e28", aliases: ["wells fargo"] },
];

export function detectBank(name: string): BankBrand | null {
  const normalized = name.toLowerCase();
  return banks.find((bank) => bank.aliases.some((alias) => normalized.includes(alias))) ?? null;
}
