export type SliderOption = { value: number; label: string };

export type SliderDef = {
  id: string;
  label: string;
  /** Continuous range... */
  min?: number;
  max?: number;
  step?: number;
  /** ...or a discrete list of choices (slider moves over the indices). */
  options?: SliderOption[];
  default: number;
  unit?: string;
  help?: string;
};

export type OutputDef = {
  id: string;
  label: string;
  unit?: string;
  digits?: number;
};

export type GaugeDef = {
  output: string;
  label: string;
  /** Upper end of the gauge. Can depend on the inputs (e.g. GPU memory). */
  max: (v: Values) => number;
  /** Value at which the gauge turns red. Defaults to max. */
  danger?: (v: Values) => number;
};

export type ChartSpec =
  | {
      kind: "line";
      title: string;
      xLabel: string;
      yLabel: string;
      logX?: boolean;
      logY?: boolean;
      series: { label: string; tone: "gold" | "green" | "red" | "muted"; points: [number, number][] }[];
      marker?: { x: number; y: number; label: string };
    }
  | {
      kind: "bars";
      title: string;
      unit?: string;
      bars: { label: string; value: number; tone: "gold" | "green" | "red" | "muted" }[];
    };

export type Values = Record<string, number>;

export type SimDef = {
  id: string;
  title: string;
  sliders: SliderDef[];
  outputs: OutputDef[];
  gauges: GaugeDef[];
  compute: (v: Values) => Values;
  chart: (v: Values, out: Values) => ChartSpec;
};

const pow2 = (from: number, to: number, fmt: (n: number) => string = String): SliderOption[] => {
  const out: SliderOption[] = [];
  for (let n = from; n <= to; n *= 2) out.push({ value: n, label: fmt(n) });
  return out;
};
const kTokens = (n: number) => (n >= 1024 ? `${n / 1024}k` : String(n));

/* ---------------- Sampling: temperature / top-k / top-p ---------------- */

export const SAMPLING_TOKENS = ["fast", "hot", "expensive", "busy", "loud", "good", "slow", "purple"];
export const SAMPLING_LOGITS = [3.2, 2.9, 2.6, 1.8, 1.2, 1.0, 0.4, -1.5];

export function sampleDistribution(logits: number[], temperature: number, topK: number, topP: number): number[] {
  const t = Math.max(temperature, 1e-3);
  const scaled = logits.map((l) => l / t);
  const m = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - m));
  const z = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / z);
  const order = probs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  const keep = new Set<number>();
  let cum = 0;
  for (const [p, i] of order) {
    if (keep.size >= topK) break;
    if (keep.size > 0 && cum >= topP) break;
    keep.add(i);
    cum += p;
  }
  const kept = probs.map((p, i) => (keep.has(i) ? p : 0));
  const kz = kept.reduce((a, b) => a + b, 0);
  return kept.map((p) => p / kz);
}

const sampling: SimDef = {
  id: "sampling",
  title: "Sampler tuning desk",
  sliders: [
    { id: "temperature", label: "Temperature", min: 0.05, max: 2, step: 0.05, default: 1, help: "Divides every logit before softmax." },
    { id: "topK", label: "Top-k", min: 1, max: 8, step: 1, default: 8, help: "Keep only the k most likely tokens." },
    { id: "topP", label: "Top-p", min: 0.1, max: 1, step: 0.05, default: 1, help: "Keep the smallest set whose probability reaches p." },
  ],
  outputs: [
    { id: "topProb", label: "Top token", unit: "%", digits: 1 },
    { id: "entropy", label: "Entropy", unit: "bits", digits: 2 },
    { id: "candidates", label: "Candidates", digits: 0 },
  ],
  gauges: [
    { output: "topProb", label: "Top-token probability", max: () => 100 },
    { output: "entropy", label: "Randomness (entropy)", max: () => 3 },
  ],
  compute: (v) => {
    const p = sampleDistribution(SAMPLING_LOGITS, v.temperature, v.topK, v.topP);
    const entropy = -p.reduce((a, x) => (x > 0 ? a + x * Math.log2(x) : a), 0);
    return { topProb: Math.max(...p) * 100, entropy, candidates: p.filter((x) => x > 0).length };
  },
  chart: (v) => {
    const p = sampleDistribution(SAMPLING_LOGITS, v.temperature, v.topK, v.topP);
    return {
      kind: "bars",
      title: 'Next token after "The GPU is very"',
      unit: "%",
      bars: SAMPLING_TOKENS.map((t, i) => ({ label: t, value: p[i] * 100, tone: p[i] === 0 ? "muted" : i === 0 ? "gold" : "green" })),
    };
  },
};

/* ---------------- Attention cost ---------------- */

const attentionCost: SimDef = {
  id: "attention-cost",
  title: "Attention cost meter",
  sliders: [
    { id: "seqLen", label: "Sequence length", options: pow2(512, 131072, kTokens), default: 4096, unit: "tokens" },
    { id: "heads", label: "Query heads", min: 1, max: 128, step: 1, default: 32 },
    { id: "headDim", label: "Head dim", options: pow2(32, 256), default: 128 },
  ],
  outputs: [
    { id: "scoresGB", label: "Score matrix (1 layer, fp16)", unit: "GB", digits: 2 },
    { id: "attnTflop", label: "Attention FLOPs (1 layer)", unit: "TFLOP", digits: 3 },
  ],
  gauges: [{ output: "scoresGB", label: "Materialised scores vs 80 GB GPU", max: () => 80 }],
  compute: (v) => {
    const n = v.seqLen;
    const scoresGB = (n * n * v.heads * 2) / 1e9;
    // QK^T and (softmax)V are each 2*n*n*d FLOPs per head
    const attnTflop = (4 * n * n * v.headDim * v.heads) / 1e12;
    return { scoresGB, attnTflop };
  },
  chart: (v) => {
    const pts: [number, number][] = pow2(512, 131072).map(({ value: n }) => [n, (n * n * v.heads * 2) / 1e9]);
    return {
      kind: "line",
      title: "Score-matrix memory vs sequence length",
      xLabel: "tokens",
      yLabel: "GB",
      logX: true,
      logY: true,
      series: [{ label: "n² scores", tone: "gold", points: pts }],
      marker: { x: v.seqLen, y: (v.seqLen * v.seqLen * v.heads * 2) / 1e9, label: "you" },
    };
  },
};

/* ---------------- KV cache calculator ---------------- */

export function kvBytesPerToken(layers: number, kvHeads: number, headDim: number, bytesPerElem: number) {
  return 2 * layers * kvHeads * headDim * bytesPerElem;
}

const kvCache: SimDef = {
  id: "kv-cache",
  title: "KV-cache memory calculator",
  sliders: [
    { id: "layers", label: "Layers", min: 1, max: 128, step: 1, default: 32 },
    { id: "kvHeads", label: "KV heads", options: pow2(1, 64), default: 8, help: "Equal to query heads for MHA, fewer for GQA, 1 for MQA." },
    { id: "headDim", label: "Head dim", options: pow2(64, 256), default: 128 },
    {
      id: "kvBytes",
      label: "KV dtype",
      options: [
        { value: 4, label: "fp32" },
        { value: 2, label: "fp16" },
        { value: 1, label: "fp8" },
      ],
      default: 2,
    },
    { id: "seqLen", label: "Context length", options: pow2(512, 131072, kTokens), default: 8192, unit: "tokens" },
    { id: "batch", label: "Concurrent sequences", min: 1, max: 256, step: 1, default: 1 },
    { id: "paramsB", label: "Model size", min: 1, max: 80, step: 1, default: 8, unit: "B params" },
    {
      id: "gpuGB",
      label: "GPU memory",
      options: [
        { value: 24, label: "24 GB" },
        { value: 40, label: "40 GB" },
        { value: 48, label: "48 GB" },
        { value: 80, label: "80 GB" },
        { value: 141, label: "141 GB" },
      ],
      default: 80,
    },
  ],
  outputs: [
    { id: "kvPerTokenKB", label: "KV per token", unit: "KB", digits: 1 },
    { id: "kvPerSeqGB", label: "KV per sequence", unit: "GB", digits: 2 },
    { id: "kvTotalGB", label: "KV total", unit: "GB", digits: 1 },
    { id: "weightsGB", label: "Weights (fp16)", unit: "GB", digits: 1 },
    { id: "totalGB", label: "Total needed", unit: "GB", digits: 1 },
    { id: "budgetGB", label: "Usable (90%)", unit: "GB", digits: 1 },
    { id: "maxBatch", label: "Max sequences that fit", digits: 0 },
  ],
  gauges: [
    { output: "totalGB", label: "Memory used vs usable budget", max: (v) => v.gpuGB, danger: (v) => v.gpuGB * 0.9 },
    { output: "kvTotalGB", label: "KV cache", max: (v) => v.gpuGB },
  ],
  compute: (v) => {
    const perToken = kvBytesPerToken(v.layers, v.kvHeads, v.headDim, v.kvBytes);
    const kvPerSeqGB = (perToken * v.seqLen) / 1e9;
    const kvTotalGB = kvPerSeqGB * v.batch;
    const weightsGB = v.paramsB * 2;
    const budgetGB = v.gpuGB * 0.9;
    const maxBatch = Math.max(0, Math.floor((budgetGB - weightsGB) / kvPerSeqGB));
    return {
      kvPerTokenKB: perToken / 1e3,
      kvPerSeqGB,
      kvTotalGB,
      weightsGB,
      totalGB: weightsGB + kvTotalGB,
      budgetGB,
      maxBatch,
    };
  },
  chart: (v, out) => {
    const perToken = kvBytesPerToken(v.layers, v.kvHeads, v.headDim, v.kvBytes);
    const lens = pow2(512, 131072).map((o) => o.value);
    return {
      kind: "line",
      title: `Total memory vs context (batch ${v.batch})`,
      xLabel: "context tokens",
      yLabel: "GB",
      logX: true,
      series: [
        { label: "weights + KV", tone: "gold", points: lens.map((n) => [n, v.paramsB * 2 + (perToken * n * v.batch) / 1e9]) },
        { label: "usable budget", tone: "red", points: lens.map((n) => [n, v.gpuGB * 0.9]) },
      ],
      marker: { x: v.seqLen, y: out.totalGB, label: "you" },
    };
  },
};

/* ---------------- Roofline ---------------- */

export const GPUS = [
  { value: 0, label: "L4", tflops: 121, tbs: 0.3 },
  { value: 1, label: "A100 80GB", tflops: 312, tbs: 2.0 },
  { value: 2, label: "H100 SXM", tflops: 989, tbs: 3.35 },
];

export function roofline(peakTflops: number, bwTBs: number, intensity: number) {
  // FLOP/byte x TB/s = TFLOP/s
  return Math.min(peakTflops, intensity * bwTBs);
}

const rooflineSim: SimDef = {
  id: "roofline",
  title: "Roofline explorer",
  sliders: [
    { id: "gpu", label: "GPU", options: GPUS.map(({ value, label }) => ({ value, label })), default: 2 },
    { id: "batch", label: "Decode batch size", options: pow2(1, 1024), default: 1, unit: "seqs" },
    {
      id: "weightBytes",
      label: "Weight dtype",
      options: [
        { value: 2, label: "fp16" },
        { value: 1, label: "int8" },
        { value: 0.5, label: "int4" },
      ],
      default: 2,
    },
    { id: "paramsB", label: "Model size", min: 1, max: 70, step: 1, default: 8, unit: "B params" },
  ],
  outputs: [
    { id: "intensity", label: "Arithmetic intensity", unit: "FLOP/B", digits: 1 },
    { id: "ridge", label: "Ridge point", unit: "FLOP/B", digits: 0 },
    { id: "attainable", label: "Attainable", unit: "TFLOP/s", digits: 1 },
    { id: "utilisation", label: "Compute used", unit: "%", digits: 1 },
    { id: "computeBound", label: "Compute-bound (1 = yes)", digits: 0 },
    { id: "tokensPerSec", label: "Tokens/s (all seqs)", digits: 0 },
  ],
  gauges: [
    { output: "utilisation", label: "Tensor-core utilisation", max: () => 100 },
    { output: "tokensPerSec", label: "Throughput (tokens/s)", max: () => 60000 },
  ],
  compute: (v) => {
    const gpu = GPUS[v.gpu] ?? GPUS[2];
    const params = v.paramsB * 1e9;
    // One decode step of the weight GEMMs: 2*P*B FLOPs, P*bytes of weights read once (activations and KV ignored).
    const flops = 2 * params * v.batch;
    const bytes = params * v.weightBytes;
    const intensity = flops / bytes;
    const ridge = gpu.tflops / gpu.tbs;
    const attainable = roofline(gpu.tflops, gpu.tbs, intensity);
    const stepSeconds = Math.max(flops / (gpu.tflops * 1e12), bytes / (gpu.tbs * 1e12));
    return {
      intensity,
      ridge,
      attainable,
      utilisation: (attainable / gpu.tflops) * 100,
      computeBound: intensity >= ridge ? 1 : 0,
      tokensPerSec: v.batch / stepSeconds,
    };
  },
  chart: (v, out) => {
    const gpu = GPUS[v.gpu] ?? GPUS[2];
    const xs = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
    return {
      kind: "line",
      title: `${gpu.label} roofline`,
      xLabel: "FLOP / byte",
      yLabel: "TFLOP/s",
      logX: true,
      logY: true,
      series: [{ label: "roof", tone: "gold", points: xs.map((x) => [x, roofline(gpu.tflops, gpu.tbs, x)]) }],
      marker: { x: out.intensity, y: out.attainable, label: `batch ${v.batch}` },
    };
  },
};

/* ---------------- Registry ---------------- */

export const SIMS: Record<string, SimDef> = {
  [sampling.id]: sampling,
  [attentionCost.id]: attentionCost,
  [kvCache.id]: kvCache,
  [rooflineSim.id]: rooflineSim,
};

export function getSim(id: string): SimDef | undefined {
  return SIMS[id];
}

export function defaultValues(sim: SimDef, overrides: Values = {}): Values {
  const v: Values = {};
  for (const s of sim.sliders) v[s.id] = overrides[s.id] ?? s.default;
  return v;
}
