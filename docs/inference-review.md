# LLM Inference course: full review (Round 8)

Base: origin/main 0aef615. Scope: all 12 modules, 64 lessons (12 concept pages, 40 lessons, 12 module tests) and all 40 diagrams, read in full.
Categories: **A** term used or tested before it is defined · **B** explanation too shallow (named but not explained) · **C** order or missing prerequisite · **D** factual or numeric error · **E** exercise tests something not taught · **F** diagram does not match the text, or has leftover theme wording.
No existing ids were changed. No existing exercise answers were changed (only explanation wording), so no progress is marked "Updated".

## Module 1: Tokens and the forward pass
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 00-concepts | D/F | Token ids for "Inference is fun" were `[1179, …]`, but the lesson and the diagram use `[644, …]`. | Made the concept page match: `[644, 2251, 374, 2523]`. |
| 04-prefill-and-decode | A | "Tensor cores" used with no definition (defined only in module 4). | Defined inline with a pointer to module 4. |

## Module 2: Attention
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| diagram 02-causal-masking | F | Title "No spoilers" was leftover playful wording. | Retitled "The causal mask". |
Checked and correct: softmax example, masked-row weights in the stepper, the 275 GB score-matrix figure, GQA ratios.

## Module 3: The KV cache
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 00-concepts | D | 60 GB / 128 KiB was given as "about 490,000 tokens, 60 requests at 8K, 15 at 32K". Correct: about 458,000 tokens, 55 requests at 8K, 13 at 32K. | Fixed numbers and showed the division. |
| 00-concepts | C | "HBM" used before module 4 defines it. | Expanded inline (high-bandwidth memory, main GPU memory). |
| 02-sizing-the-cache | A | fp16 / bf16 / fp8 used as byte sizes with no definition. | One-line definition, pointer to module 7. |

## Module 4: GPU memory and the roofline
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 02-arithmetic-intensity | A | GEMM and GEMV used (diagram, module test) and never defined. | Defined both. |
| 02-arithmetic-intensity / module test | E | Module test asks for the intensity of an element-wise add (≈0.17); never taught. | New card "Element-wise operations" with the 1 FLOP / 6 bytes calculation and why kernels are fused. |
| 03-the-roofline | D | Simulator explanation said "about 512 sequences" are needed; the threshold is about 300 (512 is the next power of two). Same for int4 (about 74, not 128). | Gave both numbers. |
| 04-decode-speed-limit / module test | A | Module test names "tensor parallelism"; the lesson only said "split the model". | Named tensor parallelism and how it raises the ceiling. |

## Module 5: Batching (main focus: chunked prefill)
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 03-chunked-prefill | B | Chunked prefill was named in 3 short cards: no account of what a step is, why a prefill stalls decodes, the TTFT/TPOT trade-off, the KV cache effects, or how real systems set it. | Rewrote the lesson: prefill vs decode recap; the generation stall with numbers (8,192 tokens ≈ 330 ms, 33 normal steps); what chunking is and how a stall-free step is filled; why mixing is nearly free (memory-bound slack); a worked TTFT vs TPOT table (chunk 8,192 / 2,048 / 512 / 256); KV cache effects (written chunk by chunk, earlier chunks re-read, same FLOPs, worked re-read cost); Sarathi-Serve, vLLM `max_num_batched_tokens`, SGLang `--chunked-prefill-size`, tile-size and pipeline-bubble details. 7 new exercises: 2 SliderDiagram widgets (decoder gap, TTFT), Ordering, 2 Predicts, 2 MCQs. Fun rating 3 → 4. All 4 old exercises kept unchanged. |
| 03-chunked-prefill | F | No diagram showed time. | New diagram `04-chunked-prefill-timeline.png`: users A and B plus long request C, with and without chunking, on a millisecond axis. |
| 00-concepts | B | Chunked prefill section was 1 paragraph. | Split into "the problem" (prefill/decode recap, stall with numbers) and "the fix" (chunks, budget, TTFT/TPOT trade-off, KV effect). |
| 00-concepts | D/F | Batch table (10 / 12 / 20 / 60 ms, batch 256) contradicted lesson 2 and its diagram (9.9 ms at batch 64), and batch 256 × 2k context does not fit in 80 GB. | Replaced with values from the lesson formula: 4.9 / 6.1 / 9.9 / 15.0 ms for batch 1 / 16 / 64 / 128. |
| diagram 02-batch-size-vs-latency | D/F | Note said "past batch ~16, KV reads dominate"; at batch 16 KV is 4.3 GB vs 16 GB of weights. They cross near batch 60. Title "bargain". | Note corrected to "past batch ~60"; plain title. |
| 01-continuous-batching | F | Leftover GTA place name "Roofline Ridge"; joke "until the server catches fire". | "module 4"; plain explanation. |
| 01-continuous-batching | A | "Iteration" and how a new request joins (its prefill inside an iteration) not defined. TGI never expanded. | Defined; expanded TGI here and in the concept page. |
| diagrams 01, 03 | F | Titles "wait for the slowpoke", "one monster step". | Plain titles. |

## Module 6: Paged attention
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 01-kv-as-virtual-memory | B | Block table described only as "just like an OS page table" (comparison instead of explanation). | Explained logical vs physical blocks directly; the OS page table is mentioned as the same data structure. |
| 02-block-tables-and-copy-on-write | A | "Parallel sampling (n > 1)" and "reference count" not defined. MCQ explanation "Like fork() in an OS" was a comparison. | Defined both; explanation rewritten directly. |
| 03-preemption-and-swapping | A/B | "FCFS" used in key ideas and an MCQ but not in the text. Preemption, swap and recompute were one sentence each; recompute did not say that generated tokens are re-prefilled. | New card defining preemption, FCFS, swap and recompute step by step. |
| 03-preemption-and-swapping | D | Implied vLLM still offers swap mode; the current V1 engine recomputes only. | Stated, with the vLLM docs as source. |

## Module 7: Quantization
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 01-fewer-bytes-faster-tokens | B/E | GPTQ ("second-order error correction") and AWQ ("protect salient channels") were only named, yet the MCQ and module test ask about the Hessian and salient channels. | New card: post-training quantization, calibration data, how GPTQ adjusts later columns using the Hessian X^T X, how AWQ scales the important channels. |
| 01-fewer-bytes-faster-tokens | A | W8A8, "dequantize on the fly", the E4M3/E5M2 names and Hopper/Ada never explained. | New "Weight-only vs W8A8" card; exponent/mantissa bit split explained; GPU generations named. |
| 03-activation-outliers-smoothquant | B | The claim "per-channel activation scales don't map onto fast int8 GEMMs" was never explained. | Explained: the channel is the summed-over dimension, so the scale would be needed inside the sum; SmoothQuant moves it into W offline. W8A8 defined. |
| diagram 03-activation-outliers-smoothquant | F | Title "monster activation channels". | Plain title. |

## Module 8: FlashAttention
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 00-concepts vs 01-the-hbm-bottleneck | D | Concept page said 3 kernels, lesson ordering says 4. | Concept page notes 4 when masking is separate. |
| 01-the-hbm-bottleneck | B | IO counts given as Θ(Nd + N²) vs Θ(N²d²/M) with no plain explanation. Dropout unexplained. | Explained in words with typical d and M; dropout marked as training-only. |
| 03-tiling-in-sram | A | TMA, warp specialisation and Linformer named with no definition. | Defined each. |
| 03-tiling-in-sram | C | Never said how FlashAttention handles decode (one query row). | Added Flash-Decoding (split K/V across SMs, merge with the same rescaling), with source. |

## Module 9: Speculative decoding
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 01-draft-and-verify | A/E | The coding task uses "the bonus token", never defined. The accept/reject rule appeared only on the concept page. α/γ vs a/k notation switched silently. | New "The accept rule" card (greedy and sampling rule, residual, bonus token, 1 to γ+1 tokens); notation linked. |
| 02-acceptance-and-speedup | A | The c in γc + 1 and "distilling" (a correct MCQ answer) not explained. | Defined c and distillation. |
| 03-medusa-eagle-and-lookup | B | Medusa-1 vs Medusa-2 (in key ideas), EAGLE "features" and the tree attention mask were not explained in the text. | Card rewritten: how the heads predict t+2, t+3…; Medusa-1 vs 2; EAGLE drafts the hidden state; how the tree mask works. |

## Module 10: Parallelism
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 00-concepts | A/E | The concept check offers "data parallelism", never defined. InfiniBand used in later lessons and the module test, never defined. All-reduce only implied. | Defined data parallelism, InfiniBand (with bandwidth) and all-reduce. |
| 01-tensor-parallelism | D | Key idea said "each block needs one all-reduce", but the lesson and test say 2 per layer. | Changed to "each MLP needs one all-reduce". |
| 01-tensor-parallelism | B/E | The ring all-reduce formula 2(N−1)/N is tested twice but never derived. | Explained reduce-scatter + all-gather round by round. |
| 02-pipeline-parallelism | B | Bubble formula given without a reason. | Derived from m + p − 1 time slots. |
| 03-moe / 00-concepts | B | Router mechanics (scores, weighted sum) not explained. | Added. |

## Module 11: Serving systems
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 00-concepts | B | Goodput defined loosely. LRU, radix tree, RDMA and "structured output" named only. | Goodput defined precisely (DistServe's 90% attainment); LRU, radix tree, RDMA and structured output defined. |
| 01-ttft-tpot-and-prefix-caching | B | Prefix caching was one sentence: no explanation of how a match is found or why the hash must cover the whole prefix. | New paragraph: chained block hashes, full blocks only, why KV depends on all earlier tokens. |
| 02-engines-tour | A | "Structured-generation frontend" not explained. | Defined. |
| 03-disaggregated-prefill-decode | B | Splitwise and Mooncake cited but not described. Where the first token is produced, and why each pool tunes differently, not stated. RDMA undefined. | Added all of these. |
| diagram 02-engines-tour | F | Title "The engine dealership" (leftover theme). | "Inference engines by target". |

## Module 12: Capstone
| Lesson | Cat | Problem | Fix |
| --- | --- | --- | --- |
| 01-server-architecture | B | MCQ explanation used "brain / muscle" comparison. | Direct description. |
| 02-build-the-scheduler | A/E | Head-of-line blocking and "skip-ahead" appear in key ideas and the MCQ only. FIFO not expanded. | New paragraph defining FIFO, head-of-line blocking and both fixes. |
| 03-benchmark-and-profile | A/B | MBU defined only in key ideas. "Knee" and why latency explodes past saturation not explained. | Defined MBU in the text (linked to MFU). Explained queue growth and the knee. |

## Totals
| Category | Count |
| --- | --- |
| A: undefined before use or test | 16 |
| B: too shallow | 16 |
| C: order or prerequisite | 2 |
| D: factual or numeric error | 8 |
| E: exercise tested untaught material | 7 (overlapping with A/B rows above, fixed by teaching the material) |
| F: diagram mismatch or theme wording | 9 (1 new diagram, 6 regenerated) |

Diagrams regenerated from `scripts/make_diagrams.py`: 02-attention/02-causal-masking, 05-batching/01, 02, 03, new 04-chunked-prefill-timeline, 07-quantization/03-activation-outliers-smoothquant, 11-serving-systems/02-engines-tour. The other 33 diagrams were checked against the text and are correct.
