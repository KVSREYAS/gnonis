import { clamp } from "./rng";

/* ---------------- Supply and demand ---------------- */

/** Linear demand Qd = a - b*P and supply Qs = c + d*P (both floored at 0). */
export type Linear = { a: number; b: number };
export const qDemand = (dem: Linear, p: number) => Math.max(0, dem.a - dem.b * p);
/** tax is a per-unit tax paid by sellers, so they supply as if the price were p - tax. */
export const qSupply = (sup: Linear, p: number, tax = 0) => Math.max(0, sup.a + sup.b * (p - tax));

export function equilibrium(dem: Linear, sup: Linear, tax = 0): { price: number; qty: number } {
  // a - bP = c + d(P - t)  =>  P = (a - c + d t) / (b + d)
  const price = (dem.a - sup.a + sup.b * tax) / (dem.b + sup.b);
  return { price, qty: qDemand(dem, price) };
}

export function marketGap(dem: Linear, sup: Linear, p: number, tax = 0): { qd: number; qs: number; gap: number; label: "shortage" | "surplus" | "balanced" } {
  const qd = qDemand(dem, p);
  const qs = qSupply(sup, p, tax);
  const gap = qd - qs;
  const tol = Math.max(1, 0.03 * Math.max(qd, qs));
  return { qd, qs, gap, label: Math.abs(gap) <= tol ? "balanced" : gap > 0 ? "shortage" : "surplus" };
}

/* ---------------- Lemonade stand ---------------- */

export type Weather = "rainy" | "cloudy" | "sunny" | "heatwave";
export const WEATHER_CUSTOMERS: Record<Weather, number> = { rainy: 30, cloudy: 60, sunny: 100, heatwave: 150 };

export function weatherFor(rand: () => number): Weather {
  const u = rand();
  return u < 0.2 ? "rainy" : u < 0.5 ? "cloudy" : u < 0.85 ? "sunny" : "heatwave";
}

/** Customers who want a cup at price p (rupees). Demand falls linearly to zero at maxPrice. */
export function lemonadeDemand(weather: Weather, price: number, maxPrice: number): number {
  return Math.round(WEATHER_CUSTOMERS[weather] * clamp(1 - price / maxPrice, 0, 1));
}

export function lemonadeDay(opts: { weather: Weather; price: number; cups: number; costPerCup: number; maxPrice: number }) {
  const demand = lemonadeDemand(opts.weather, opts.price, opts.maxPrice);
  const sold = Math.min(opts.cups, demand);
  const revenue = sold * opts.price;
  const cost = opts.cups * opts.costPerCup;
  return { demand, sold, wasted: opts.cups - sold, missed: demand - sold, revenue, cost, profit: revenue - cost };
}

/** Best price for a known weather when cups are made exactly to demand: maximise (p - c) * N(1 - p/M). */
export const lemonadeBestPrice = (costPerCup: number, maxPrice: number) => (costPerCup + maxPrice) / 2;

/* ---------------- Elasticity ---------------- */

/** Midpoint (arc) price elasticity of demand. Returned as a positive number. */
export function arcElasticity(p0: number, p1: number, q0: number, q1: number): number {
  const dq = (q1 - q0) / ((q0 + q1) / 2);
  const dp = (p1 - p0) / ((p0 + p1) / 2);
  return Math.abs(dq / dp);
}
export const classifyElasticity = (e: number): "elastic" | "inelastic" | "unit" => (Math.abs(e - 1) < 0.05 ? "unit" : e > 1 ? "elastic" : "inelastic");

/* ---------------- Compounding and inflation ---------------- */

export function compound(opts: { start: number; monthly: number; rate: number; inflation: number; years: number }) {
  const r = opts.rate / 100 / 12;
  const pts: { year: number; nominal: number; real: number; paidIn: number }[] = [];
  let bal = opts.start;
  let paid = opts.start;
  pts.push({ year: 0, nominal: bal, real: bal, paidIn: paid });
  for (let m = 1; m <= opts.years * 12; m++) {
    bal = bal * (1 + r) + opts.monthly;
    paid += opts.monthly;
    if (m % 12 === 0) {
      const y = m / 12;
      pts.push({ year: y, nominal: bal, real: bal / (1 + opts.inflation / 100) ** y, paidIn: paid });
    }
  }
  return pts;
}

/** Rule of 72: years to double at r percent. */
export const ruleOf72 = (rate: number) => 72 / rate;

/* ---------------- Central bank ---------------- */

export type Economy = { inflation: number; unemployment: number; expected: number; gap: number };
export const CB_START: Economy = { inflation: 2, unemployment: 5, expected: 2, gap: 0 };
export const NEUTRAL_REAL_RATE = 1;
export const NATURAL_UNEMPLOYMENT = 5;

/**
 * One quarter. Higher real rates (rate minus expected inflation) shrink the output gap. A positive
 * gap pushes inflation up and unemployment down. Expectations adapt toward actual inflation.
 */
export function cbStep(s: Economy, rate: number, shock: { demand?: number; supply?: number } = {}): Economy {
  const real = rate - s.expected;
  const gap = clamp(0.6 * s.gap - 0.5 * (real - NEUTRAL_REAL_RATE) + (shock.demand ?? 0), -6, 6);
  const inflation = clamp(s.expected + 0.4 * gap + (shock.supply ?? 0), -3, 20);
  const unemployment = clamp(NATURAL_UNEMPLOYMENT - 0.5 * gap, 2, 15);
  const expected = 0.5 * s.expected + 0.5 * inflation;
  return { inflation, unemployment, expected, gap };
}

/** Quarterly score: 0 is perfect, bigger is worse. */
export const cbLoss = (s: Economy) => (s.inflation - 2) ** 2 + 0.5 * (s.unemployment - NATURAL_UNEMPLOYMENT) ** 2;

/* ---------------- Tragedy of the commons ---------------- */

/** Logistic regrowth after catches. */
export function commonsRegrow(stock: number, growth: number, capacity: number): number {
  return Math.min(capacity, stock + growth * stock * (1 - stock / capacity));
}

/** Catches are cut pro rata if they exceed the stock. Returns actual catches and the new stock after regrowth. */
export function commonsSeason(stock: number, wanted: number[], growth: number, capacity: number) {
  const total = wanted.reduce((s, x) => s + x, 0);
  const scale = total > stock ? stock / total : 1;
  const caught = wanted.map((w) => w * scale);
  const left = stock - caught.reduce((s, x) => s + x, 0);
  return { caught, left, next: left < 1 ? 0 : commonsRegrow(left, growth, capacity) };
}

/** Bots: each wants a "fair" share of the sustainable yield, plus they copy part of any overfishing they saw from you. */
export function commonsBotCatch(stock: number, players: number, growth: number, capacity: number, yourLast: number | null, greed: number): number {
  const msy = (growth * capacity) / 4;
  const fair = msy / players;
  const extra = yourLast === null ? 0 : Math.max(0, yourLast - fair) * 0.8;
  return Math.max(0, Math.min(stock / players, fair * (1 + greed) + extra));
}

/* ---------------- Comparative advantage ---------------- */

export type Producer = { name: string; hours: number; perHour: [number, number] };

export function produce(p: Producer, hoursOnFirst: number): [number, number] {
  const h = clamp(hoursOnFirst, 0, p.hours);
  return [h * p.perHour[0], (p.hours - h) * p.perHour[1]];
}

/** Opportunity cost of one unit of good 0, measured in good 1. */
export const opportunityCost = (p: Producer) => p.perHour[1] / p.perHour[0];

/** A gives `give` of good 0 to B and gets `give * price` of good 1 back. */
export function afterTrade(a: [number, number], b: [number, number], give: number, price: number): { a: [number, number]; b: [number, number] } {
  return { a: [a[0] - give, a[1] + give * price], b: [b[0] + give, b[1] - give * price] };
}

export const meets = (have: [number, number], need: [number, number]) => have[0] >= need[0] - 1e-9 && have[1] >= need[1] - 1e-9;

/* ---------------- Monopoly ---------------- */

/** Inverse demand P = a - bQ, constant marginal cost c. */
export function monopolyAt(a: number, b: number, c: number, price: number) {
  const q = Math.max(0, (a - price) / b);
  const profit = (price - c) * q;
  const cs = 0.5 * (a - price) * q;
  const qComp = Math.max(0, (a - c) / b);
  const dwl = price > c ? 0.5 * (price - c) * (qComp - q) : 0;
  return { q, profit, cs, dwl };
}
export const monopolyPrice = (a: number, c: number) => (a + c) / 2;

/* ---------------- Market for lemons ---------------- */

/**
 * Car quality q is uniform on [0, 100]. A seller values a car at q and sells if the offer is at least q.
 * A buyer values it at bonus * q. Returns the average quality of the cars on offer at that price.
 */
export function lemonsAvgQuality(price: number): number {
  const top = clamp(price, 0, 100);
  return top / 2;
}
export function lemonsDraw(price: number, rand: () => number): number | null {
  const top = clamp(price, 0, 100);
  if (top <= 0) return null;
  return Math.round(rand() * top);
}
export const lemonsExpectedProfit = (price: number, bonus: number) => bonus * lemonsAvgQuality(price) - price;
