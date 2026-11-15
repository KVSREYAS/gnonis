# LLM inference: calculation questions replaced with concept questions

Request from Sreyas: "for llm inference.. get rid of this stupid calculation questions.. give me real questions which test the concept".

Base: PR #19 head `b7db51d72a99e02b192aca9e2e3e40faf27b1b6b` (the chunked-prefill and inference-review branch; it was not merged into main yet when this was built).

## Summary

- Every graded item in the course was inventoried: 167 exercises, with the 12 module tests expanded into their 71 parts, for 226 items in total (table below).
- **87 replaced**: all 51 standalone `Predict` number drills except one, 33 of the 34 `predict` parts in module tests, and 3 concept-page MCQs that were just a formula with the numbers filled in (KV bytes per token, an int8 scale, and end-to-end latency).
- **139 kept**: conceptual MCQs, Fill and Ordering items, every Code and Debug exercise, the simulators, steppers and slider diagrams, plus two number items where the number is the point:
  - `gemv-ai`: batch-1 decode runs at about 1 FLOP/byte. The prompt is now framed as reasoning, and only the wording changed, so its hash is the same.
  - The `row` module test, part 6 (2 of 5 drafts accepted, so 3 tokens come out): this tests the correction-token rule, not arithmetic.
- The new questions are why/what-happens-if questions, diagnoses (TTFT vs TPOT, which bottleneck dominates, a prefix cache that broke), predicting which way a metric moves when you change X, picking a technique for a constraint, trade-offs (batch vs latency, chunk size, block size, group size, TP vs PP vs DP, weight-only vs W8A8), spotting the wrong claim, and ordering causal steps.
- Each MCQ has 4 options. Every wrong option is a plausible misconception, and the explanation says why each one is wrong.
- **Answer positions are now spread out.** The renderer does not shuffle options, and before this change 62 of 76 MCQ answers were option 2. The new questions place the correct answer by a hash of the exercise id, which gives 75 / 32 / 29 / 22 across positions 1–4. The kept MCQs still mostly use option 2 (see Risks).

## Ids and progress

No id or slug was renamed. Each replacement reuses the old exercise id in place, so progress keys stay the same. Each replacement does change the answer-bearing fields, so anyone who solved the old version sees it marked **Updated** until they solve the new one.

**Standalone exercises whose meaning changed (54):** `tokens-per-essay`, `embedding-params`, `total-latency`, `score-count`, `group-size`, `quad-factor`, `llama3-per-token`, `max-seqs`, `kv-cache-concepts#concept-check`, `square-ai`, `ridge-h100`, `a100-limit`, `static-waste`, `step-time`, `batch-throughput`, `budget-left`, `stall-ms`, `chunk-count` (now an Ordering), `kv-reread`, `waste-slab`, `blocks-needed`, `cow-blocks`, `pool-size`, `swap-time`, `int4-70b`, `e4m3-max`, `q-value`, `group-bits`, `smooth-s`, `fp8-seqs`, `quant-concepts#concept-check`, `s-size`, `online-l`, `tile-bytes`, `fa3-util`, `expected-tokens`, `low-alpha`, `speedup`, `tree-nodes`, `allreduce-count`, `ring-bytes`, `pp-mem`, `bubble`, `mixtral-mem`, `mixtral-speed`, `e2e-latency`, `prefix-saving`, `q4-bits`, `q4-size`, `transfer-ms`, `serving-concepts#concept-check`, `littles-law`, `admit-count`, `mbu`. All of them were Predict, except the three concept checks, which were MCQ. They are now MCQ, apart from `chunk-count`, which is an Ordering.

**Module tests with changed parts (12, same ids):**

| Test | Changed parts |
| --- | --- |
| `heist` | 3 |
| `showdown` | 2, 4 |
| `docks` | 2, 4 |
| `ridge` | 1, 3 |
| `boulevard` | 2, 3, 5 |
| `pier` | 1, 3, 6 |
| `quarter` | 1, 3, 5 |
| `gardens` | 1, 3 (now an ordering), 6 |
| `row` | 1, 3 |
| `shard` | 1, 2, 4, 6 |
| `strip` | 1, 3, 6 |
| `peak` | 1, 2, 4, 6, 8 |

Part numbers are 1-based. The time limits are now 45 s per question, up from about 30 s, because the questions take longer to read. The briefings were updated to match.

## Teaching text added (so nothing is tested before it is taught)

- **08 Heads, MQA and GQA:** each query head keeps its own pattern; only K and V are shared.
- **12 Sizing the cache:** the Llama 3 8B worked example (128 KiB per token), and the point that query heads are not part of the formula.
- **16 Arithmetic intensity:** for a square matmul, FLOPs grow as n³ and bytes as n², which gives about 1,365 FLOP/byte at 4,096.
- **24 PagedAttention:** the block-size trade-off.
- **28 Quantization:**
  - why inference uses E4M3
  - 8-bit tensor cores run at about 2x the 16-bit FLOP/s, so W8A8 helps compute-bound prefill, while weight-only formats mainly help decode
- **30 SmoothQuant:** what α controls.

Every other new question uses ideas that the module's concept page or an earlier lesson card already teaches.

## Fun meter

- 45 Serving metrics and prefix caching: 3 → 4. It now has the timestamp-breaks-the-prefix-cache diagnosis.
- 49 Architecture of a tiny server: 3 → 4.

All the other ratings stay. The lessons that were rated 5 were rated for their simulators and code, and those are unchanged.

## Notes

- **Code exercises are all kept.** A few just implement a formula: `intensity-code`, `step-code`, `tp-code`, `kv-code` and `getaway-plan`. They stay because writing the function is the exercise, and the request was about the number drills. They are candidates for a later pass if Sreyas wants it.
- **Simulators are kept.** Some, such as `llama2-calc`, set the knobs to a target, but they are interactive rather than drills.
- **Answer bias in kept MCQs:** about 60 of the kept MCQs still have option 2 as the answer. Re-ordering their options would mark them all Updated, so it was left for a separate decision.

## Full inventory

Class tells you why each item was replaced or kept. "Arithmetic" means you plug numbers into a formula given on the card.

| Lesson | Exercise | Type | Class | Action | Original prompt |
| --- | --- | --- | --- | --- | --- |
| 01-what-is-a-token | what-model-sees | MCQ | Conceptual | Kept | What does the model itself actually receive as input? |
| 01-what-is-a-token | tokens-per-essay | Predict | Arithmetic | Replaced → MCQ: You send the same 1,200-word essay to a model twice: once in English, once translated into a language the tok… | Using the rule of thumb of about 0.75 English words per token, roughly how many tokens is a 1,200-word blog p… |
| 02-the-forward-pass | embedding-params | Predict | Arithmetic | Replaced → MCQ: Llama 3 grew the vocabulary from Llama 2's 32,000 tokens to 128,256. What does a bigger vocabulary buy, and w… | Llama 3 8B has a vocabulary of 128,256 and a hidden size of 4,096. How many parameters are in its embedding t… |
| 02-the-forward-pass | block-flow | Stepper | Interactive | Kept | Step through one block and watch where the hidden state goes. |
| 02-the-forward-pass | pipeline-order | Ordering | Conceptual | Kept | Put the stages of a decoder-only forward pass in order. |
| 03-logits-to-tokens | tune-sampler | Simulator | Interactive | Kept | Make the sampler nearly deterministic. Get the top token to 90% or more. There are two different knobs that c… |
| 03-logits-to-tokens | temperature-effect | MCQ | Conceptual | Kept | You raise temperature from 1.0 to 1.5. What happens to the distribution? |
| 03-logits-to-tokens | softmax-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Implement softmax(logits, temperature) in pure Python. It must return probabilities that sum to 1, respect te… |
| 04-prefill-and-decode | decode-steps | Stepper | Interactive | Kept | Watch a model answer "The cat sat". Gold tokens are processed in that step. |
| 04-prefill-and-decode | total-latency | Predict | Arithmetic | Replaced → MCQ: Server A: TTFT 150 ms, TPOT 40 ms. Server B: TTFT 600 ms, TPOT 15 ms. You run code autocomplete (about 5 outp… | A server has a TTFT of 200 ms and a steady time-per-output-token of 20 ms. How long until a 101-token answer … |
| 04-prefill-and-decode | bound-fill | Fill | Conceptual | Kept | At batch size 1, prefill of a long prompt is usually {{0}}-bound, while decode is usually {{1}}-bound. |
| 05-boss-the-forward-pass | heist part 1 | mcq (boss) | Conceptual | Kept | What does the LM head produce at each position? |
| 05-boss-the-forward-pass | heist part 2 | ordering (boss) | Conceptual | Kept | Order the steps of one generated token at decode time. |
| 05-boss-the-forward-pass | heist part 3 | predict (boss) | Arithmetic | Replaced → mcq: Same model, same GPU: a 2,000-token prompt prefills in about 0.1 s, but generating 2,000 output tokens takes … | Roughly how many GFLOPs does an 8-billion-parameter model need per token in a forward pass? |
| 05-boss-the-forward-pass | heist part 4 | fill (boss) | Conceptual | Kept | Setting top-k to {{0}} or temperature close to {{1}} gives greedy decoding. |
| 05-boss-the-forward-pass | heist part 5 | mcq (boss) | Conceptual | Kept | Your chatbot feels slow to *start* answering, but streams quickly once it begins. Which number is bad? |
| 06-queries-keys-values | formula-fill | Fill | Conceptual | Kept | Attention(Q, K, V) = softmax(Q Kᵀ / {{0}}) {{1}} |
| 06-queries-keys-values | why-scale | MCQ | Conceptual | Kept | Why divide the scores by √d_k? |
| 06-queries-keys-values | score-count | Predict | Arithmetic | Replaced → MCQ: During decode, the sequence already holds t tokens and one new token arrives. How many new attention scores d… | A sequence has 8 tokens. How many query-key scores does ONE attention head compute (before masking)? |
| 07-causal-masking | mask-walkthrough | Stepper | Interactive | Kept | Step through the attention matrix for "I love GPUs !". Rows are queries and columns are keys. |
| 07-causal-masking | mask-order | MCQ | Conceptual | Kept | Where must the causal mask be applied? |
| 07-causal-masking | leaky-mask | Debug | Code | Kept (code stays per brief; see notes for formula-only ones) | This helper should softmax row i using keys 0..i only. One line leaks a future token. Tap it. |
| 08-heads-mha-gqa | head-fill | Fill | Conceptual | Kept | In MHA every {{0}} head has its own K/V head. MQA shares {{1}} K/V head across all of them, and GQA sits in b… |
| 08-heads-mha-gqa | group-size | Predict | Arithmetic | Replaced → MCQ: A model is converted from MHA with 32 KV heads to GQA with 8 KV heads, keeping its 32 query heads. At decode … | Llama 3 8B has 32 query heads and 8 KV heads. How many query heads share each KV head? |
| 08-heads-mha-gqa | gqa-why | MCQ | Conceptual | Kept | What is the main inference win from GQA? |
| 09-the-quadratic-bill | quad-factor | Predict | Arithmetic | Replaced → MCQ: Context grows from 4k to 16k tokens. Prefill's attention work grows about 16x, but the attention work for eac… | You grow the context from 4k to 16k tokens. By what factor does the number of attention scores per head grow? |
| 09-the-quadratic-bill | blow-the-budget | Simulator | Interactive | Kept | With 32 heads, find the context length at which materialising ONE layer's fp16 score matrix would need more t… |
| 09-the-quadratic-bill | attend-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Implement attend(q, keys, values) for a single query in pure Python: scaled dot-product scores, a stable soft… |
| 10-boss-attention | showdown part 1 | fill (boss) | Conceptual | Kept | Scores are scaled by {{0}} and the mask sets future scores to {{1}} before softmax. |
| 10-boss-attention | showdown part 2 | predict (boss) | Arithmetic | Replaced → mcq: Llama 3 70B has 64 query heads but only 8 KV heads. What did its designers trade? | Llama 3 70B has 64 query heads and 8 KV heads. What is the GQA group size? |
| 10-boss-attention | showdown part 3 | mcq (boss) | Conceptual | Kept | Which variant stores the fewest bytes of KV cache per token (same layers and head size)? |
| 10-boss-attention | showdown part 4 | predict (boss) | Arithmetic | Replaced → mcq: At very long prompts, which part of the forward pass ends up dominating prefill compute? | Context goes from 8k to 32k tokens. How many times more attention scores per head? |
| 10-boss-attention | showdown part 5 | ordering (boss) | Conceptual | Kept | Order one head's attention computation. |
| 11-why-cache | cache-growth | Stepper | Interactive | Kept | Watch one layer's KV cache during generation. Gold entries are computed this step, and grey ones are read fro… |
| 11-why-cache | why-not-q | MCQ | Conceptual | Kept | Why is there a KV cache but no Q cache? |
| 11-why-cache | what-is-read | MCQ | Conceptual | Kept | With a KV cache, what must a decode step still read from GPU memory? |
| 12-sizing-the-cache | formula | Fill | Conceptual | Kept | KV bytes per token = {{0}} × layers × {{1}} × head_dim × bytes per element |
| 12-sizing-the-cache | llama3-per-token | Predict | Arithmetic | Replaced → MCQ: Which change does NOT shrink the KV cache per token? | Llama 3 8B has 32 layers, 8 KV heads and a head dim of 128, with an fp16 cache (2 bytes). How many bytes of K… |
| 12-sizing-the-cache | llama2-calc | Simulator | Interactive | Kept | Llama 2 7B uses full multi-head attention: 32 layers, 32 KV heads, head dim 128, fp16. Set the calculator to … |
| 13-the-memory-budget | max-seqs | Predict | Arithmetic | Replaced → MCQ: Llama 3 8B in fp16 on an 80 GB GPU (90% used) fits about 52 sequences of 8k tokens. You switch to a 4-bit ver… | Llama 3 8B in fp16 (16 GB of weights) on an 80 GB GPU, using 90% of memory. Each 8k-token sequence needs 1.07… |
| 13-the-memory-budget | fit-sixteen | Simulator | Interactive | Kept | Product wants 16 simultaneous 32k-token conversations on Llama 3 8B. As configured, it does not fit. Change t… |
| 13-the-memory-budget | wrong-heads | Debug | Code | Kept (code stays per brief; see notes for formula-only ones) | This estimator reads a Hugging Face config, but it overestimates Llama 3's cache by 4x. Tap the buggy line. |
| 13-the-memory-budget | capacity-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write max_sequences(gpu_gb, params_b, layers, kv_heads, head_dim, seq_len, kv_bytes=2, util=0.9). It returns … |
| 14-boss-cache-docks | docks part 1 | mcq (boss) | Conceptual | Kept | Which of these is NOT stored in the KV cache? |
| 14-boss-cache-docks | docks part 2 | predict (boss) | Arithmetic | Replaced → mcq: When does a request's KV cache grow? | A model has 40 layers, 8 KV heads, head dim 128, fp16. KV bytes per token, in KiB (1 KiB = 1,024 bytes)? |
| 14-boss-cache-docks | docks part 3 | fill (boss) | Conceptual | Kept | Switching the cache from fp16 to fp8 makes it {{0}} as large, and moving from MHA with 32 KV heads to GQA wit… |
| 14-boss-cache-docks | docks part 4 | predict (boss) | Arithmetic | Replaced → mcq: Batch size 1. Token 50 of a long answer streams noticeably faster than token 20,000. Same model, same GPU. Wh… | Llama 3 8B fp16 cache: 128 KiB per token. How many GiB for one 16,384-token sequence? |
| 14-boss-cache-docks | docks part 5 | mcq (boss) | Conceptual | Kept | You double max context from 8k to 16k on the same GPU. Roughly what happens to the number of full-length sequ… |
| 15-memory-hierarchy | hierarchy-order | Ordering | Conceptual | Kept | Order these from fastest (and smallest) to slowest (and largest), from a GPU kernel's point of view. |
| 15-memory-hierarchy | where-weights | MCQ | Conceptual | Kept | Where do the weights of an 8B model live while it is being served on one GPU? |
| 16-arithmetic-intensity | square-ai | Predict | Arithmetic | Replaced → MCQ: A large square matmul (4096 × 4096 times 4096 × 4096) reaches over 1,000 FLOP/byte, while a batch-1 GEMV sits… | A 4096 x 4096 by 4096 x 4096 matmul in fp16 does 2·n³ FLOPs and moves two inputs plus one output (3·n² elemen… |
| 16-arithmetic-intensity | gemv-ai | Predict | Numeric insight | Kept: the number (about 1 FLOP/byte) is the insight. Prompt reframed as reasoning. | Now batch size 1: a [1 x 4096] vector times a [4096 x 4096] fp16 weight matrix. Ignoring the tiny input and o… |
| 16-arithmetic-intensity | intensity-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write matmul_intensity(m, k, n, bytes_per_elem=2) for an [m x k] @ [k x n] matmul. It counts 2·m·k·n FLOPs an… |
| 17-the-roofline | roof-fill | Fill | Conceptual | Kept | Attainable FLOP/s = min({{0}}, arithmetic intensity × {{1}}) |
| 17-the-roofline | ridge-h100 | Predict | Arithmetic | Replaced → MCQ: New GPU generations have added peak FLOP/s faster than memory bandwidth. What does that do to the ridge point… | An H100 SXM does about 989 dense BF16 TFLOP/s with 3.35 TB/s of HBM bandwidth. Where is its ridge point in FL… |
| 17-the-roofline | climb-the-roof | Simulator | Interactive | Kept | Decoding an 8B fp16 model on an H100 at batch 1 uses a sliver of the tensor cores. Raise the batch size until… |
| 17-the-roofline | int4-effect | MCQ | Conceptual | Kept | You switch weights from fp16 to int4 (with the same batch). What happens to the decode operating point on the… |
| 18-decode-speed-limit | a100-limit | Predict | Arithmetic | Replaced → MCQ: You move an 8B fp16 model's batch-1 decode from an H100 (989 TFLOP/s, 3.35 TB/s) to an A100 (312 TFLOP/s, 2.0… | An A100 has about 2.0 TB/s of HBM bandwidth. What is the batch-1 decode ceiling for an 8B fp16 model (16 GB o… |
| 18-decode-speed-limit | faster-single-user | Simulator | Interactive | Kept | One user and batch 1. Get an 8B model past 400 tokens/s. You may pick any GPU and any weight dtype, but the b… |
| 18-decode-speed-limit | min-vs-max | Debug | Code | Kept (code stays per brief; see notes for formula-only ones) | This estimator claims an 8B model decodes at about 61,800 tokens/s on an H100. Tap the line with the bug. |
| 19-boss-roofline-ridge | ridge part 1 | predict (boss) | Arithmetic | Replaced → mcq: Batch-32 decode runs at about 32 FLOP/byte on an H100 (ridge about 295). Which upgrade would shorten its step… | A100: 312 TFLOP/s, 2.0 TB/s. Ridge point in FLOP/byte? |
| 19-boss-roofline-ridge | ridge part 2 | mcq (boss) | Conceptual | Kept | A kernel has an intensity of 20 FLOP/byte on an H100. It is... |
| 19-boss-roofline-ridge | ridge part 3 | predict (boss) | Arithmetic | Replaced → mcq: Switching weights from fp16 to int4 makes batch-1 decode almost 4x faster. Why doesn't a long prompt's prefil… | H100 (3.35 TB/s), 8B model in int4 (4 GB). Batch-1 decode ceiling in tokens/s? |
| 19-boss-roofline-ridge | ridge part 4 | ordering (boss) | Conceptual | Kept | Order these operations from lowest to highest arithmetic intensity. |
| 19-boss-roofline-ridge | ridge part 5 | fill (boss) | Conceptual | Kept | Batching raises decode intensity because each weight loaded from {{0}} is reused for {{1}} tokens. |
| 19-boss-roofline-ridge | ridge part 6 | mcq (boss) | Conceptual | Kept | Which change does NOT raise the batch-1 decode ceiling? |
| 20-continuous-batching | static-waste | Predict | Arithmetic | Replaced → MCQ: Which workload loses the most throughput under static batching? | A static batch of 4 requests generates 100, 100, 100 and 1,000 tokens. The batch runs until the longest finis… |
| 20-continuous-batching | when-admit | MCQ | Conceptual | Kept | In iteration-level (continuous) batching, when can a new request join the running batch? |
| 20-continuous-batching | sched-order | Ordering | Conceptual | Kept | Put one continuous-batching scheduler step in order. |
| 21-batch-size-vs-latency | latency-mcq | MCQ | Conceptual | Kept | Short prompts, memory-bound decode. You raise the batch from 1 to 16. What mostly happens? |
| 21-batch-size-vs-latency | step-time | Predict | Arithmetic | Replaced → MCQ: At short context, going from batch 1 to batch 16 barely changes the decode step time. At 2,048 tokens of cont… | Llama 3 8B fp16 (16 GB of weights, 128 KiB of KV per token) on an H100 (3.35 TB/s). Batch 64, each sequence h… |
| 21-batch-size-vs-latency | batch-throughput | Predict | Arithmetic | Replaced → MCQ: Your product promises every user at least 100 tokens/s. From the batching table: batch 64 gives about 101 tok… | Same setup: 64 sequences each get one token per 9.9 ms step. Aggregate throughput, in tokens/s? |
| 21-batch-size-vs-latency | step-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write decode_step_ms(weight_gb, kv_kib_per_token, batch, ctx, bw_tbs). It returns the memory-bound decode ste… |
| 22-chunked-prefill | what-improves | MCQ | Conceptual | Kept | What does chunked prefill mainly improve? |
| 22-chunked-prefill | budget-fill | Fill | Conceptual | Kept | Each step has a token budget. Every running decode costs {{0}} token, and the leftover goes to a {{1}}. |
| 22-chunked-prefill | budget-left | Predict | Arithmetic | Replaced → MCQ: Budget 2,048 tokens per step. An 8,192-token prompt is being prefilled while 96 users decode. Then 500 more u… | The step token budget is 2,048. There are 96 running decodes. How many prefill tokens can join this step? |
| 22-chunked-prefill | step-fill-order | Ordering | Conceptual | Kept | Put the way a stall-free scheduler fills one step's token budget in order. |
| 22-chunked-prefill | stall-ms | Predict | Arithmetic | Replaced → MCQ: You raise the chunk size from 512 to 1,024 tokens (cost model: 10 ms per step plus 0.04 ms per prefill token)… | Same cost model: 10 ms per step plus 0.04 ms per prefill token. With a chunk size of 1,024, how long is each … |
| 22-chunked-prefill | chunk-count | Predict | Arithmetic | Replaced → Ordering: Put what happens to a long request C in order, from arrival until it streams, when the server uses chunked pr… | An 8,192-token prompt is prefilled in chunks of 512 tokens. How many scheduler steps does its prefill take? |
| 22-chunked-prefill | gap-slider | SliderDiagram | Interactive | Kept | Your SLO says no decoding user may wait more than 50 ms between tokens. Find a chunk size that meets it. |
| 22-chunked-prefill | ttft-slider | SliderDiagram | Interactive | Kept | Now look at the long prompt's own TTFT. Find a chunk size that keeps it at or below 450 ms. |
| 22-chunked-prefill | pick-chunk | MCQ | Conceptual | Kept | Which chunk size meets both targets: decoders' step time ≤ 50 ms and TTFT ≤ 450 ms? |
| 22-chunked-prefill | kv-reread | Predict | Arithmetic | Replaced → MCQ: Compared with one big prefill of the same prompt, what new cost does chunked prefill add? | An 8,192-token prompt is prefilled in 16 chunks of 512 tokens. Chunk k reads the KV of the (k − 1) × 512 toke… |
| 22-chunked-prefill | vllm-knob | MCQ | Conceptual | Kept | Your vLLM server streams smoothly, but long-prompt users complain about TTFT. Which change to max_num_batched… |
| 23-boss-batch-boulevard | boulevard part 1 | mcq (boss) | Conceptual | Kept | Under static batching, when can a waiting request start? |
| 23-boss-batch-boulevard | boulevard part 2 | predict (boss) | Arithmetic | Replaced → mcq: Why does continuous batching raise total throughput, not just fairness? | Static batch of 4 with output lengths 50, 50, 50 and 400. What percentage of decode slots do useful work? |
| 23-boss-batch-boulevard | boulevard part 3 | predict (boss) | Arithmetic | Replaced → mcq: At batch 128 with 2,048-token contexts, a decode step takes about 15 ms instead of about 5 ms at batch 1. Wha… | 8B fp16 (16 GB) on an A100 at 2.0 TB/s, with a negligible KV cache. Decode step time in ms? |
| 23-boss-batch-boulevard | boulevard part 4 | fill (boss) | Conceptual | Kept | Continuous batching schedules at the granularity of one {{0}}, and the main thing limiting admission is free … |
| 23-boss-batch-boulevard | boulevard part 5 | predict (boss) | Arithmetic | Replaced → mcq: In a stall-free scheduler, why do running decodes get their tokens before any new prefill? | Token budget 4,096 and 1,000 running decodes. Max prefill tokens this step? |
| 23-boss-batch-boulevard | boulevard part 6 | mcq (boss) | Conceptual | Kept | Doubling batch size on a memory-bound decode with short contexts roughly… |
| 23-boss-batch-boulevard | getaway-scheduler | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write continuous_steps(lengths, slots). Requests (output lengths in tokens) wait in a FIFO queue… |
| 24-kv-as-virtual-memory | waste-slab | Predict | Arithmetic | Replaced → MCQ: Why did older servers reserve one contiguous KV slab sized for the maximum length, even though most of it was… | An old server reserves a 4,096-token contiguous KV slab per request. A request actually uses 1,000 tokens. Wh… |
| 24-kv-as-virtual-memory | blocks-needed | Predict | Arithmetic | Replaced → MCQ: You change the KV block size from 16 tokens to 256. What happens? | With a block size of 16 tokens, how many KV blocks does a 1,000-token sequence need? |
| 24-kv-as-virtual-memory | block-table | MCQ | Conceptual | Kept | What does a sequence's block table map? |
| 25-block-tables-and-copy-on-write | cow-when | MCQ | Conceptual | Kept | When does vLLM copy a KV block? |
| 25-block-tables-and-copy-on-write | cow-blocks | Predict | Arithmetic | Replaced → MCQ: You ask for 4 parallel samples of a 1,000-token prompt (block size 16: 62 full blocks plus one block holding … | A 1,000-token prompt with block size 16. You draw 4 parallel samples, each generating 200 tokens. Full prompt… |
| 25-block-tables-and-copy-on-write | beam-why | MCQ | Conceptual | Kept | Why does beam search save more memory with sharing than parallel sampling does? |
| 26-preemption-and-swapping | pool-size | Predict | Arithmetic | Replaced → MCQ: Same GPU, same free memory for the KV cache. You switch from Llama 3 8B (32 layers) to a model with the same … | Llama 3 8B fp16 uses 128 KiB of KV per token, block size 16. You have 40 GB (decimal) free for KV. How many b… |
| 26-preemption-and-swapping | fits-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write blocks_needed(lens, block_size=16) that returns the total physical blocks for sequences of the given to… |
| 26-preemption-and-swapping | who-first | MCQ | Conceptual | Kept | Under vLLM's first-come-first-served policy, which sequence gets preempted first? |
| 26-preemption-and-swapping | swap-time | Predict | Arithmetic | Replaced → MCQ: Blocks run out and two sequences must be preempted: one 200 tokens long and one 30,000 tokens long. On an eng… | Swapping a sequence's 2 GB of KV to CPU over a PCIe Gen4 x16 link at ~32 GB/s. Roughly how long, in ms? |
| 27-boss-paged-pier | pier part 1 | predict (boss) | Arithmetic | Replaced → mcq: A sequence has exactly 2,048 tokens, filling 128 blocks. It generates one more token. What does the block man… | Block size 16. How many blocks for a 2,049-token sequence? |
| 27-boss-paged-pier | pier part 2 | mcq (boss) | Conceptual | Kept | A block table maps… |
| 27-boss-paged-pier | pier part 3 | predict (boss) | Arithmetic | Replaced → mcq: Why does paging remove external fragmentation? | Max slots wasted per sequence with block size 16? |
| 27-boss-paged-pier | pier part 4 | fill (boss) | Conceptual | Kept | Parallel samples share prompt blocks via {{0}}, and a shared block is duplicated only on {{1}}. |
| 27-boss-paged-pier | pier part 5 | mcq (boss) | Conceptual | Kept | Which preemption mode moves KV over PCIe? |
| 27-boss-paged-pier | pier part 6 | predict (boss) | Arithmetic | Replaced → mcq: A request preempted with recompute is resumed. What does the server prefill? | Block = 2 MiB. How many blocks fit in 10 GiB? |
| 27-boss-paged-pier | getaway-allocator | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write a tiny block allocator. alloc_table(seq_len, free_list, block_size=16) pops physical block… |
| 28-fewer-bytes-faster-tokens | int4-70b | Predict | Arithmetic | Replaced → MCQ: A 70B model needs 140 GB in fp16 but about 35 GB in int4, so it fits on one 80 GB GPU. Besides fitting, what … | Ignoring scales and zero points, how many GB do the weights of a 70B-parameter model take at 4 bits per weigh… |
| 28-fewer-bytes-faster-tokens | awq-idea | MCQ | Conceptual | Kept | What is AWQ's key insight? |
| 28-fewer-bytes-faster-tokens | e4m3-max | Predict | Arithmetic | Replaced → MCQ: Why do inference engines usually store FP8 weights and activations as E4M3 rather than E5M2? | What is the largest finite value representable in FP8 E4M3 (the OCP/NVIDIA variant)? |
| 29-scales-and-groups | q-value | Predict | Arithmetic | Replaced → MCQ: Symmetric int8 with one scale per tensor: scale = max/w/ / 127. One outlier weight doubles max/w/. What happe… | Symmetric int8 with max/w/ = 0.508, so scale = 0.004. What integer does w = 0.3 quantize to? |
| 29-scales-and-groups | quant-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write quantize_int8(ws), which returns (q, scale) for symmetric per-tensor int8: scale = max/w/ / 127, q = ro… |
| 29-scales-and-groups | why-groups | MCQ | Conceptual | Kept | Why do GPTQ and AWQ checkpoints typically use group size 128 instead of one scale per tensor? |
| 29-scales-and-groups | group-bits | Predict | Arithmetic | Replaced → MCQ: You change int4 group size from 128 to 32 (one fp16 scale per group). What is the trade-off? | int4 weights with one fp16 scale per group of 128 weights. Effective bits per weight? |
| 30-activation-outliers-smoothquant | why-hard | MCQ | Conceptual | Kept | Why are activations harder to quantize than weights in big LLMs? |
| 30-activation-outliers-smoothquant | smooth-s | Predict | Arithmetic | Replaced → MCQ: In SmoothQuant, what happens if you push α from 0.5 toward 1? | Channel j has max/X_j/ = 64 and max/W_j/ = 0.25. With α = 0.5, what is the smoothing factor s_j? |
| 30-activation-outliers-smoothquant | equivalence | MCQ | Conceptual | Kept | Why doesn't SmoothQuant change the model's output (before rounding)? |
| 31-kv-cache-quantization | fp8-seqs | Predict | Arithmetic | Replaced → MCQ: Llama 3 8B, a 40 GB KV pool and 8k-token sequences: about 37 fit with an fp16 cache. You switch the cache to … | Llama 3 8B: 128 KiB per token in fp16. You have 40 GB (decimal) for KV and want 8,192-token sequences. How ma… |
| 31-kv-cache-quantization | kv-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write kv_gb(layers, kv_heads, head_dim, tokens, bits), which returns the KV cache size in decimal GB for that… |
| 31-kv-cache-quantization | kivi-mcq | MCQ | Conceptual | Kept | KIVI quantizes keys per-channel but values per-token. Why? |
| 32-boss-quant-quarter | quarter part 1 | predict (boss) | Arithmetic | Replaced → mcq: With weight-only int4 (GPTQ or AWQ), what actually runs in 4 bits? | A 13B model at 4 bits with g = 128 fp16 scales (4.125 bits). Weight size in GB? |
| 32-boss-quant-quarter | quarter part 2 | mcq (boss) | Conceptual | Kept | Which method uses approximate second-order (Hessian) information? |
| 32-boss-quant-quarter | quarter part 3 | predict (boss) | Arithmetic | Replaced → mcq: Why can't a fast int8 matmul simply give each activation channel its own scale? | Symmetric int8: max/w/ = 1.27. What is the scale? |
| 32-boss-quant-quarter | quarter part 4 | fill (boss) | Conceptual | Kept | SmoothQuant divides {{0}} by s and multiplies {{1}} by s. |
| 32-boss-quant-quarter | quarter part 5 | predict (boss) | Arithmetic | Replaced → mcq: A prefill-heavy, compute-bound workload. Which helps it more: weight-only int4 or W8A8? | H100 at 3.35 TB/s, 8B model, int4 weights (4 GB). Batch-1 decode ceiling in tokens/s? |
| 32-boss-quant-quarter | quarter part 6 | mcq (boss) | Conceptual | Kept | FP8 E4M3 versus E5M2: which has more range? |
| 32-boss-quant-quarter | getaway-groups | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write quantize_groups(ws, group, bits=4). For each consecutive group, scale = max/w/ / qmax with… |
| 33-the-hbm-bottleneck | s-size | Predict | Arithmetic | Replaced → MCQ: Naive attention writes S and P (both N × N) to HBM, but its output O is only N × d. What happens as the conte… | One layer, batch 1, 32 heads, N = 4,096, fp16. How many GiB does materialising S for all heads take? |
| 33-the-hbm-bottleneck | naive-order | Ordering | Conceptual | Kept | Order the HBM round-trips in naive attention. |
| 33-the-hbm-bottleneck | slow-why | MCQ | Conceptual | Kept | Why is standard attention slow on GPUs at long context? |
| 34-online-softmax | why-max | MCQ | Conceptual | Kept | Why subtract the max before exponentiating? |
| 34-online-softmax | online-l | Predict | Arithmetic | Replaced → MCQ: In online softmax, when a new score bigger than the running max arrives, why is the running sum l multiplied … | Scores arrive in two blocks: [1, 2] then [3]. After both, the running max is m = 3. What is the running sum l… |
| 34-online-softmax | combine-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write combine(m_a, l_a, m_b, l_b), which merges two partial softmax statistics (max and sum of exp(x − max)) … |
| 35-tiling-in-sram | tile-bytes | Predict | Arithmetic | Replaced → MCQ: Why does FlashAttention use tiles of about 128 rows instead of much bigger ones, such as 1,024 × 1,024? | Q, K and V tiles of 128 × 128 fp16 each, loaded together. How many KiB of SRAM? |
| 35-tiling-in-sram | exact-mcq | MCQ | Conceptual | Kept | Compared with standard attention, FlashAttention's output is… |
| 35-tiling-in-sram | fa3-util | Predict | Arithmetic | Replaced → MCQ: FlashAttention-3 runs faster than FlashAttention-2 on an H100 while doing the same FLOPs. Where does the extr… | FA3 reaches 740 TFLOP/s fp16 on an H100 with a 989 TFLOP/s dense peak. What percentage utilisation is that? |
| 36-boss-flash-gardens | gardens part 1 | predict (boss) | Arithmetic | Replaced → mcq: During decode there is one query row per head. Why does Flash-Decoding split the cached K and V along the seq… | fp16 S matrix, one head, N = 16,384. Size in MiB? |
| 36-boss-flash-gardens | gardens part 2 | mcq (boss) | Conceptual | Kept | FlashAttention mainly reduces… |
| 36-boss-flash-gardens | gardens part 3 | predict (boss) | Arithmetic | Replaced → ordering: Order one online softmax update when a new score s (with value v) arrives, then the final step. | Running max 4, running sum 2.0. A new score 6 arrives. New running sum (old sum rescaled, plus the new term)? |
| 36-boss-flash-gardens | gardens part 4 | fill (boss) | Conceptual | Kept | FlashAttention keeps tiles in {{0}} and writes only the {{1}} back to HBM. |
| 36-boss-flash-gardens | gardens part 5 | mcq (boss) | Conceptual | Kept | Is FlashAttention an approximation? |
| 36-boss-flash-gardens | gardens part 6 | predict (boss) | Arithmetic | Replaced → mcq: How does the memory FlashAttention needs for scores grow with context length N? | FA3 fp8 hits about 1.2 PFLOP/s against a 1,979 TFLOP/s dense fp8 peak. Utilisation %? |
| 36-boss-flash-gardens | getaway-tiled | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write attend_tiled(q, K, V, tile), single-query attention computed tile by tile with online soft… |
| 37-draft-and-verify | exactness | MCQ | Conceptual | Kept | With standard speculative sampling, how does the output distribution compare to plain sampling from the targe… |
| 37-draft-and-verify | expected-tokens | Predict | Arithmetic | Replaced → MCQ: With acceptance rate α and γ drafts, tokens per target pass = (1 − α^(γ+1)) / (1 − α). Why does each extra dr… | Acceptance rate alpha = 0.8 and the draft proposes gamma = 4 tokens. Expected tokens produced per target-mode… |
| 37-draft-and-verify | when-bad | MCQ | Conceptual | Kept | When does speculative decoding help least? |
| 38-acceptance-and-speedup | low-alpha | Predict | Arithmetic | Replaced → MCQ: Your draft model is a poor match and α drops from 0.8 to 0.6. What should you do with γ, the number of drafts… | α = 0.6, γ = 4. Expected tokens per target pass? |
| 38-acceptance-and-speedup | raise-alpha | MCQ | Conceptual | Kept | Which change usually raises the acceptance rate α? |
| 38-acceptance-and-speedup | speedup | Predict | Arithmetic | Replaced → MCQ: α = 0.8 and γ = 4 give about 3.4 tokens per target pass, but the measured speedup is about 2.2x. Why lower? | α = 0.8, γ = 4, and the draft costs c = 0.05 of a target pass. Expected wall-clock speedup? |
| 38-acceptance-and-speedup | gamma-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write best_gamma(alpha, c, max_gamma=10), which returns the γ in 1..max_gamma that maximises speedup = (1 − α… |
| 39-medusa-eagle-and-lookup | tree-nodes | Predict | Arithmetic | Replaced → MCQ: In tree verification, each candidate may attend to the prompt and its own ancestors, but not to its siblings … | A Medusa-style tree has 3 candidates for the next token and 2 children under each. How many candidate tokens … |
| 39-medusa-eagle-and-lookup | tree-why | MCQ | Conceptual | Kept | What does tree attention let Medusa do? |
| 39-medusa-eagle-and-lookup | no-training | MCQ | Conceptual | Kept | Which method needs no extra model and no training at all? |
| 40-boss-draft-row | row part 1 | predict (boss) | Arithmetic | Replaced → mcq: Which task gets the highest acceptance from prompt-lookup (n-gram) drafting? | α = 0.9, γ = 3. Expected tokens per target pass? |
| 40-boss-draft-row | row part 2 | mcq (boss) | Conceptual | Kept | Speculative sampling's output distribution is… |
| 40-boss-draft-row | row part 3 | predict (boss) | Arithmetic | Replaced → mcq: Distilling the draft on the target's outputs raises α. Why does that raise speed without changing quality? | Tokens per pass 3.0, γ = 4, c = 0.1. Speedup? |
| 40-boss-draft-row | row part 4 | mcq (boss) | Conceptual | Kept | Speculation helps least when… |
| 40-boss-draft-row | row part 5 | fill (boss) | Conceptual | Kept | Medusa uses extra {{0}} and verifies candidates with {{1}} attention. |
| 40-boss-draft-row | row part 6 | predict (boss) | Conceptual (mechanics) | Kept: tests the bonus/correction-token rule, not arithmetic | Draft 5 tokens. Greedy verification accepts the first 2, then disagrees. Total tokens emitted this pass? |
| 40-boss-draft-row | getaway-verify | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write verify_greedy(draft, target). draft is the γ proposed tokens. target is the target model's… |
| 41-tensor-parallelism | allreduce-count | Predict | Arithmetic | Replaced → MCQ: In Megatron's MLP split, why is there an all-reduce after the second (row-split) matrix but no communication … | Llama 3 70B has 80 layers. With Megatron TP, how many all-reduces per forward pass (ignoring embeddings)? |
| 41-tensor-parallelism | tp-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write per_gpu_weight_gb(params_b, bytes_per_param, tp), the weight memory per GPU in decimal GB when weights … |
| 41-tensor-parallelism | ring-bytes | Predict | Arithmetic | Replaced → MCQ: In a ring all-reduce each GPU sends 2(N − 1)/N times the tensor size. What happens to each GPU's traffic as y… | Ring all-reduce of a 64 MB tensor across 8 GPUs. How many MB does each GPU send? |
| 41-tensor-parallelism | keep-in-node | MCQ | Conceptual | Kept | Why is tensor parallelism usually kept within one node? |
| 42-pipeline-parallelism | pp-mem | Predict | Arithmetic | Replaced → MCQ: You serve a 70B model with 4 pipeline stages. Compared with one GPU big enough to hold the whole model, does … | Llama 3 70B in fp16 (140 GB) split across 4 pipeline stages. Weights per GPU in GB? |
| 42-pipeline-parallelism | pp-vs-tp | MCQ | Conceptual | Kept | Compared with TP, PP communication is… |
| 42-pipeline-parallelism | bubble | Predict | Arithmetic | Replaced → MCQ: With p pipeline stages and m micro-batches, the idle share is (p − 1) / (m + p − 1). How do you shrink the bu… | 4 pipeline stages, 12 micro-batches. What percentage of the time is bubble? |
| 43-moe-and-expert-parallelism | mixtral-mem | Predict | Arithmetic | Replaced → MCQ: Mixtral 8x7B has about 47B parameters, about 13B of them active per token. At batch 1 it needs memory like a … | Mixtral 8x7B has 46.7B parameters. Weight memory in fp16, in GB? |
| 43-moe-and-expert-parallelism | moe-saves | MCQ | Conceptual | Kept | What does MoE save compared with a dense model of the same total size? |
| 43-moe-and-expert-parallelism | touched-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write expected_experts_touched(E, k, B): with E experts, top-k routing and B tokens routed independently and … |
| 43-moe-and-expert-parallelism | mixtral-speed | Predict | Arithmetic | Replaced → MCQ: At batch 1, Mixtral decodes much faster than a dense 47B model. At batch 64 the advantage mostly disappears. … | Batch-1 decode on H100s with total bandwidth 3.35 TB/s per GPU (assume the read is spread perfectly over 2 GP… |
| 44-boss-shard-city | shard part 1 | predict (boss) | Arithmetic | Replaced → mcq: An 8B model fits on one GPU, and you need 4x the throughput at the same per-user speed. What is the simplest … | A 32-layer model with TP = 4. All-reduces per forward pass? |
| 44-boss-shard-city | shard part 2 | predict (boss) | Arithmetic | Replaced → mcq: Which split makes a single user's tokens arrive faster? | Pipeline p = 8, m = 8. Bubble %? |
| 44-boss-shard-city | shard part 3 | mcq (boss) | Conceptual | Kept | Spanning two nodes over InfiniBand, the better split is usually… |
| 44-boss-shard-city | shard part 4 | predict (boss) | Arithmetic | Replaced → mcq: In expert parallelism, the router sends a large share of tokens to one popular expert. What happens? | DeepSeek-V3 has 671B parameters. Weight memory in fp8, in GB? |
| 44-boss-shard-city | shard part 5 | fill (boss) | Conceptual | Kept | MoE needs memory for {{0}} parameters, but batch-1 decode reads only the {{1}} ones. |
| 44-boss-shard-city | shard part 6 | predict (boss) | Arithmetic | Replaced → mcq: Going from TP = 4 to TP = 8 inside one node halves each GPU's maths per step. Why doesn't the step time halve? | Ring all-reduce of 16 MB across 4 GPUs: MB sent per GPU? |
| 44-boss-shard-city | getaway-plan | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write min_tp(params_b, bytes_per_param, gpu_gb, reserve=0.3). It returns the smallest TP degree … |
| 45-ttft-tpot-and-prefix-caching | metric-match | MCQ | Conceptual | Kept | A chatbot feels "laggy before it starts typing". Which metric is bad? |
| 45-ttft-tpot-and-prefix-caching | e2e-latency | Predict | Arithmetic | Replaced → MCQ: TTFT is 200 ms, TPOT is 20 ms, and answers average 500 tokens. Which cuts the average user's total wait more:… | TTFT is 200 ms and TPOT is 20 ms. How long, in seconds, until a 500-token answer finishes? |
| 45-ttft-tpot-and-prefix-caching | prefix-saving | Predict | Arithmetic | Replaced → MCQ: Prefix caching worked well until someone put the current timestamp at the very start of the system prompt. No… | Every request has a 2,000-token shared system prompt plus a 200-token user message. With a warm prefix cache,… |
| 46-engines-tour | pick-engine | MCQ | Conceptual | Kept | An agent framework sends thousands of requests that share long system prompts and few-shot examples. Which en… |
| 46-engines-tour | laptop | MCQ | Conceptual | Kept | You want to run a model offline on a MacBook. The most natural pick is… |
| 46-engines-tour | q4-bits | Predict | Arithmetic | Replaced → MCQ: GGUF Q4_0 stores a separate fp16 scale for every 32 weights instead of one per tensor. Why spend the extra bi… | GGUF Q4_0 stores blocks of 32 weights as 4-bit values plus one fp16 scale. Bits per weight? |
| 46-engines-tour | q4-size | Predict | Arithmetic | Replaced → MCQ: You run an 8B model on a laptop with llama.cpp. Switching the file from fp16 to Q4_0 makes generation about 3… | An 8B model in Q4_0 (4.5 bits per weight). File size in GB? |
| 47-disaggregated-prefill-decode | why-disagg | MCQ | Conceptual | Kept | What's the main reason to disaggregate? |
| 47-disaggregated-prefill-decode | transfer-ms | Predict | Arithmetic | Replaced → MCQ: What is the main new cost of disaggregating prefill and decode, and when does it hurt most? | Llama 3 8B prompt of 4,096 tokens (128 KiB/token of KV). Shipping its KV from the prefill GPU to the decode G… |
| 47-disaggregated-prefill-decode | goodput | MCQ | Conceptual | Kept | DistServe optimises "goodput". What is it? |
| 48-boss-server-strip | strip part 1 | predict (boss) | Arithmetic | Replaced → mcq: Users say the bot is laggy before it starts typing, but only at peak hours. Once text appears, it streams fin… | TTFT 300 ms, TPOT 25 ms, 201 output tokens. End-to-end seconds? |
| 48-boss-server-strip | strip part 2 | mcq (boss) | Conceptual | Kept | Users complain that streams stutter mid-answer whenever a big document is uploaded. Best fix? |
| 48-boss-server-strip | strip part 3 | predict (boss) | Arithmetic | Replaced → mcq: In a disaggregated setup, which pool should run large batches? | Shared prefix 3,000 tokens, unique suffix 1,000. Percentage of prefill skipped with a warm prefix cache? |
| 48-boss-server-strip | strip part 4 | fill (boss) | Conceptual | Kept | Goodput counts requests that meet both the {{0}} and the {{1}} SLO. |
| 48-boss-server-strip | strip part 5 | mcq (boss) | Conceptual | Kept | Which engine is built around GGUF files? |
| 48-boss-server-strip | strip part 6 | predict (boss) | Arithmetic | Replaced → mcq: Server A does 10,000 tokens/s, but 40% of its requests miss the TTFT SLO. Server B does 7,000 tokens/s and ev… | Q8_0 stores 32 int8 weights plus one fp16 scale per block. Bits per weight? |
| 48-boss-server-strip | getaway-metrics | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write latency_metrics(t_request, token_times). It returns (ttft, tpot) in the same units: ttft =… |
| 49-server-architecture | flow | Ordering | Conceptual | Kept | Order one request's journey through a tiny server. |
| 49-server-architecture | brain | MCQ | Conceptual | Kept | Which component decides each step which sequences run and how many prefill tokens to add? |
| 49-server-architecture | littles-law | Predict | Arithmetic | Replaced → MCQ: Traffic stays at 5 requests/s, but answers get twice as long, so each request spends twice as long in the sys… | Requests arrive at 5 per second and each takes 10 seconds end to end. On average, how many are in the system … |
| 50-build-the-scheduler | admit-count | Predict | Arithmetic | Replaced → MCQ: Budget 512 tokens and 100 running decodes. The waiting queue holds a 450-token prompt, then two 50-token prom… | Token budget 512 and 100 running decodes. The waiting prompts are 200, 150, 100 and 50 tokens long, with plen… |
| 50-build-the-scheduler | hol | MCQ | Conceptual | Kept | In strict FIFO admission, one 10,000-token prompt at the head of the queue exceeds the budget. What happens? |
| 50-build-the-scheduler | sched-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write schedule_step(running, waiting, budget, free_blocks, block_size=16). running holds the current lengths … |
| 51-benchmark-and-profile | why-p99 | MCQ | Conceptual | Kept | Why report p99 latency? |
| 51-benchmark-and-profile | pct-code | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Write percentile(xs, p), the nearest-rank percentile: sort xs, then take the element at rank ceil(p/100 × n) … |
| 51-benchmark-and-profile | mbu | Predict | Arithmetic | Replaced → MCQ: An 8B fp16 model at batch 1 reaches only 30% MBU on an H100. What does that tell you? | 8B fp16 model (16 GB) at batch 1 decodes 150 tokens/s on an H100 (3.35 TB/s). MBU as a percentage? |
| 52-boss-capstone-peak | peak part 1 | predict (boss) | Arithmetic | Replaced → mcq: Your server's batch is stuck at 8 because KV blocks run out, and MBU is fine. Which change raises concurrency… | Llama 3 70B: 80 layers, 8 KV heads, head dim 128, fp16. KV KiB per token? |
| 52-boss-capstone-peak | peak part 2 | predict (boss) | Arithmetic | Replaced → mcq: A 70B int4 model on one H100 decodes for one user at under 100 tokens/s. Which change makes that one user fas… | 70B int4 weights (35 GB) on one H100 (3.35 TB/s). Batch-1 ceiling in tokens/s? |
| 52-boss-capstone-peak | peak part 3 | mcq (boss) | Conceptual | Kept | Which technique keeps the output distribution identical while cutting latency? |
| 52-boss-capstone-peak | peak part 4 | predict (boss) | Arithmetic | Replaced → mcq: A profile at 32k-token contexts shows most of each step's time is attention. What do you look at first? | Block size 16, a 4,000-token sequence. Blocks? |
| 52-boss-capstone-peak | peak part 5 | fill (boss) | Conceptual | Kept | Continuous batching admits work every {{0}}, and FlashAttention avoids writing {{1}} to HBM. |
| 52-boss-capstone-peak | peak part 6 | predict (boss) | Arithmetic | Replaced → mcq: Arrivals stay at 8 requests/s, but under load the average latency rises from 6 s to 12 s. How many requests a… | Arrival rate 8 req/s, mean latency 6 s. Concurrent requests (Little's law)? |
| 52-boss-capstone-peak | peak part 7 | mcq (boss) | Conceptual | Kept | Your p99 TPOT spikes whenever long prompts arrive. First thing to try? |
| 52-boss-capstone-peak | peak part 8 | predict (boss) | Arithmetic | Replaced → mcq: Why does a load test with Poisson arrivals usually show worse latency than one that sends requests at perfect… | Tensor parallel all-reduces per forward for an 80-layer model? |
| 52-boss-capstone-peak | getaway-sim | Code | Code | Kept (code stays per brief; see notes for formula-only ones) | Coding task: write simulate(lengths, slots), a continuous-batching simulator. Requests are output lengths, ad… |
| 53-tokens-concepts | concept-check | MCQ | Conceptual (small number) | Kept: a one-step number that shows the idea | A model must write a 200-token answer to a 1,000-token prompt. How many forward passes, roughly? |
| 54-attention-concepts | concept-check | MCQ | Conceptual (small number) | Kept: a one-step number that shows the idea | A model has 32 query heads and 8 KV heads. Compared with full MHA, how big is the stored K and V? |
| 55-kv-cache-concepts | concept-check | MCQ | Arithmetic | Replaced → MCQ: Same model: which needs more KV cache memory, 32 users with 1,000-token chats or 1 user with a 32,000-token d… | A model has L = 40, n_kv = 8, d_head = 128, FP16. KV bytes per token? |
| 56-roofline-concepts | concept-check | MCQ | Conceptual (small number) | Kept: a one-step number that shows the idea | A GPU has 1,000 TFLOP/s and 4 TB/s. A kernel has intensity 50 FLOP/byte. What limits it? |
| 57-batching-concepts | concept-check | MCQ | Conceptual | Kept | In continuous batching, when can a new request join the running batch? |
| 58-paged-concepts | concept-check | MCQ | Conceptual (small number) | Kept: a one-step number that shows the idea | With a block size of 16 tokens, what is the most KV memory one sequence can waste in its own blocks? |
| 59-quant-concepts | concept-check | MCQ | Arithmetic | Replaced → MCQ: A group of values is [0.5, −1.27, 0.02], so the int8 scale is 0.01 and 0.02 is stored as 2. Now an outlier, 1… | Symmetric INT8 with max /x/ = 2.54. What is the scale, and what integer stores 1.0? |
| 60-flash-concepts | concept-check | MCQ | Conceptual | Kept | Is FlashAttention an approximation of attention? |
| 61-spec-concepts | concept-check | MCQ | Conceptual | Kept | Speculative sampling with the correct accept/reject rule changes the output distribution how? |
| 62-parallel-concepts | concept-check | MCQ | Conceptual | Kept | Which split needs an all-reduce inside every transformer block? |
| 63-serving-concepts | concept-check | MCQ | Arithmetic | Replaced → MCQ: You let more users share each GPU (a bigger batch). How do total throughput, TPOT and goodput move? | TTFT is 400 ms and TPOT is 20 ms. Roughly how long does a 101-token answer take end to end? |
| 64-capstone-concepts | concept-check | MCQ | Conceptual | Kept | During a step, a running sequence needs a new KV block and none is free. What does a vLLM-style scheduler do? |
