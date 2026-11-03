import { describe, expect, it } from "vitest";
import { gameConfigProblems, GAME_CONFIGS, GAME_IDS } from "@/lib/games/configs";
import * as E from "@/lib/games/economics";
import * as G from "@/lib/games/game-theory";
import { mulberry32 } from "@/lib/games/rng";

const PD: G.Matrix = [
  [[3, 3], [0, 5]],
  [[5, 0], [1, 1]],
];

describe("prisoner's dilemma", () => {
  it("scores the four outcomes", () => {
    expect([G.pdPoints("C", "C"), G.pdPoints("C", "D"), G.pdPoints("D", "C"), G.pdPoints("D", "D")]).toEqual([3, 0, 5, 1]);
  });
  it("tit for tat opens with C and copies", () => {
    const r = mulberry32(1);
    expect(G.pdNextMove("tit-for-tat", [], [], r)).toBe("C");
    expect(G.pdNextMove("tit-for-tat", ["C"], ["D"], r)).toBe("D");
  });
  it("grim trigger never forgives", () => {
    expect(G.pdNextMove("grim-trigger", ["C", "C"], ["D", "C"], mulberry32(1))).toBe("D");
  });
  it("tit for two tats needs two defections", () => {
    const r = mulberry32(1);
    expect(G.pdNextMove("tit-for-two-tats", ["C"], ["D"], r)).toBe("C");
    expect(G.pdNextMove("tit-for-two-tats", ["C", "C"], ["D", "D"], r)).toBe("D");
  });
  it("pavlov stays after a win and switches after a loss", () => {
    const r = mulberry32(1);
    expect(G.pdNextMove("pavlov", ["D"], ["C"], r)).toBe("D");
    expect(G.pdNextMove("pavlov", ["C"], ["D"], r)).toBe("D");
    expect(G.pdNextMove("pavlov", ["D"], ["D"], r)).toBe("C");
  });
  it("tft vs always-defect loses only the first round", () => {
    const m = G.pdMatch("tit-for-tat", "always-defect", 10, 0, mulberry32(2));
    expect(m.scoreA).toBe(9);
    expect(m.scoreB).toBe(14);
  });
  it("two cooperators earn 3 per round", () => {
    expect(G.pdMatch("tit-for-tat", "grim-trigger", 20, 0, mulberry32(3)).scoreA).toBe(60);
  });
  it("tournament ranks nice reciprocators above always-defect in a mostly nice field", () => {
    const t = G.pdTournament(["tit-for-tat", "grim-trigger", "always-cooperate", "always-defect", "tit-for-two-tats"], 50, 0, mulberry32(4));
    expect(t[t.length - 1].strategy === "always-defect" || t[0].strategy !== "always-defect").toBe(true);
    expect(t[0].strategy).not.toBe("always-defect");
  });
});

describe("matrices", () => {
  it("finds the PD equilibrium", () => {
    expect(G.pureNash(PD)).toEqual([[1, 1]]);
  });
  it("finds two equilibria in a coordination game and none in matching pennies", () => {
    expect(G.pureNash([[[2, 2], [0, 0]], [[0, 0], [1, 1]]])).toEqual([[0, 0], [1, 1]]);
    expect(G.pureNash([[[1, -1], [-1, 1]], [[-1, 1], [1, -1]]])).toEqual([]);
  });
  it("compares cell sets ignoring order", () => {
    expect(G.sameCells([[0, 0], [1, 1]], [[1, 1], [0, 0]])).toBe(true);
    expect(G.sameCells([[0, 0]], [[0, 0], [1, 1]])).toBe(false);
  });
  it("detects strict dominance and solves by elimination", () => {
    expect(G.isStrictlyDominated(PD, [0, 1], [0, 1], "row", 0)).toBe(true);
    expect(G.isStrictlyDominated(PD, [0, 1], [0, 1], "row", 1)).toBe(false);
    expect(G.iteratedElimination(PD)).toEqual({ rows: [1], cols: [1] });
  });
  it("mixes 50/50 in matching pennies", () => {
    const m = G.mixed2x2([[[1, -1], [-1, 1]], [[-1, 1], [1, -1]]]);
    expect(m!.p).toBeCloseTo(0.5);
    expect(m!.q).toBeCloseTo(0.5);
    expect(G.mixed2x2(PD)).toBeNull();
  });
});

describe("sequential games", () => {
  const tree: G.TreeNode = {
    id: "a",
    player: 0,
    moves: [
      { label: "Enter", next: { id: "b", player: 1, moves: [{ label: "Fight", next: { id: "l1", payoffs: [-1, 1] } }, { label: "Share", next: { id: "l2", payoffs: [2, 2] } }] } },
      { label: "Stay out", next: { id: "l3", payoffs: [0, 5] } },
    ],
  };
  it("solves entry deterrence by backward induction", () => {
    const s = G.solveTree(tree);
    expect(s.choice).toEqual({ a: 0, b: 1 });
    expect(s.value).toEqual([2, 2]);
    expect(G.treeHasTies(tree)).toBe(false);
    expect(G.decisionNodes(tree).map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("centipede pot doubles and takers get 3/4", () => {
    expect(G.centipedePot(4, 3)).toBe(32);
    expect(G.centipedeTake(4, 0)).toEqual({ taker: 3, other: 1 });
    expect(G.centipedeEnd(4, 6)).toBe(128);
  });
});

describe("other games", () => {
  it("second-price winner pays the second bid, first-price pays own", () => {
    expect(G.resolveAuction([50, 70, 60], "second")).toEqual({ winner: 1, price: 60 });
    expect(G.resolveAuction([50, 70, 60], "first")).toEqual({ winner: 1, price: 70 });
  });
  it("bots bid value in second-price and shade in first-price", () => {
    expect(G.botBid(80, 4, "second", mulberry32(1))).toBe(80);
    const b = G.botBid(80, 4, "first", mulberry32(1));
    expect(b).toBeGreaterThan(50);
    expect(b).toBeLessThan(80);
  });
  it("beauty contest crowd starts near level-1/2 and the target is 2/3 of the mean", () => {
    const crowd = G.crowdGuesses(200, 2 / 3, 0, null, mulberry32(5));
    const mean = crowd.reduce((s, x) => s + x, 0) / crowd.length;
    expect(mean).toBeGreaterThan(20);
    expect(mean).toBeLessThan(45);
    expect(G.contestTarget([30, 60], 2 / 3)).toBeCloseTo(30);
    expect(G.contestRank(30, [10, 29, 50], 30)).toBe(1);
  });
  it("ultimatum responder accepts at threshold", () => {
    expect(G.ultimatumAccepts(3, 3)).toBe(true);
    expect(G.ultimatumAccepts(2, 3)).toBe(false);
  });
  it("monty hall: switching wins about 2/3", () => {
    const n = 20000;
    expect(G.simulateMonty(n, true, 3, mulberry32(6)) / n).toBeCloseTo(2 / 3, 1);
    expect(G.simulateMonty(n, false, 3, mulberry32(7)) / n).toBeCloseTo(1 / 3, 1);
  });
  it("the goalie leans toward your favourite side", () => {
    const r = mulberry32(8);
    let left = 0;
    for (let i = 0; i < 2000; i++) if (G.goalieDive(["L", "L", "L", "L", "R"], 5, r) === "L") left++;
    expect(left / 2000).toBeGreaterThan(0.7);
  });
  it("hawk-dove settles at V/C", () => {
    const p = G.hawkDovePath(0.1, 4, 10, 400);
    expect(p[p.length - 1]).toBeCloseTo(0.4, 2);
  });
});

describe("economics", () => {
  const dem = { a: 100, b: 2 };
  const sup = { a: 10, b: 1 };
  it("finds equilibrium with and without a tax", () => {
    expect(E.equilibrium(dem, sup)).toEqual({ price: 30, qty: 40 });
    const t = E.equilibrium(dem, sup, 6);
    expect(t.price).toBeCloseTo(32);
    expect(t.qty).toBeCloseTo(36);
  });
  it("labels shortages and surpluses", () => {
    expect(E.marketGap(dem, sup, 20).label).toBe("shortage");
    expect(E.marketGap(dem, sup, 40).label).toBe("surplus");
    expect(E.marketGap(dem, sup, 30).label).toBe("balanced");
  });
  it("lemonade: unsold cups cost money", () => {
    const d = E.lemonadeDay({ weather: "sunny", price: 20, cups: 100, costPerCup: 5, maxPrice: 40 });
    expect(d.demand).toBe(50);
    expect(d.sold).toBe(50);
    expect(d.profit).toBe(50 * 20 - 100 * 5);
    expect(E.lemonadeBestPrice(5, 40)).toBe(22.5);
  });
  it("arc elasticity", () => {
    expect(E.arcElasticity(10, 12, 100, 80)).toBeCloseTo(11.11 / 9.09 * 1, 1);
    expect(E.classifyElasticity(0.3)).toBe("inelastic");
    expect(E.classifyElasticity(2)).toBe("elastic");
  });
  it("compounding with no deposits and no inflation doubles in about 72/r years", () => {
    const pts = E.compound({ start: 1000, monthly: 0, rate: 8, inflation: 0, years: 9 });
    expect(pts[9].nominal / 1000).toBeCloseTo(2, 0);
    const real = E.compound({ start: 1000, monthly: 0, rate: 6, inflation: 6, years: 10 });
    expect(real[10].real).toBeCloseTo(1000, -2);
  });
  it("central bank: neutral rate keeps a calm economy calm, cheap money heats it", () => {
    const calm = E.cbStep(E.CB_START, 3);
    expect(calm.inflation).toBeCloseTo(2);
    expect(calm.unemployment).toBeCloseTo(5);
    let s = E.CB_START;
    for (let i = 0; i < 6; i++) s = E.cbStep(s, 0);
    expect(s.inflation).toBeGreaterThan(3);
    expect(E.cbLoss(E.CB_START)).toBe(0);
  });
  it("commons: overfishing collapses the stock, sustainable catches keep it", () => {
    let st = 600;
    for (let i = 0; i < 10; i++) st = E.commonsSeason(st, [60, 60], 0.5, 1000).next;
    expect(st).toBeGreaterThan(400);
    let bad = 600;
    for (let i = 0; i < 10; i++) bad = E.commonsSeason(bad, [200, 200], 0.5, 1000).next;
    expect(bad).toBe(0);
  });
  it("comparative advantage", () => {
    const a = { name: "A", hours: 10, perHour: [4, 2] as [number, number] };
    expect(E.produce(a, 5)).toEqual([20, 10]);
    expect(E.opportunityCost(a)).toBe(0.5);
    expect(E.afterTrade([20, 0], [0, 20], 5, 2)).toEqual({ a: [15, 10], b: [5, 10] });
  });
  it("monopoly price is (a + c) / 2 and has deadweight loss", () => {
    expect(E.monopolyPrice(100, 20)).toBe(60);
    const m = E.monopolyAt(100, 1, 20, 60);
    expect(m.q).toBe(40);
    expect(m.profit).toBe(1600);
    expect(m.dwl).toBe(800);
  });
  it("lemons: blind offers lose money on average", () => {
    expect(E.lemonsExpectedProfit(60, 1.5)).toBeLessThan(0);
    expect(E.lemonsDraw(0, mulberry32(1))).toBeNull();
  });
});

describe("configs", () => {
  it("every game has a schema", () => {
    expect(GAME_IDS.length).toBe(Object.keys(GAME_CONFIGS).length);
  });
  it("rejects ambiguous trees and unsolvable dominance puzzles", () => {
    const tie = { tree: { id: "a", player: 0, moves: [{ label: "x", next: { id: "l1", payoffs: [1, 0] } }, { label: "y", next: { id: "l2", payoffs: [1, 2] } }] } };
    expect(gameConfigProblems("game-tree", tie).join()).toMatch(/ambiguous/);
    const coord = { rows: ["A", "B"], cols: ["A", "B"], payoffs: [[[2, 2], [0, 0]], [[0, 0], [1, 1]]] };
    expect(gameConfigProblems("dominance", coord).join()).toMatch(/exactly one/);
    expect(gameConfigProblems("dominance", { rows: ["C", "D"], cols: ["C", "D"], payoffs: PD })).toEqual([]);
  });
});
