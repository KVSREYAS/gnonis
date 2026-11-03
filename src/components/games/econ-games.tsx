"use client";

import { useMemo, useRef, useState } from "react";
import { Chart } from "@/components/viz";
import type { GameConfig, GameId } from "@/lib/games/configs";
import {
  afterTrade,
  arcElasticity,
  cbLoss,
  cbStep,
  CB_START,
  classifyElasticity,
  commonsBotCatch,
  commonsSeason,
  compound,
  equilibrium,
  lemonadeDay,
  lemonsDraw,
  marketGap,
  meets,
  monopolyAt,
  monopolyPrice,
  opportunityCost,
  produce,
  qDemand,
  qSupply,
  weatherFor,
  type Economy,
  type Weather,
} from "@/lib/games/economics";
import { mulberry32 } from "@/lib/games/rng";
import { Btn, fmt, Log, Note, NumSlider, rupees, Stat, Stats, type GameProps } from "./ui";

type P<G extends GameId> = GameProps<GameConfig<G>>;

/* ---------- Supply and demand: find the market price ---------- */
function Market({ cfg, locked, onDone }: P<"market">) {
  const [i, setI] = useState(0);
  const [price, setPrice] = useState(Math.round(cfg.maxPrice / 2));
  const [tries, setTries] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const r = cfg.rounds[i];
  const m = marketGap(r.demand, r.supply, price, r.tax);
  const pts = (f: (p: number) => number) => Array.from({ length: 41 }, (_, k) => (k / 40) * cfg.maxPrice).map((p) => [f(p), p] as [number, number]);
  const set = () => {
    const t = tries + 1;
    setTries(t);
    if (m.label !== "balanced") {
      setLog([...log, `₹${price}: ${m.label} of ${fmt(Math.abs(m.gap))} units. ${m.label === "shortage" ? "Buyers want more than sellers offer, so the price gets pushed up." : "Unsold stock piles up, so the price gets pushed down."}`]);
      return;
    }
    const eq = equilibrium(r.demand, r.supply, r.tax);
    const line = `${r.label}: cleared at ₹${price} (exact ₹${fmt(eq.price, 1)}), ${fmt(eq.qty)} units trade.`;
    if (i + 1 >= cfg.rounds.length) {
      setLog([...log, line]);
      onDone({ won: true, summary: `All ${cfg.rounds.length} markets cleared in ${t} price tries.` });
      return;
    }
    setLog([...log, line]);
    setI(i + 1);
  };
  return (
    <div>
      <p className="font-bold">
        Market {i + 1}/{cfg.rounds.length}: {r.label}
      </p>
      <NumSlider label="Price" value={price} min={0} max={cfg.maxPrice} step={0.5} unit="₹" onChange={setPrice} disabled={locked} testId="market-price" />
      <Stats>
        <Stat label="Buyers want" value={fmt(m.qd)} />
        <Stat label="Sellers offer" value={fmt(m.qs)} />
        <Stat label="Result" value={m.label} tone={m.label === "balanced" ? "good" : "bad"} />
        <Stat label="Tries" value={tries} />
      </Stats>
      <Chart
        spec={{
          kind: "line",
          title: "Supply and demand",
          xLabel: "quantity",
          yLabel: "price ₹",
          series: [
            { label: "demand", tone: "gold", points: pts((p) => qDemand(r.demand, p)) },
            { label: r.tax ? "supply after tax" : "supply", tone: "green", points: pts((p) => qSupply(r.supply, p, r.tax)) },
          ],
          marker: { x: Math.min(m.qd, m.qs), y: price, label: `₹${price}` },
        }}
      />
      <Btn onClick={set} disabled={locked} testId="market-set">Set price ₹{price}</Btn>
      <Log lines={log} />
    </div>
  );
}

/* ---------- Lemonade stand ---------- */
const WEATHER_ICON: Record<Weather, string> = { rainy: "🌧 rainy", cloudy: "☁️ cloudy", sunny: "☀️ sunny", heatwave: "🔥 heatwave" };
function Lemonade({ cfg, locked, onDone }: P<"lemonade">) {
  const days = useMemo(() => {
    const r = mulberry32(cfg.seed);
    return Array.from({ length: cfg.days }, () => weatherFor(r));
  }, [cfg.days, cfg.seed]);
  const [day, setDay] = useState(0);
  const [price, setPrice] = useState(Math.round(cfg.maxPrice / 3));
  const [cups, setCups] = useState(50);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const open = () => {
    const d = lemonadeDay({ weather: days[day], price, cups, costPerCup: cfg.costPerCup, maxPrice: cfg.maxPrice });
    const t = total + d.profit;
    setTotal(t);
    setLog([...log, `Day ${day + 1} (${days[day]}): ${d.demand} wanted a cup, sold ${d.sold}, wasted ${d.wasted}, turned away ${d.missed}. Profit ${rupees(d.profit)}.`]);
    if (day + 1 >= cfg.days) onDone({ won: t >= cfg.target, summary: `Week profit ${rupees(t)} (target ${rupees(cfg.target)}).` });
    setDay(day + 1);
  };
  return (
    <div>
      <Note>
        Each cup costs {rupees(cfg.costPerCup)} to make, sold or not. Nobody pays {rupees(cfg.maxPrice)} or more. Hotter days bring more customers.
      </Note>
      <Stats>
        <Stat label="Day" value={`${Math.min(day + 1, cfg.days)}/${cfg.days}`} />
        <Stat label="Forecast" value={day < cfg.days ? WEATHER_ICON[days[day]] : "-"} />
        <Stat label="Profit" value={rupees(total)} tone={total >= cfg.target ? "good" : total < 0 ? "bad" : undefined} />
        <Stat label="Target" value={rupees(cfg.target)} />
      </Stats>
      {day < cfg.days && (
        <>
          <NumSlider label="Price per cup" value={price} min={1} max={cfg.maxPrice} unit="₹" onChange={setPrice} disabled={locked} testId="lemon-price" />
          <NumSlider label="Cups to make" value={cups} min={0} max={200} step={5} onChange={setCups} disabled={locked} testId="lemon-cups" />
          <Btn onClick={open} disabled={locked} testId="lemon-open">Open the stand</Btn>
        </>
      )}
      <Log lines={log} />
    </div>
  );
}

/* ---------- Elastic or inelastic ---------- */
function Elasticity({ cfg, locked, onDone }: P<"elasticity">) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [shown, setShown] = useState<string | null>(null);
  const it = cfg.items[i];
  const e = arcElasticity(it.p0, it.p1, it.q0, it.q1);
  const kind = classifyElasticity(e);
  const guess = (g: "elastic" | "inelastic") => {
    const ok = g === kind || kind === "unit";
    if (ok) setScore(score + 1);
    setShown(`${ok ? "Right" : "Wrong"}: elasticity ${fmt(e, 2)}, so demand is ${kind === "unit" ? "unit elastic" : kind}. ${it.note}`);
  };
  const next = () => {
    if (i + 1 >= cfg.items.length) {
      onDone({ won: score >= cfg.target, summary: `${score}/${cfg.items.length} right (target ${cfg.target}).` });
      return;
    }
    setI(i + 1);
    setShown(null);
  };
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Card {i + 1}/{cfg.items.length} · score {score}
      </p>
      <div className="my-3 rounded-xl border-2 border-gold/60 bg-ink p-4">
        <p className="text-xl font-bold">{it.good}</p>
        <p className="mt-1 font-mono">
          Price ₹{fmt(it.p0)} → ₹{fmt(it.p1)} · Quantity {fmt(it.q0)} → {fmt(it.q1)}
        </p>
      </div>
      {!shown ? (
        <div className="flex gap-2">
          <Btn onClick={() => guess("elastic")} disabled={locked} testId="el-elastic">Elastic (&gt; 1)</Btn>
          <Btn onClick={() => guess("inelastic")} disabled={locked} testId="el-inelastic">Inelastic (&lt; 1)</Btn>
        </div>
      ) : (
        <>
          <Note tone={shown.startsWith("Right") ? "good" : "bad"}>{shown}</Note>
          <Btn onClick={next} disabled={locked} testId="el-next">{i + 1 >= cfg.items.length ? "Finish" : "Next card"}</Btn>
        </>
      )}
    </div>
  );
}

/* ---------- Compounding and inflation ---------- */
function Compound({ cfg, locked, onDone }: P<"compound">) {
  const [v, setV] = useState({ start: cfg.start, monthly: cfg.monthly, rate: cfg.rate, inflation: cfg.inflation, years: cfg.years });
  const pts = useMemo(() => compound(v), [v]);
  const end = pts[pts.length - 1];
  const ok = end.real >= cfg.goalReal;
  const lock = new Set(cfg.locked);
  const slider = (k: keyof typeof v, label: string, min: number, max: number, step: number, unit: string) =>
    !lock.has(k) && <NumSlider key={k} label={label} value={v[k]} min={min} max={max} step={step} unit={unit} onChange={(x) => setV({ ...v, [k]: x })} disabled={locked} testId={`cmp-${k}`} />;
  return (
    <div>
      <Note tone={ok ? "good" : undefined}>
        Goal: {rupees(cfg.goalReal)} in today&apos;s money. Now: {rupees(end.real)} real ({rupees(end.nominal)} on paper, {rupees(end.paidIn)} paid in).
      </Note>
      {slider("start", "Starting amount", 0, 1000000, 10000, "₹")}
      {slider("monthly", "Monthly deposit", 0, 50000, 500, "₹")}
      {slider("rate", "Yearly return", 0, 15, 0.5, "%")}
      {slider("inflation", "Inflation", 0, 12, 0.5, "%")}
      {slider("years", "Years", 1, 40, 1, "yrs")}
      <Chart
        spec={{
          kind: "line",
          title: "Your money",
          xLabel: "year",
          yLabel: "₹",
          series: [
            { label: "on paper", tone: "gold", points: pts.map((p) => [p.year, p.nominal]) },
            { label: "in today's money", tone: "green", points: pts.map((p) => [p.year, p.real]) },
            { label: "paid in", tone: "muted", points: pts.map((p) => [p.year, p.paidIn]) },
          ],
        }}
      />
      <Btn onClick={() => onDone({ won: ok, summary: `${rupees(end.real)} in today's money after ${v.years} years (goal ${rupees(cfg.goalReal)}).` })} disabled={locked} testId="cmp-lock">
        Lock in this plan
      </Btn>
    </div>
  );
}

/* ---------- Central bank ---------- */
function CentralBank({ cfg, locked, onDone }: P<"central-bank">) {
  const [rate, setRate] = useState(3);
  const [hist, setHist] = useState<Economy[]>([CB_START]);
  const [log, setLog] = useState<string[]>([]);
  const q = hist.length;
  const now = hist[hist.length - 1];
  const upcoming = cfg.shocks.find((s) => s.quarter === q);
  const step = () => {
    const shock = cfg.shocks.find((s) => s.quarter === q);
    const next = cbStep(now, rate, shock ?? {});
    const h = [...hist, next];
    setHist(h);
    setLog([...log, `Q${q}: rate ${rate}% → inflation ${fmt(next.inflation, 1)}%, unemployment ${fmt(next.unemployment, 1)}%.${shock ? ` (${shock.news})` : ""}`]);
    if (q >= cfg.quarters) {
      const avg = h.slice(1).reduce((s, e) => s + cbLoss(e), 0) / cfg.quarters;
      onDone({ won: avg <= cfg.maxAvgLoss, summary: `Average miss score ${fmt(avg, 2)} (pass at ${cfg.maxAvgLoss} or less). The score adds up how far inflation was from 2% and unemployment from 5%.` });
    }
  };
  return (
    <div>
      <Note>Keep inflation near 2% and unemployment near 5%. Rates work with a lag, and expectations follow what inflation actually does.</Note>
      <Stats>
        <Stat label="Quarter" value={`${Math.min(q, cfg.quarters)}/${cfg.quarters}`} />
        <Stat label="Inflation" value={`${fmt(now.inflation, 1)}%`} tone={Math.abs(now.inflation - 2) < 1 ? "good" : "bad"} />
        <Stat label="Unemployment" value={`${fmt(now.unemployment, 1)}%`} tone={Math.abs(now.unemployment - 5) < 1 ? "good" : "bad"} />
        <Stat label="Expected infl." value={`${fmt(now.expected, 1)}%`} />
      </Stats>
      {upcoming && q <= cfg.quarters && <Note tone="bad">News this quarter: {upcoming.news}</Note>}
      {q <= cfg.quarters && (
        <>
          <NumSlider label="Policy interest rate" value={rate} min={0} max={15} step={0.25} unit="%" onChange={setRate} disabled={locked} testId="cb-rate" />
          <Btn onClick={step} disabled={locked} testId="cb-set">Announce {rate}%</Btn>
        </>
      )}
      <Chart
        spec={{
          kind: "line",
          title: "Your economy",
          xLabel: "quarter",
          yLabel: "%",
          series: [
            { label: "inflation", tone: "red", points: hist.map((e, i) => [i, e.inflation]) },
            { label: "unemployment", tone: "gold", points: hist.map((e, i) => [i, e.unemployment]) },
          ],
        }}
      />
      <Log lines={log} />
    </div>
  );
}

/* ---------- Tragedy of the commons ---------- */
function Commons({ cfg, seed, locked, onDone }: P<"commons">) {
  const rand = useRef(mulberry32(seed));
  const [stock, setStock] = useState(cfg.capacity * 0.6);
  const [season, setSeason] = useState(0);
  const [mine, setMine] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [catchNow, setCatchNow] = useState(Math.round((cfg.growth * cfg.capacity) / 4 / (cfg.bots + 1)));
  const [log, setLog] = useState<string[]>([]);
  const fish = () => {
    const bots = Array.from({ length: cfg.bots }, () => commonsBotCatch(stock, cfg.bots + 1, cfg.growth, cfg.capacity, last, cfg.greed) * (0.9 + 0.2 * rand.current()));
    const res = commonsSeason(stock, [catchNow, ...bots], cfg.growth, cfg.capacity);
    const m = mine + res.caught[0];
    setMine(m);
    setLast(catchNow);
    setStock(res.next);
    setLog([...log, `Season ${season + 1}: you caught ${fmt(res.caught[0])}, the others ${fmt(res.caught.slice(1).reduce((s, x) => s + x, 0))}. Fish left after regrowth: ${fmt(res.next)}.`]);
    const s = season + 1;
    setSeason(s);
    if (s >= cfg.seasons || res.next <= 0) {
      const won = res.next >= cfg.minStock && m >= cfg.target;
      onDone({ won, summary: res.next <= 0 ? `The lake is empty after season ${s}. Everyone's income is now zero.` : `You caught ${fmt(m)} fish (target ${fmt(cfg.target)}) and left ${fmt(res.next)} in the lake (need ${fmt(cfg.minStock)}).` });
    }
  };
  return (
    <div>
      <Note>
        You and {cfg.bots} other boats share one lake. Fish regrow fastest when the lake is about half full. The other boats copy greed they see. Catch {fmt(cfg.target)} fish in {cfg.seasons} seasons and leave at least {fmt(cfg.minStock)}.
      </Note>
      <Stats>
        <Stat label="Season" value={`${Math.min(season + 1, cfg.seasons)}/${cfg.seasons}`} />
        <Stat label="Fish in lake" value={fmt(stock)} tone={stock < cfg.capacity * 0.3 ? "bad" : "good"} />
        <Stat label="Your catch" value={fmt(mine)} tone={mine >= cfg.target ? "good" : undefined} />
        <Stat label="Target" value={fmt(cfg.target)} />
      </Stats>
      {season < cfg.seasons && stock > 0 && (
        <>
          <NumSlider label="Your catch this season" value={catchNow} min={0} max={cfg.maxCatch} onChange={setCatchNow} disabled={locked} testId="commons-catch" />
          <Btn onClick={fish} disabled={locked} testId="commons-fish">Go fishing</Btn>
        </>
      )}
      <Log lines={log} />
    </div>
  );
}

/* ---------- Comparative advantage ---------- */
function ComparativeAdvantage({ cfg, locked, onDone }: P<"comparative-advantage">) {
  const [ha, setHa] = useState(cfg.a.hours / 2);
  const [hb, setHb] = useState(cfg.b.hours / 2);
  const [give, setGive] = useState(0);
  const [price, setPrice] = useState(1);
  const pa = produce(cfg.a, ha);
  const pb = produce(cfg.b, hb);
  const t = afterTrade(pa, pb, give, price);
  const okA = meets(t.a, cfg.needA);
  const okB = meets(t.b, cfg.needB);
  const [g0, g1] = cfg.goods;
  const maxGive = Math.max(cfg.a.hours * cfg.a.perHour[0], cfg.b.hours * cfg.b.perHour[0]);
  return (
    <div>
      <Note>
        {cfg.a.name} needs {cfg.needA[0]} {g0} and {cfg.needA[1]} {g1}. {cfg.b.name} needs {cfg.needB[0]} {g0} and {cfg.needB[1]} {g1}. Split each one&apos;s hours, then trade.
      </Note>
      <Stats>
        <Stat label={`${cfg.a.name} per hour`} value={`${cfg.a.perHour[0]} ${g0} or ${cfg.a.perHour[1]} ${g1}`} />
        <Stat label={`${cfg.a.name}: cost of 1 ${g0}`} value={`${fmt(opportunityCost(cfg.a), 2)} ${g1}`} />
        <Stat label={`${cfg.b.name} per hour`} value={`${cfg.b.perHour[0]} ${g0} or ${cfg.b.perHour[1]} ${g1}`} />
        <Stat label={`${cfg.b.name}: cost of 1 ${g0}`} value={`${fmt(opportunityCost(cfg.b), 2)} ${g1}`} />
      </Stats>
      <NumSlider label={`${cfg.a.name}: hours on ${g0}`} value={ha} min={0} max={cfg.a.hours} onChange={setHa} disabled={locked} testId="ca-ha" />
      <NumSlider label={`${cfg.b.name}: hours on ${g0}`} value={hb} min={0} max={cfg.b.hours} onChange={setHb} disabled={locked} testId="ca-hb" />
      <NumSlider label={`${g0} that ${cfg.a.name} sends to ${cfg.b.name} (negative = receives)`} value={give} min={-maxGive} max={maxGive} onChange={setGive} disabled={locked} testId="ca-give" />
      <NumSlider label={`${g1} paid per ${g0}`} value={price} min={0.25} max={4} step={0.25} onChange={setPrice} disabled={locked} testId="ca-price" />
      <Stats>
        <Stat label={`${cfg.a.name} makes`} value={`${fmt(pa[0])} ${g0}, ${fmt(pa[1])} ${g1}`} />
        <Stat label={`${cfg.a.name} ends with`} value={`${fmt(t.a[0], 1)} ${g0}, ${fmt(t.a[1], 1)} ${g1}`} tone={okA ? "good" : "bad"} />
        <Stat label={`${cfg.b.name} makes`} value={`${fmt(pb[0])} ${g0}, ${fmt(pb[1])} ${g1}`} />
        <Stat label={`${cfg.b.name} ends with`} value={`${fmt(t.b[0], 1)} ${g0}, ${fmt(t.b[1], 1)} ${g1}`} tone={okB ? "good" : "bad"} />
      </Stats>
      <Btn onClick={() => onDone({ won: okA && okB, summary: okA && okB ? "Both needs met. Specialise in the lower opportunity cost, then trade at a price between the two costs." : "Someone is still short." })} disabled={locked} testId="ca-lock">
        Lock in the deal
      </Btn>
    </div>
  );
}

/* ---------- Monopoly pricing ---------- */
function Monopoly({ cfg, locked, onDone }: P<"monopoly">) {
  const [price, setPrice] = useState(Math.round(cfg.c + (cfg.a - cfg.c) * 0.2));
  const now = monopolyAt(cfg.a, cfg.b, cfg.c, price);
  const best = monopolyPrice(cfg.a, cfg.c);
  const curve = Array.from({ length: 41 }, (_, k) => cfg.c + ((cfg.a - cfg.c) * k) / 40).map((p) => [p, monopolyAt(cfg.a, cfg.b, cfg.c, p).profit] as [number, number]);
  const ok = Math.abs(price - best) / best <= cfg.tolerance;
  return (
    <div>
      <Note>You are the only seller. Each unit costs {rupees(cfg.c)} to make. Find the price that makes the most profit. The profit curve hides until you lock in.</Note>
      <NumSlider label="Your price" value={price} min={cfg.c} max={cfg.a} step={(cfg.a - cfg.c) / 200 >= 1 ? 1 : 0.5} unit="₹" onChange={setPrice} disabled={locked} testId="mono-price" />
      <Stats>
        <Stat label="Units sold" value={fmt(now.q)} />
        <Stat label="Profit" value={rupees(now.profit)} tone="good" />
        <Stat label="Buyers' surplus" value={rupees(now.cs)} />
        <Stat label="Lost trades (DWL)" value={rupees(now.dwl)} tone="bad" />
      </Stats>
      {locked && <Chart spec={{ kind: "line", title: "Profit at each price", xLabel: "price ₹", yLabel: "profit ₹", series: [{ label: "profit", tone: "gold", points: curve }], marker: { x: price, y: now.profit, label: "you" } }} />}
      <Btn onClick={() => onDone({ won: ok, summary: `You chose ${rupees(price)}. The profit-maximising price is ${rupees(best)}, where marginal revenue equals marginal cost.` })} disabled={locked} testId="mono-lock">
        Lock in {rupees(price)}
      </Btn>
    </div>
  );
}

/* ---------- Market for lemons ---------- */
function Lemons({ cfg, seed, locked, onDone }: P<"lemons">) {
  const rand = useRef(mulberry32(seed));
  const [round, setRound] = useState(0);
  const [offer, setOffer] = useState(50);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const done = (t: number, lines: string[]) => {
    setLog(lines);
    if (round + 1 >= cfg.rounds) onDone({ won: t >= cfg.target, summary: `Total gain ${rupees(t * 1000)} (target ${rupees(cfg.target * 1000)}).` });
    setRound(round + 1);
  };
  const blind = () => {
    const q = lemonsDraw(offer, rand.current);
    if (q === null) return done(total, [...log, `Round ${round + 1}: nobody sells at ₹${offer}k.`]);
    const gain = cfg.bonus * q - offer;
    setTotal(total + gain);
    done(total + gain, [...log, `Round ${round + 1}: paid ₹${offer}k, car worth ₹${fmt(cfg.bonus * q)}k to you (seller valued it ₹${q}k). ${gain >= 0 ? "+" : ""}${fmt(gain)}k.`]);
  };
  const inspect = () => {
    const q = Math.round(rand.current() * 100);
    const price = Math.round(q * 1.1);
    const gain = cfg.bonus * q - price - (cfg.inspectCost ?? 0);
    setTotal(total + gain);
    done(total + gain, [...log, `Round ${round + 1}: inspection showed quality ₹${q}k, you paid ₹${price}k plus ₹${cfg.inspectCost}k inspection. ${gain >= 0 ? "+" : ""}${fmt(gain)}k.`]);
  };
  return (
    <div>
      <Note>
        Used cars are worth 0 to 100 (₹ thousands) to their owners and {cfg.bonus}x that to you. Only owners know the quality. An owner sells only if your offer is at least what the car is worth to them.
      </Note>
      <Stats>
        <Stat label="Round" value={`${Math.min(round + 1, cfg.rounds)}/${cfg.rounds}`} />
        <Stat label="Total" value={`₹${fmt(total)}k`} tone={total >= cfg.target ? "good" : total < 0 ? "bad" : undefined} />
        <Stat label="Target" value={`₹${cfg.target}k`} />
        <Stat label="Avg car at your offer" value={`₹${fmt(Math.min(offer, 100) / 2)}k`} />
      </Stats>
      {round < cfg.rounds && (
        <>
          <NumSlider label="Blind offer" value={offer} min={0} max={100} unit="₹k" onChange={setOffer} disabled={locked} testId="lemons-offer" />
          <div className="flex flex-wrap gap-2">
            <Btn onClick={blind} disabled={locked} testId="lemons-buy">Offer ₹{offer}k</Btn>
            {cfg.inspectCost !== undefined && (
              <Btn onClick={inspect} disabled={locked} testId="lemons-inspect" tone="green">
                Pay ₹{cfg.inspectCost}k for an inspection
              </Btn>
            )}
          </div>
        </>
      )}
      <Log lines={log} />
    </div>
  );
}

export const ECON_GAMES = {
  market: Market,
  lemonade: Lemonade,
  elasticity: Elasticity,
  compound: Compound,
  "central-bank": CentralBank,
  commons: Commons,
  "comparative-advantage": ComparativeAdvantage,
  monopoly: Monopoly,
  lemons: Lemons,
};
