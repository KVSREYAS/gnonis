"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Chart } from "@/components/viz";
import type { GameConfig, GameId } from "@/lib/games/configs";
import {
  botBid,
  botOffer,
  centipedeEnd,
  centipedePot,
  centipedeTake,
  contestRank,
  contestTarget,
  crowdGuesses,
  goalieDive,
  hawkDovePath,
  isLeaf,
  isStrictlyDominated,
  mixed2x2,
  montySwitchDoor,
  pdNextMove,
  pdPoints,
  pdTournament,
  PD_STRATEGIES,
  PD_STRATEGY_INFO,
  pureNash,
  resolveAuction,
  sameCells,
  simulateMonty,
  solveTree,
  type Move,
  type PdStrategy,
  type TreeNode,
} from "@/lib/games/game-theory";
import { mulberry32 } from "@/lib/games/rng";
import { cn } from "@/lib/utils";
import { PayoffMatrix } from "./matrix";
import { Btn, fmt, Log, Note, NumSlider, Stat, Stats, type GameProps } from "./ui";

type P<G extends GameId> = GameProps<GameConfig<G>>;
const useRand = (seed: number) => useRef(mulberry32(seed));

/* ---------- Prisoner's dilemma: one match ---------- */
function PdMatch({ cfg, seed, locked, onDone }: P<"pd-match">) {
  const rand = useRand(seed);
  const [you, setYou] = useState<Move[]>([]);
  const [bot, setBot] = useState<Move[]>([]);
  const yourScore = you.reduce((s, m, i) => s + pdPoints(m, bot[i]), 0);
  const botScore = bot.reduce((s, m, i) => s + pdPoints(m, you[i]), 0);
  const over = you.length >= cfg.rounds;
  const finish = (guessed: PdStrategy | null, y = yourScore) => {
    const guessOk = !cfg.guess || guessed === cfg.opponent;
    const won = y >= cfg.target && guessOk;
    const who = PD_STRATEGY_INFO[cfg.opponent].name;
    onDone({ won, summary: `You scored ${y} (target ${cfg.target}). The bot was ${who}.${cfg.guess ? (guessOk ? " Your guess was right." : " Your guess was wrong.") : ""}` });
  };
  const play = (m: Move) => {
    const b = pdNextMove(cfg.opponent, bot, you, rand.current);
    const ny = [...you, m];
    const nb = [...bot, b];
    setYou(ny);
    setBot(nb);
    if (ny.length >= cfg.rounds && !cfg.guess) finish(null, ny.reduce((s, x, i) => s + pdPoints(x, nb[i]), 0));
  };
  return (
    <div>
      <Note>
        Both cooperate: 3 each. Both defect: 1 each. Defect on a cooperator: you get 5, they get 0.
        {cfg.reveal && <> Your opponent: <strong>{PD_STRATEGY_INFO[cfg.opponent].name}</strong>. {PD_STRATEGY_INFO[cfg.opponent].rule}</>}
      </Note>
      <Stats>
        <Stat label="Round" value={`${Math.min(you.length + 1, cfg.rounds)}/${cfg.rounds}`} />
        <Stat label="You" value={yourScore} tone={yourScore >= cfg.target ? "good" : undefined} />
        <Stat label="Bot" value={botScore} />
        <Stat label="Target" value={cfg.target} />
      </Stats>
      <div className="my-3 flex flex-wrap gap-1 font-mono text-sm" aria-label="History">
        {you.map((m, i) => (
          <span key={i} className="rounded border border-border px-1.5 py-0.5">
            <span className={m === "C" ? "text-money-ink" : "text-danger"}>{m}</span>/<span className={bot[i] === "C" ? "text-money-ink" : "text-danger"}>{bot[i]}</span>
          </span>
        ))}
      </div>
      {!over && (
        <div className="flex gap-2">
          <Btn onClick={() => play("C")} disabled={locked} testId="pd-cooperate" tone="green">Cooperate</Btn>
          <Btn onClick={() => play("D")} disabled={locked} testId="pd-defect" tone="red">Defect</Btn>
        </div>
      )}
      {over && cfg.guess && !locked && (
        <div>
          <p className="mb-2 font-bold">Which strategy was the bot playing?</p>
          <div className="flex flex-wrap gap-2">
            {PD_STRATEGIES.filter((s) => s !== "random" && s !== "generous-tit-for-tat").map((s) => (
              <Btn key={s} onClick={() => finish(s)} testId={`guess-${s}`}>{PD_STRATEGY_INFO[s].name}</Btn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Prisoner's dilemma: tournament ---------- */
function PdTournament({ cfg, seed, locked, onDone }: P<"pd-tournament">) {
  const rand = useRand(seed);
  const [table, setTable] = useState<{ strategy: PdStrategy; index: number; total: number }[] | null>(null);
  const you = cfg.field.length;
  const enter = (s: PdStrategy) => {
    const t = pdTournament([...cfg.field, s], cfg.rounds, cfg.noise, rand.current);
    setTable(t);
    const rank = t.findIndex((r) => r.index === you) + 1;
    onDone({ won: rank <= cfg.topN, summary: `${PD_STRATEGY_INFO[s].name} finished #${rank} of ${t.length}${cfg.noise ? ` with ${Math.round(cfg.noise * 100)}% noise` : ""}.` });
  };
  return (
    <div>
      <Note>
        Field: {cfg.field.map((s) => PD_STRATEGY_INFO[s].name).join(", ")}. Everyone plays everyone for {cfg.rounds} rounds
        {cfg.noise ? `, and ${Math.round(cfg.noise * 100)}% of moves flip by mistake` : ""}. Finish in the top {cfg.topN} to win.
      </Note>
      {!table && (
        <div className="grid gap-2 sm:grid-cols-2">
          {cfg.choices.map((s) => (
            <Btn key={s} onClick={() => enter(s)} disabled={locked} testId={`enter-${s}`} className="text-left">
              <span className="block">{PD_STRATEGY_INFO[s].name}</span>
              <span className="block text-sm font-normal text-muted-foreground">{PD_STRATEGY_INFO[s].rule}</span>
            </Btn>
          ))}
        </div>
      )}
      {table && (
        <ol className="my-3 space-y-1">
          {table.map((r, i) => (
            <li key={r.index} className={cn("flex justify-between rounded border px-3 py-1.5", r.index === you ? "border-gold bg-gold/10" : "border-border")}>
              <span>#{i + 1} {PD_STRATEGY_INFO[r.strategy].name}{r.index === you ? " (you)" : ""}</span>
              <span className="font-mono">{r.total}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------- Find the Nash equilibria ---------- */
function NashHunt({ cfg, locked, onDone }: P<"nash-hunt">) {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState<{ text: string; good?: boolean } | null>(null);
  const pz = cfg.puzzles[i];
  const toggle = (r: number, c: number) => {
    const k = `${r},${c}`;
    const n = new Set(sel);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setSel(n);
  };
  const check = () => {
    const truth = pureNash(pz.payoffs);
    const picked = [...sel].map((k) => k.split(",").map(Number) as [number, number]);
    if (sameCells(truth, picked)) {
      if (i + 1 >= cfg.puzzles.length) {
        onDone({ won: true, summary: `All ${cfg.puzzles.length} puzzles solved with ${mistakes} mistake${mistakes === 1 ? "" : "s"}.` });
        return;
      }
      setMsg({ text: truth.length ? `Correct: ${truth.length} equilibrium${truth.length > 1 ? "s" : ""}. Next puzzle.` : "Correct: no pure equilibrium here. Next puzzle.", good: true });
      setI(i + 1);
      setSel(new Set());
      return;
    }
    const m = mistakes + 1;
    setMistakes(m);
    if (m > cfg.maxMistakes) {
      onDone({ won: false, summary: `Too many misses. The equilibria in "${pz.title}" were ${truth.length ? truth.map(([r, c]) => `${pz.rows[r]}/${pz.cols[c]}`).join(", ") : "none"}.` });
      return;
    }
    setMsg({ text: "Not quite. For each cell you picked, ask: could either player do better by switching alone?" });
  };
  return (
    <div>
      <p className="font-bold">
        Puzzle {i + 1}/{cfg.puzzles.length}: {pz.title}
      </p>
      <p className="text-sm text-muted-foreground">Tap every cell where neither player wants to switch alone. Tap none if there is no such cell. Misses left: {cfg.maxMistakes - mistakes}</p>
      <PayoffMatrix rows={pz.rows} cols={pz.cols} payoffs={pz.payoffs} selected={sel} onCell={toggle} disabled={locked} />
      <Btn onClick={check} disabled={locked} testId="nash-check">{sel.size ? `Check ${sel.size} cell${sel.size > 1 ? "s" : ""}` : "Check: no equilibrium"}</Btn>
      {msg && <Note tone={msg.good ? "good" : "bad"}>{msg.text}</Note>}
    </div>
  );
}

/* ---------- Iterated elimination of dominated strategies ---------- */
function Dominance({ cfg, locked, onDone }: P<"dominance">) {
  const [rows, setRows] = useState(cfg.rows.map((_, i) => i));
  const [cols, setCols] = useState(cfg.cols.map((_, i) => i));
  const [mistakes, setMistakes] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const tryKill = (player: "row" | "col", idx: number) => {
    if (isStrictlyDominated(cfg.payoffs, rows, cols, player, idx)) {
      const nr = player === "row" ? rows.filter((x) => x !== idx) : rows;
      const nc = player === "col" ? cols.filter((x) => x !== idx) : cols;
      setRows(nr);
      setCols(nc);
      setMsg(`${player === "row" ? cfg.rows[idx] : cfg.cols[idx]} is gone: another option beats it against everything left.`);
      if (nr.length === 1 && nc.length === 1)
        onDone({ won: true, summary: `Solved: ${cfg.rows[nr[0]]} / ${cfg.cols[nc[0]]} survives, with ${mistakes} mistake${mistakes === 1 ? "" : "s"}.` });
      return;
    }
    const m = mistakes + 1;
    setMistakes(m);
    setMsg(`${player === "row" ? cfg.rows[idx] : cfg.cols[idx]} is not strictly dominated right now.`);
    if (m > cfg.maxMistakes) onDone({ won: false, summary: "Too many wrong deletions. Look for an option that is worse in every remaining column (or row)." });
  };
  const dead = (all: string[], alive: number[]) => all.map((_, i) => i).filter((i) => !alive.includes(i));
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Tap a row (your options, gold payoffs) or a column (their options, green payoffs) to delete it. Only delete strictly dominated ones. Mistakes left: {cfg.maxMistakes - mistakes}
      </p>
      <PayoffMatrix rows={cfg.rows} cols={cfg.cols} payoffs={cfg.payoffs} onRow={(r) => tryKill("row", r)} onCol={(c) => tryKill("col", c)} deadRows={dead(cfg.rows, rows)} deadCols={dead(cfg.cols, cols)} disabled={locked} />
      {msg && <Note>{msg}</Note>}
    </div>
  );
}

/* ---------- Ultimatum game ---------- */
function Ultimatum({ cfg, seed, locked, onDone }: P<"ultimatum">) {
  const [offer, setOffer] = useState(Math.round(cfg.pie / 2));
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const offers = useMemo(() => {
    if (cfg.offers.length) return cfg.offers;
    const r = mulberry32(seed);
    return [0.1, 0.3, 0.5].map((f) => botOffer(cfg.pie, f, r));
  }, [cfg.offers, cfg.pie, seed]);
  const steps = cfg.thresholds.length + offers.length;
  const advance = (gain: number, line: string) => {
    const t = total + gain;
    setTotal(t);
    setLog([...log, line]);
    if (step + 1 >= steps) onDone({ won: t >= cfg.target, summary: `You ended with ${t} coins (target ${cfg.target}).` });
    setStep(step + 1);
  };
  const proposing = step < cfg.thresholds.length;
  const botOfferNow = offers[step - cfg.thresholds.length];
  return (
    <div>
      <Stats>
        <Stat label="Step" value={`${Math.min(step + 1, steps)}/${steps}`} />
        <Stat label="Coins" value={total} tone={total >= cfg.target ? "good" : undefined} />
        <Stat label="Target" value={cfg.target} />
        <Stat label="Pie" value={cfg.pie} />
      </Stats>
      {step < steps && proposing && (
        <div>
          <p className="font-bold">You propose to responder #{step + 1}. They accept if the offer is at least their secret minimum.</p>
          <NumSlider label="Your offer to them" value={offer} min={0} max={cfg.pie} onChange={setOffer} disabled={locked} testId="ult-offer" />
          <Btn
            onClick={() => {
              const ok = offer >= cfg.thresholds[step];
              advance(ok ? cfg.pie - offer : 0, ok ? `Offered ${offer}: accepted. You keep ${cfg.pie - offer}.` : `Offered ${offer}: rejected. Both get 0.`);
            }}
            disabled={locked}
            testId="ult-send"
          >
            Send offer
          </Btn>
        </div>
      )}
      {step < steps && !proposing && (
        <div>
          <p className="font-bold">
            A bot offers you {botOfferNow} of {cfg.pie}.
          </p>
          <div className="mt-2 flex gap-2">
            <Btn tone="green" onClick={() => advance(botOfferNow, `Accepted ${botOfferNow}.`)} disabled={locked} testId="ult-accept">Accept {botOfferNow}</Btn>
            <Btn tone="red" onClick={() => advance(0, `Rejected ${botOfferNow}. Both got 0.`)} disabled={locked} testId="ult-reject">Reject</Btn>
          </div>
        </div>
      )}
      <Log lines={log} />
    </div>
  );
}

/* ---------- Keynesian beauty contest ---------- */
function BeautyContest({ cfg, seed, locked, onDone }: P<"beauty-contest">) {
  const rand = useRand(seed);
  const [guess, setGuess] = useState(33);
  const [round, setRound] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [best, setBest] = useState(Infinity);
  const [log, setLog] = useState<string[]>([]);
  const play = () => {
    const crowd = crowdGuesses(cfg.crowd, cfg.fraction, round, prev, rand.current);
    const target = contestTarget([...crowd, guess], cfg.fraction);
    const rank = contestRank(guess, crowd, target);
    const b = Math.min(best, rank);
    setBest(b);
    setPrev(target);
    setLog([...log, `Round ${round + 1}: average ${fmt(target / cfg.fraction, 1)}, target ${fmt(target, 1)}, you guessed ${guess}, rank #${rank} of ${cfg.crowd + 1}.`]);
    if (round + 1 >= cfg.rounds) onDone({ won: b <= 3, summary: `Best finish: #${b}. A top-3 finish wins. The crowd drifted toward 0, which is the only Nash equilibrium.` });
    setRound(round + 1);
  };
  return (
    <div>
      <Note>
        {cfg.crowd} bots and you each pick 0 to 100. The winner is closest to {fmt(cfg.fraction, 2)} of the average. Get a top-3 finish in any of {cfg.rounds} rounds. The bots learn from the last round.
      </Note>
      {round < cfg.rounds && (
        <>
          <NumSlider label={`Round ${round + 1} guess`} value={guess} min={0} max={100} onChange={setGuess} disabled={locked} testId="bc-guess" />
          <Btn onClick={play} disabled={locked} testId="bc-submit">Lock in {guess}</Btn>
        </>
      )}
      <Log lines={log} />
    </div>
  );
}

/* ---------- Sealed-bid auctions ---------- */
function Auction({ cfg, seed, locked, onDone }: P<"auction">) {
  const values = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: cfg.rounds }, () => Array.from({ length: cfg.bidders }, () => 20 + Math.round(r() * 80)));
  }, [cfg.rounds, cfg.bidders, seed]);
  const rand = useRand(seed + 1);
  const [round, setRound] = useState(0);
  const [bid, setBid] = useState(50);
  const [profit, setProfit] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const mine = values[Math.min(round, cfg.rounds - 1)][0];
  const play = () => {
    const vs = values[round];
    const bids = [bid, ...vs.slice(1).map((v) => botBid(v, cfg.bidders, cfg.format, rand.current))];
    const { winner, price } = resolveAuction(bids, cfg.format);
    const gain = winner === 0 ? mine - price : 0;
    const p = profit + gain;
    setProfit(p);
    setLog([
      ...log,
      winner === 0
        ? `Round ${round + 1}: you won at ₹${price} for an item worth ₹${mine} to you. Profit ${gain >= 0 ? "+" : ""}${gain}.`
        : `Round ${round + 1}: bot ${winner} won at ₹${price}. Bids were ${bids.join(", ")}.`,
    ]);
    if (round + 1 >= cfg.rounds) onDone({ won: p >= cfg.target, summary: `Total profit ₹${p} (target ₹${cfg.target}).` });
    setRound(round + 1);
  };
  return (
    <div>
      <Note>
        {cfg.format === "first" ? "First-price: the highest bid wins and pays its own bid." : "Second-price: the highest bid wins but pays the second-highest bid."} {cfg.bidders - 1} bots bid each round. Profit = your value minus what you pay.
      </Note>
      <Stats>
        <Stat label="Round" value={`${Math.min(round + 1, cfg.rounds)}/${cfg.rounds}`} />
        <Stat label="Your value" value={`₹${mine}`} />
        <Stat label="Profit" value={`₹${profit}`} tone={profit >= cfg.target ? "good" : profit < 0 ? "bad" : undefined} />
        <Stat label="Target" value={`₹${cfg.target}`} />
      </Stats>
      {round < cfg.rounds && (
        <>
          <NumSlider label="Your sealed bid" value={bid} min={0} max={120} onChange={setBid} unit="₹" disabled={locked} testId="auction-bid" />
          <Btn onClick={play} disabled={locked} testId="auction-submit">Seal the bid</Btn>
        </>
      )}
      <Log lines={log} />
    </div>
  );
}

/* ---------- Centipede ---------- */
function Centipede({ cfg, locked, onDone }: P<"centipede">) {
  const [stage, setStage] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const end = (you: number, line: string, lines: string[]) => {
    setLog([...lines, line]);
    onDone({ won: you >= cfg.target, summary: `You got ${fmt(you)} (target ${cfg.target}). Backward induction says take at once and get ${centipedeTake(cfg.base, 0).taker}.` });
  };
  const take = () => end(centipedeTake(cfg.base, stage).taker, `Stage ${stage + 1}: you took ${centipedeTake(cfg.base, stage).taker}.`, log);
  const pass = () => {
    const lines = [...log, `Stage ${stage + 1}: you passed. Pot doubles.`];
    const s = stage + 1;
    if (s >= cfg.stages) return end(centipedeEnd(cfg.base, cfg.stages), "The game ran out. The pot is split evenly.", lines);
    if (s >= cfg.botTakeAt) return end(centipedeTake(cfg.base, s).other, `Stage ${s + 1}: the bot took ${centipedeTake(cfg.base, s).taker}. You get ${centipedeTake(cfg.base, s).other}.`, lines);
    const s2 = s + 1;
    lines.push(`Stage ${s + 1}: the bot passed.`);
    if (s2 >= cfg.stages) return end(centipedeEnd(cfg.base, cfg.stages), "The game ran out. The pot is split evenly.", lines);
    setLog(lines);
    setStage(s2);
  };
  return (
    <div>
      <Note>
        The pot doubles every time someone passes. Whoever takes gets 3/4 of the pot, the other gets 1/4. You move on odd stages, the bot on even ones. {cfg.stages} stages in total.
      </Note>
      <Stats>
        <Stat label="Stage" value={`${stage + 1}/${cfg.stages}`} />
        <Stat label="Pot" value={fmt(centipedePot(cfg.base, stage))} />
        <Stat label="Take now" value={fmt(centipedeTake(cfg.base, stage).taker)} />
        <Stat label="Target" value={cfg.target} />
      </Stats>
      <div className="flex gap-2">
        <Btn tone="red" onClick={take} disabled={locked} testId="cent-take">Take</Btn>
        <Btn tone="green" onClick={pass} disabled={locked} testId="cent-pass">Pass</Btn>
      </div>
      <Log lines={log} />
    </div>
  );
}

/* ---------- Backward induction on a game tree ---------- */
function TreeView({ node, players, picks, onPick, disabled, depth = 0 }: { node: TreeNode; players: [string, string]; picks: Record<string, number>; onPick: (id: string, i: number) => void; disabled: boolean; depth?: number }): ReactNode {
  if (isLeaf(node))
    return (
      <span className="font-mono text-sm">
        → <span className="text-gold-ink">{node.payoffs[0]}</span>, <span className="text-money-ink">{node.payoffs[1]}</span>
      </span>
    );
  return (
    <div className={cn("my-1 rounded-lg border border-border p-2", depth > 0 && "ml-3")}>
      <p className={cn("text-sm font-bold", node.player === 0 ? "text-gold-ink" : "text-money-ink")}>
        {players[node.player]} chooses{node.label ? `: ${node.label}` : ""}
      </p>
      {node.moves.map((m, i) => (
        <div key={i} className="mt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(node.id, i)}
            data-testid={`tree-${node.id}-${i}`}
            className={cn("mr-2 min-h-9 rounded border-2 px-2 text-sm", picks[node.id] === i ? "border-gold bg-gold/20" : "border-border")}
          >
            {m.label}
          </button>
          <TreeView node={m.next} players={players} picks={picks} onPick={onPick} disabled={disabled} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function GameTree({ cfg, locked, onDone }: P<"game-tree">) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const solved = useMemo(() => solveTree(cfg.tree), [cfg.tree]);
  const ids = Object.keys(solved.choice);
  const check = () => {
    const wrong = ids.filter((id) => picks[id] !== solved.choice[id]).length;
    onDone({
      won: wrong === 0,
      summary: wrong === 0 ? `Every choice matches backward induction. Outcome: ${solved.value[0]}, ${solved.value[1]}.` : `${wrong} of ${ids.length} choices differ from backward induction. Start at the bottom: at each node, the mover picks the bigger payoff for themselves.`,
    });
  };
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        At every decision point, tap the move that player will really make. {cfg.players[0]}&apos;s payoff is gold, {cfg.players[1]}&apos;s is green.
      </p>
      <TreeView node={cfg.tree} players={cfg.players} picks={picks} onPick={(id, i) => setPicks({ ...picks, [id]: i })} disabled={locked} />
      <Btn onClick={check} disabled={locked || Object.keys(picks).length < ids.length} testId="tree-check">
        Check {Object.keys(picks).length}/{ids.length} choices
      </Btn>
    </div>
  );
}

/* ---------- Penalty kicks ---------- */
function PenaltyKicks({ cfg, seed, locked, onDone }: P<"penalty-kicks">) {
  const rand = useRand(seed);
  const [hist, setHist] = useState<("L" | "R")[]>([]);
  const [goals, setGoals] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const eq = mixed2x2([
    [[cfg.score.L[0], 1 - cfg.score.L[0]], [cfg.score.L[1], 1 - cfg.score.L[1]]],
    [[cfg.score.R[0], 1 - cfg.score.R[0]], [cfg.score.R[1], 1 - cfg.score.R[1]]],
  ]);
  const kick = (side: "L" | "R") => {
    const dive = goalieDive(hist, cfg.memory, rand.current);
    const p = cfg.score[side][dive === "L" ? 0 : 1];
    const goal = rand.current() < p;
    const g = goals + (goal ? 1 : 0);
    const h = [...hist, side];
    setHist(h);
    setGoals(g);
    setLast(`You went ${side === "L" ? "left" : "right"}, keeper dived ${dive === "L" ? "left" : "right"}: ${goal ? "GOAL" : "saved"}.`);
    if (h.length >= cfg.kicks)
      onDone({ won: g >= cfg.target, summary: `${g}/${cfg.kicks} goals (target ${cfg.target}). The keeper reads patterns.${eq ? ` The equilibrium mix is about ${Math.round(eq.p * 100)}% left.` : ""}` });
  };
  return (
    <div>
      <Note>
        Chance of scoring: left vs keeper-left {Math.round(cfg.score.L[0] * 100)}%, left vs keeper-right {Math.round(cfg.score.L[1] * 100)}%, right vs keeper-left {Math.round(cfg.score.R[0] * 100)}%, right vs keeper-right {Math.round(cfg.score.R[1] * 100)}%. The keeper watches your last {cfg.memory} kicks.
      </Note>
      <Stats>
        <Stat label="Kick" value={`${Math.min(hist.length + 1, cfg.kicks)}/${cfg.kicks}`} />
        <Stat label="Goals" value={goals} tone={goals >= cfg.target ? "good" : undefined} />
        <Stat label="Target" value={cfg.target} />
        <Stat label="Left so far" value={hist.length ? `${Math.round((hist.filter((s) => s === "L").length / hist.length) * 100)}%` : "-"} />
      </Stats>
      {hist.length < cfg.kicks && (
        <div className="flex gap-2">
          <Btn onClick={() => kick("L")} disabled={locked} testId="kick-left">⬅ Shoot left</Btn>
          <Btn onClick={() => kick("R")} disabled={locked} testId="kick-right">Shoot right ➡</Btn>
        </div>
      )}
      {last && <Note tone={last.endsWith("GOAL.") ? "good" : "bad"}>{last}</Note>}
    </div>
  );
}

/* ---------- Monty Hall ---------- */
function MontyHall({ cfg, seed, locked, onDone }: P<"monty-hall">) {
  const rand = useRand(seed);
  const [prize, setPrize] = useState(() => Math.floor(mulberry32(seed + 9)() * cfg.doors));
  const [pick, setPick] = useState<number | null>(null);
  const [other, setOther] = useState<number | null>(null);
  const [final, setFinal] = useState<number | null>(null);
  const [stats, setStats] = useState({ stay: [0, 0], swap: [0, 0] });
  const [sim, setSim] = useState<{ stay: number; swap: number } | null>(null);
  const plays = stats.stay[1] + stats.swap[1];
  const choose = (d: number) => {
    setPick(d);
    setOther(montySwitchDoor(prize, d, cfg.doors, rand.current));
  };
  const decide = (swap: boolean) => {
    const f = swap ? other! : pick!;
    setFinal(f);
    const win = f === prize ? 1 : 0;
    const k = swap ? "swap" : "stay";
    setStats({ ...stats, [k]: [stats[k][0] + win, stats[k][1] + 1] });
  };
  const again = () => {
    setPrize(Math.floor(rand.current() * cfg.doors));
    setPick(null);
    setOther(null);
    setFinal(null);
  };
  const runSim = () => {
    const n = 10000;
    const s = { stay: simulateMonty(n, false, cfg.doors, rand.current) / n, swap: simulateMonty(n, true, cfg.doors, rand.current) / n };
    setSim(s);
    onDone({ won: true, summary: `Over 10,000 games: staying won ${Math.round(s.stay * 100)}%, switching won ${Math.round(s.swap * 100)}%. With ${cfg.doors} doors, switching wins ${cfg.doors - 1} times in ${cfg.doors}.` });
  };
  const open = (d: number) => other !== null && d !== pick && d !== other;
  return (
    <div>
      <div className="my-3 flex flex-wrap gap-2">
        {Array.from({ length: cfg.doors }, (_, d) => (
          <button
            key={d}
            type="button"
            disabled={locked || pick !== null}
            onClick={() => choose(d)}
            data-testid={`door-${d}`}
            className={cn("grid h-24 w-16 place-items-center rounded-t-xl border-2 bg-ink font-display text-2xl", pick === d ? "border-gold" : d === other ? "border-money" : "border-border")}
          >
            {final !== null || open(d) ? (d === prize ? "🚗" : "🐐") : d + 1}
          </button>
        ))}
      </div>
      {pick === null && <p>Pick a door. A car is behind one, goats behind the rest.</p>}
      {pick !== null && final === null && (
        <div>
          <p className="mb-2">The host, who knows where the car is, opened {cfg.doors - 2} goat door{cfg.doors > 3 ? "s" : ""}. Stay with door {pick + 1}, or switch to door {other! + 1}?</p>
          <div className="flex gap-2">
            <Btn onClick={() => decide(false)} disabled={locked} testId="monty-stay">Stay</Btn>
            <Btn onClick={() => decide(true)} disabled={locked} testId="monty-switch">Switch</Btn>
          </div>
        </div>
      )}
      {final !== null && (
        <div>
          <Note tone={final === prize ? "good" : "bad"}>{final === prize ? "Car!" : "Goat."}</Note>
          <Btn onClick={again} disabled={locked} testId="monty-again">Play again</Btn>
        </div>
      )}
      <Stats>
        <Stat label="Stay wins" value={`${stats.stay[0]}/${stats.stay[1]}`} />
        <Stat label="Switch wins" value={`${stats.swap[0]}/${stats.swap[1]}`} />
        <Stat label="Played" value={`${plays}/${cfg.minPlays}`} />
        <Stat label="Sim" value={sim ? `${Math.round(sim.swap * 100)}% swap` : "-"} />
      </Stats>
      <Btn onClick={runSim} disabled={locked || plays < cfg.minPlays} testId="monty-sim">
        {plays < cfg.minPlays ? `Play ${cfg.minPlays - plays} more to unlock the 10,000-game simulator` : "Run 10,000 games of each"}
      </Btn>
    </div>
  );
}

/* ---------- Coordination / focal points ---------- */
function Coordination({ cfg, locked, onDone }: P<"coordination">) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState<number | null>(null);
  const q = cfg.questions[i];
  const top = q.shares.indexOf(Math.max(...q.shares));
  const total = q.shares.reduce((s, x) => s + x, 0);
  const choose = (k: number) => {
    setReveal(k);
    if (k === top) setScore(score + 1);
  };
  const next = () => {
    if (i + 1 >= cfg.questions.length) {
      onDone({ won: score >= cfg.target, summary: `You matched the crowd ${score} of ${cfg.questions.length} times (target ${cfg.target}).` });
      return;
    }
    setI(i + 1);
    setReveal(null);
  };
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        You score only if you pick what most other players picked. Question {i + 1}/{cfg.questions.length}. Matches: {score}
      </p>
      <p className="my-2 text-lg font-bold">{q.prompt}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, k) => (
          <Btn key={k} onClick={() => choose(k)} disabled={locked || reveal !== null} active={reveal !== null && (k === top || k === reveal)} tone={k === top ? "green" : "red"} testId={`coord-${k}`}>
            {o}
            {reveal !== null && <span className="ml-2 font-mono text-sm">{Math.round((q.shares[k] / total) * 100)}%</span>}
          </Btn>
        ))}
      </div>
      {reveal !== null && (
        <div className="mt-3">
          <Btn onClick={next} disabled={locked} testId="coord-next">{i + 1 >= cfg.questions.length ? "Finish" : "Next question"}</Btn>
        </div>
      )}
    </div>
  );
}

/* ---------- Hawk-dove evolution ---------- */
function HawkDove({ cfg, locked, onDone }: P<"hawk-dove">) {
  const [V, setV] = useState(4);
  const [C, setC] = useState(4);
  const path = useMemo(() => hawkDovePath(cfg.start, V, C, cfg.generations), [cfg.start, cfg.generations, V, C]);
  const end = path[path.length - 1];
  const ok = end >= cfg.lo && end <= cfg.hi;
  return (
    <div>
      <Note tone={ok ? "good" : undefined}>
        Goal: make the population settle with between {Math.round(cfg.lo * 100)}% and {Math.round(cfg.hi * 100)}% hawks. Now: {Math.round(end * 100)}%.
      </Note>
      <NumSlider label="Prize V (food won)" value={V} min={1} max={20} onChange={setV} disabled={locked} testId="hd-v" />
      <NumSlider label="Cost C (injury in a fight)" value={C} min={1} max={40} onChange={setC} disabled={locked} testId="hd-c" />
      <Chart spec={{ kind: "line", title: "Share of hawks", xLabel: "generation", yLabel: "hawks", series: [{ label: "hawks", tone: "red", points: path.map((h, g) => [g, h]) }] }} />
      <Btn onClick={() => onDone({ won: ok, summary: `The population settled at ${Math.round(end * 100)}% hawks with V=${V}, C=${C}. When C > V the stable share is V/C = ${Math.round(Math.min(1, V / C) * 100)}%.` })} disabled={locked} testId="hd-lock">
        Lock in this world
      </Btn>
    </div>
  );
}

export const GT_GAMES = {
  "pd-match": PdMatch,
  "pd-tournament": PdTournament,
  "nash-hunt": NashHunt,
  dominance: Dominance,
  ultimatum: Ultimatum,
  "beauty-contest": BeautyContest,
  auction: Auction,
  centipede: Centipede,
  "game-tree": GameTree,
  "penalty-kicks": PenaltyKicks,
  "monty-hall": MontyHall,
  coordination: Coordination,
  "hawk-dove": HawkDove,
};
