import { clamp } from "./rng";

/* ---------------- Prisoner's dilemma ---------------- */

export type Move = "C" | "D";
export const PD_PAYOFF = { T: 5, R: 3, P: 1, S: 0 };

/** Points for the first player when they play a and the other plays b. */
export function pdPoints(a: Move, b: Move): number {
  if (a === "C" && b === "C") return PD_PAYOFF.R;
  if (a === "C" && b === "D") return PD_PAYOFF.S;
  if (a === "D" && b === "C") return PD_PAYOFF.T;
  return PD_PAYOFF.P;
}

export const PD_STRATEGIES = [
  "tit-for-tat",
  "always-cooperate",
  "always-defect",
  "grim-trigger",
  "random",
  "tit-for-two-tats",
  "alternator",
  "pavlov",
  "suspicious-tit-for-tat",
  "generous-tit-for-tat",
] as const;
export type PdStrategy = (typeof PD_STRATEGIES)[number];

export const PD_STRATEGY_INFO: Record<PdStrategy, { name: string; rule: string }> = {
  "tit-for-tat": { name: "Tit for tat", rule: "Cooperates first, then copies your last move." },
  "always-cooperate": { name: "Always cooperate", rule: "Cooperates every round, no matter what." },
  "always-defect": { name: "Always defect", rule: "Defects every round." },
  "grim-trigger": { name: "Grim trigger", rule: "Cooperates until you defect once, then defects forever." },
  random: { name: "Random", rule: "Flips a coin each round." },
  "tit-for-two-tats": { name: "Tit for two tats", rule: "Defects only after you defect twice in a row." },
  alternator: { name: "Alternator", rule: "Cooperates, defects, cooperates, defects..." },
  pavlov: { name: "Pavlov", rule: "Repeats its last move if it scored 3 or 5, switches if it scored 0 or 1." },
  "suspicious-tit-for-tat": { name: "Suspicious tit for tat", rule: "Defects first, then copies your last move." },
  "generous-tit-for-tat": { name: "Generous tit for tat", rule: "Like tit for tat, but forgives a defection 1 time in 3." },
};

/** The bot's next move given its own history and the other player's history. */
export function pdNextMove(s: PdStrategy, mine: Move[], theirs: Move[], rand: () => number): Move {
  const n = theirs.length;
  const last = theirs[n - 1];
  switch (s) {
    case "tit-for-tat":
      return n === 0 ? "C" : last;
    case "always-cooperate":
      return "C";
    case "always-defect":
      return "D";
    case "grim-trigger":
      return theirs.includes("D") ? "D" : "C";
    case "random":
      return rand() < 0.5 ? "C" : "D";
    case "tit-for-two-tats":
      return n >= 2 && theirs[n - 1] === "D" && theirs[n - 2] === "D" ? "D" : "C";
    case "alternator":
      return mine.length % 2 === 0 ? "C" : "D";
    case "pavlov": {
      if (n === 0) return "C";
      const myLast = mine[mine.length - 1];
      const got = pdPoints(myLast, last);
      return got >= 3 ? myLast : myLast === "C" ? "D" : "C";
    }
    case "suspicious-tit-for-tat":
      return n === 0 ? "D" : last;
    case "generous-tit-for-tat":
      if (n === 0 || last === "C") return "C";
      return rand() < 1 / 3 ? "C" : "D";
  }
}

export type MatchResult = { a: Move[]; b: Move[]; scoreA: number; scoreB: number };

/** Plays two strategies against each other. noise is the chance a move gets flipped by mistake. */
export function pdMatch(sa: PdStrategy, sb: PdStrategy, rounds: number, noise: number, rand: () => number): MatchResult {
  const a: Move[] = [];
  const b: Move[] = [];
  let scoreA = 0;
  let scoreB = 0;
  const flip = (m: Move): Move => (noise > 0 && rand() < noise ? (m === "C" ? "D" : "C") : m);
  for (let r = 0; r < rounds; r++) {
    const ma = flip(pdNextMove(sa, a, b, rand));
    const mb = flip(pdNextMove(sb, b, a, rand));
    a.push(ma);
    b.push(mb);
    scoreA += pdPoints(ma, mb);
    scoreB += pdPoints(mb, ma);
  }
  return { a, b, scoreA, scoreB };
}

/** Round-robin tournament: every entry plays every other entry once (plus itself, like Axelrod). */
export function pdTournament(entries: PdStrategy[], rounds: number, noise: number, rand: () => number) {
  const totals = entries.map(() => 0);
  for (let i = 0; i < entries.length; i++)
    for (let j = i; j < entries.length; j++) {
      const m = pdMatch(entries[i], entries[j], rounds, noise, rand);
      totals[i] += m.scoreA;
      if (i !== j) totals[j] += m.scoreB;
    }
  return entries
    .map((s, i) => ({ strategy: s, index: i, total: totals[i] }))
    .sort((x, y) => y.total - x.total || x.index - y.index);
}

/* ---------------- Payoff matrices ---------------- */

/** payoffs[row][col] = [row player's payoff, column player's payoff] */
export type Matrix = [number, number][][];

export function pureNash(m: Matrix): [number, number][] {
  const out: [number, number][] = [];
  const rows = m.length;
  const cols = m[0].length;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const rowBest = m.every((row) => row[c][0] <= m[r][c][0]);
      const colBest = m[r].every((cell) => cell[1] <= m[r][c][1]);
      if (rowBest && colBest) out.push([r, c]);
    }
  return out;
}

export function sameCells(a: [number, number][], b: [number, number][]): boolean {
  const key = (x: [number, number]) => `${x[0]},${x[1]}`;
  const sa = new Set(a.map(key));
  return sa.size === b.length && b.every((x) => sa.has(key(x)));
}

/** Is strategy idx of player ("row" or "col") strictly dominated by another remaining pure strategy? */
export function isStrictlyDominated(m: Matrix, rowsAlive: number[], colsAlive: number[], player: "row" | "col", idx: number): boolean {
  if (player === "row") {
    return rowsAlive.some((o) => o !== idx && colsAlive.every((c) => m[o][c][0] > m[idx][c][0]));
  }
  return colsAlive.some((o) => o !== idx && rowsAlive.every((r) => m[r][o][1] > m[r][idx][1]));
}

/** Iterated elimination of strictly dominated strategies. Returns what survives. */
export function iteratedElimination(m: Matrix): { rows: number[]; cols: number[] } {
  let rows = m.map((_, i) => i);
  let cols = m[0].map((_, i) => i);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows)
      if (isStrictlyDominated(m, rows, cols, "row", r)) {
        rows = rows.filter((x) => x !== r);
        changed = true;
        break;
      }
    for (const c of cols)
      if (isStrictlyDominated(m, rows, cols, "col", c)) {
        cols = cols.filter((x) => x !== c);
        changed = true;
        break;
      }
  }
  return { rows, cols };
}

/**
 * Mixed equilibrium of a 2x2 game. Returns p = chance the row player plays row 0, q = chance the
 * column player plays column 0. Null when no interior mix exists.
 */
export function mixed2x2(m: Matrix): { p: number; q: number } | null {
  // Column player indifferent: p*b00 + (1-p)*b10 = p*b01 + (1-p)*b11
  const b = (r: number, c: number) => m[r][c][1];
  const a = (r: number, c: number) => m[r][c][0];
  const denP = b(0, 0) - b(1, 0) - b(0, 1) + b(1, 1);
  const denQ = a(0, 0) - a(0, 1) - a(1, 0) + a(1, 1);
  if (denP === 0 || denQ === 0) return null;
  const p = (b(1, 1) - b(1, 0)) / denP;
  const q = (a(1, 1) - a(0, 1)) / denQ;
  if (p <= 0 || p >= 1 || q <= 0 || q >= 1) return null;
  return { p, q };
}

/* ---------------- Ultimatum ---------------- */

/** A responder accepts an offer at or above their threshold. */
export const ultimatumAccepts = (offer: number, threshold: number) => offer >= threshold;

/** Bot proposer: offers a share of the pie, drawn around its fairness level. */
export function botOffer(pie: number, fairness: number, rand: () => number): number {
  return clamp(Math.round(pie * (fairness + (rand() - 0.5) * 0.2)), 0, pie);
}

/* ---------------- Keynesian beauty contest ---------------- */

/** Crowd guesses: a mix of level-0 (random), level-1, level-2 thinkers. Later rounds anchor on the last target. */
export function crowdGuesses(size: number, fraction: number, round: number, prevTarget: number | null, rand: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const u = rand();
    let g: number;
    if (prevTarget === null || round === 0) {
      if (u < 0.3) g = rand() * 100;
      else if (u < 0.65) g = 50 * fraction;
      else if (u < 0.9) g = 50 * fraction * fraction;
      else g = rand() < 0.5 ? 0 : 1;
    } else {
      if (u < 0.15) g = rand() * 100;
      else if (u < 0.6) g = prevTarget;
      else g = prevTarget * fraction;
    }
    out.push(clamp(Math.round(g + (rand() - 0.5) * 6), 0, 100));
  }
  return out;
}

export function contestTarget(guesses: number[], fraction: number): number {
  const avg = guesses.reduce((s, x) => s + x, 0) / guesses.length;
  return avg * fraction;
}

/** Rank of a guess by distance to target, 1 = closest. Ties share the better rank. */
export function contestRank(you: number, crowd: number[], target: number): number {
  const d = Math.abs(you - target);
  return 1 + crowd.filter((g) => Math.abs(g - target) < d).length;
}

/* ---------------- Auctions ---------------- */

export type AuctionFormat = "first" | "second";

/** Winner index and price. Ties go to the lowest index. */
export function resolveAuction(bids: number[], format: AuctionFormat): { winner: number; price: number } {
  let winner = 0;
  for (let i = 1; i < bids.length; i++) if (bids[i] > bids[winner]) winner = i;
  if (format === "first") return { winner, price: bids[winner] };
  const others = bids.filter((_, i) => i !== winner);
  return { winner, price: others.length ? Math.max(...others) : 0 };
}

/** Bot bid. Second price: bid your value. First price: shade toward (n-1)/n of value. */
export function botBid(value: number, n: number, format: AuctionFormat, rand: () => number): number {
  if (format === "second") return value;
  const shade = (n - 1) / n;
  return Math.round(value * clamp(shade + (rand() - 0.5) * 0.1, 0, 1));
}

/* ---------------- Centipede ---------------- */

/** Pot at stage k is base * 2^k. Whoever takes gets 3/4, the other 1/4. Passing the last stage splits evenly. */
export function centipedePot(base: number, stage: number) {
  return base * 2 ** stage;
}
export function centipedeTake(base: number, stage: number): { taker: number; other: number } {
  const pot = centipedePot(base, stage);
  return { taker: (pot * 3) / 4, other: pot / 4 };
}
export function centipedeEnd(base: number, stages: number): number {
  return centipedePot(base, stages) / 2;
}

/* ---------------- Game trees ---------------- */

export type TreeNode =
  | { id: string; player: 0 | 1; label?: string; moves: { label: string; next: TreeNode }[] }
  | { id: string; payoffs: [number, number] };

export const isLeaf = (n: TreeNode): n is { id: string; payoffs: [number, number] } => "payoffs" in n;

/** Backward induction. Returns the payoff of the subgame and the best move index at every decision node. */
export function solveTree(n: TreeNode, choice: Record<string, number> = {}): { value: [number, number]; choice: Record<string, number> } {
  if (isLeaf(n)) return { value: n.payoffs, choice };
  let best = -1;
  let bestVal: [number, number] = [0, 0];
  n.moves.forEach((m, i) => {
    const v = solveTree(m.next, choice).value;
    if (best === -1 || v[n.player] > bestVal[n.player]) {
      best = i;
      bestVal = v;
    }
  });
  choice[n.id] = best;
  return { value: bestVal, choice };
}

export function decisionNodes(n: TreeNode): TreeNode[] {
  if (isLeaf(n)) return [];
  return [n, ...n.moves.flatMap((m) => decisionNodes(m.next))];
}

/** True when some decision node has two moves with an equal payoff for the mover (ambiguous puzzle). */
export function treeHasTies(n: TreeNode): boolean {
  if (isLeaf(n)) return false;
  const vals = n.moves.map((m) => solveTree(m.next).value[n.player]);
  return new Set(vals).size !== vals.length || n.moves.some((m) => treeHasTies(m.next));
}

/* ---------------- Penalty kicks ---------------- */

/** Goalie bot: dives toward the side you used most in your last `memory` kicks, with some randomness. */
export function goalieDive(history: ("L" | "R")[], memory: number, rand: () => number): "L" | "R" {
  const recent = history.slice(-memory);
  if (recent.length < 2) return rand() < 0.5 ? "L" : "R";
  const left = recent.filter((s) => s === "L").length / recent.length;
  const pLeft = clamp(0.5 + (left - 0.5) * 1.6, 0.1, 0.9);
  return rand() < pLeft ? "L" : "R";
}

/* ---------------- Monty Hall ---------------- */

/** Host opens every unpicked door except one, never the prize. Returns the door left closed for switching. */
export function montySwitchDoor(prize: number, pick: number, doors: number, rand: () => number): number {
  if (pick !== prize) return prize;
  const others = Array.from({ length: doors }, (_, i) => i).filter((d) => d !== pick);
  return others[Math.floor(rand() * others.length)];
}

export function simulateMonty(n: number, doSwitch: boolean, doors: number, rand: () => number): number {
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const prize = Math.floor(rand() * doors);
    const pick = Math.floor(rand() * doors);
    const final = doSwitch ? montySwitchDoor(prize, pick, doors, rand) : pick;
    if (final === prize) wins++;
  }
  return wins;
}

/* ---------------- Hawk-dove ---------------- */

/** Replicator dynamics for the share of hawks. V = prize, C = cost of a fight. */
export function hawkDoveStep(h: number, V: number, C: number, rate = 0.1): number {
  const hawk = h * (V - C) / 2 + (1 - h) * V;
  const dove = (1 - h) * (V / 2);
  const avg = h * hawk + (1 - h) * dove;
  return clamp(h + rate * h * (hawk - avg) / Math.max(1, Math.abs(V) + Math.abs(C)), 0, 1);
}
export function hawkDovePath(h0: number, V: number, C: number, gens: number): number[] {
  const out = [h0];
  for (let g = 0; g < gens; g++) out.push(hawkDoveStep(out[out.length - 1], V, C, 1));
  return out;
}
