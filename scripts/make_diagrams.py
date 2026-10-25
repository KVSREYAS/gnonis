import numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
BG="#f4ecd8"; INK="#1b1b1b"; G="#2e7d32"; GOLD="#d4a017"; P="#6a1b9a"; B="#1565c0"; R="#b71c1c"; GR="#9e9e9e"
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":11,"axes.facecolor":BG,"figure.facecolor":BG,"axes.edgecolor":INK,"text.color":INK,"axes.labelcolor":INK})
import pathlib
OUT=str(pathlib.Path(__file__).resolve().parent.parent/"public"/"diagrams")+"/"
def fig(t,w=10,h=5.5):
    f,a=plt.subplots(figsize=(w,h)); a.set_title(t.upper(),fontsize=15,fontweight="bold",color=G,loc="left"); return f,a
def box(a,x,y,w,h,txt,c,fc="white",fs=10):
    a.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.02,rounding_size=0.08",fc=fc,ec=c,lw=2.2))
    a.text(x+w/2,y+h/2,txt,ha="center",va="center",fontsize=fs,color=INK,fontweight="bold")
def arrow(a,x1,y1,x2,y2,c=INK): a.annotate("",(x2,y2),(x1,y1),arrowprops=dict(arrowstyle="->",lw=2,color=c))
def blank(a,xl,yl): a.set_xlim(*xl); a.set_ylim(*yl); a.axis("off")
import os
MOD={"01-what-is-a-token":"01-tokens-forward-pass","02-the-forward-pass":"01-tokens-forward-pass","03-logits-to-tokens":"01-tokens-forward-pass","04-prefill-and-decode":"01-tokens-forward-pass",
"01-queries-keys-values":"02-attention","02-causal-masking":"02-attention","03-heads-mha-gqa":"02-attention","04-the-quadratic-bill":"02-attention",
"01-why-cache":"03-kv-cache","02-sizing-the-cache":"03-kv-cache","03-the-memory-budget":"03-kv-cache",
"01-memory-hierarchy":"04-gpu-memory-roofline","02-arithmetic-intensity":"04-gpu-memory-roofline","03-the-roofline":"04-gpu-memory-roofline","04-decode-speed-limit":"04-gpu-memory-roofline",
"01-continuous-batching":"05-batching","01-kv-as-virtual-memory":"06-paged-attention","01-fewer-bytes-faster-tokens":"07-quantization","01-draft-and-verify":"09-speculative-decoding","01-ttft-tpot-and-prefix-caching":"11-serving-systems"}
def save(f,n):
    d=OUT+"llm-inference/"+MOD[n]+"/"; os.makedirs(d,exist_ok=True); f.tight_layout(); f.savefig(d+n+".png",dpi=150); plt.close(f); print(d+n)

# 01-what-is-a-token
f,a=fig("Text in, numbers out",11.5,4); blank(a,(0,11.6),(-0.2,4))
a.text(0.2,3.3,'"Inference is fun"',fontsize=14,fontweight="bold")
toks=["In","ference"," is"," fun"]; ids=[644,2251,374,2523]; cs=[G,GOLD,P,B]
for i,(t,d,c) in enumerate(zip(toks,ids,cs)):
    box(a,0.3+i*2.6,1.8,2.2,0.8,repr(t),c); arrow(a,1.4+i*2.6,1.75,1.4+i*2.6,1.15,c); box(a,0.3+i*2.6,0.3,2.2,0.8,str(d),c,fc=c+"22")
a.text(10.75,2.2,"tokens",ha="left",color=GR); a.text(10.75,0.7,"ids*",ha="left",color=GR); a.text(0.3,0.0,"*ids are illustrative; real ids depend on the tokenizer",color=GR,fontsize=9)
save(f,"01-what-is-a-token")

# 02-the-forward-pass
f,a=fig("One token's trip through the model",6,8); blank(a,(0,6),(0,11))
steps=[("token id 644",GR),("Embedding lookup\n(vocab x d_model)",G),("Block 1: Attention + MLP\n(+ residual)",P),("Block 2 ...",P),("Block N (e.g. 32)",P),("Final norm",GOLD),("Unembed -> logits\n(one score per vocab entry)",B)]
for i,(s,c) in enumerate(steps):
    y=10-i*1.5; box(a,0.8,y-0.5,4.4,1.0,s,c)
    if i: arrow(a,3,y+1.0,3,y+0.5)
a.text(5.6,5.5,"residual\nstream",rotation=90,ha="center",va="center",color=P,fontweight="bold")
save(f,"02-the-forward-pass")

# 03-logits-to-tokens
f,a=fig("Temperature reshapes the odds"); logits=np.array([4,3.2,2.5,1.5,1,0.3]); w=["Grove","Street","home","CJ","taco","banana"]
for k,(T,c) in enumerate([(0.5,G),(1.0,GOLD),(2.0,R)]):
    p=np.exp(logits/T); p/=p.sum(); a.bar(np.arange(6)+k*0.27-0.27,p,0.27,color=c,label=f"T={T}")
a.set_xticks(range(6),w); a.set_ylabel("probability"); a.legend(facecolor=BG); a.text(3.5,0.6,"T=2.0: the model after\na night at the Pig Pen",color=R)
save(f,"03-logits-to-tokens")

# 04-prefill-and-decode
f,a=fig("Prefill once, decode many",11,3.8); blank(a,(0,12),(0,3))
box(a,0.2,1,3,1,"PREFILL\nall 1,000 prompt tokens\n(compute-bound)",G,fc=G+"22")
for i in range(16): box(a,3.5+i*0.5,1,0.4,1,"",P,fc=P+"33")
a.text(7.5,2.3,"DECODE: 1 token per step (memory-bound)",ha="center",color=P,fontweight="bold")
a.annotate("",(3.9,0.85),(0.2,0.85),arrowprops=dict(arrowstyle="<->",color=R,lw=1.8)); a.text(2.05,0.25,"TTFT = prefill + 1st token",color=R,fontweight="bold",ha="center")
a.annotate("",(4.4,0.85),(3.9,0.85),arrowprops=dict(arrowstyle="<->",color=B,lw=1.8)); a.text(5.2,0.25,"TPOT = gap between tokens",color=B,fontweight="bold",ha="center")
arrow(a,0.2,0.65,11.8,0.65,GR); a.text(11.8,0.25,"time →",ha="right",color=GR)
save(f,"04-prefill-and-decode")

# 01-queries-keys-values
f,ax=plt.subplots(1,3,figsize=(12,4)); rng=np.random.default_rng(1); S=rng.normal(size=(5,5))
ax[0].imshow(S,cmap="PRGn"); ax[0].set_title("scores = Q·Kᵀ / √d_k",fontweight="bold")
Pm=np.exp(S)/np.exp(S).sum(1,keepdims=True); ax[1].imshow(Pm,cmap="YlGn"); ax[1].set_title("softmax (rows sum to 1)",fontweight="bold")
ax[2].imshow(Pm@rng.normal(size=(5,8)),cmap="PuOr"); ax[2].set_title("output = weights · V",fontweight="bold")
for x in ax: x.set_xticks([]); x.set_yticks([])
f.suptitle("SCALED DOT-PRODUCT ATTENTION",color=G,fontweight="bold",fontsize=15); save(f,"01-queries-keys-values")

# 02-causal-masking
f,a=fig("The causal mask: no spoilers",6,6); n=6; M=np.tril(np.ones((n,n)))
a.imshow(M,cmap=matplotlib.colors.ListedColormap([GR,G]))
for i in range(n):
    for j in range(n): a.text(j,i,"✓" if j<=i else "−∞",ha="center",va="center",color="white",fontweight="bold")
a.set_xlabel("key position (attended to)"); a.set_ylabel("query position"); a.set_xticks(range(n)); a.set_yticks(range(n))
save(f,"02-causal-masking")

# 03-heads-mha-gqa
f,a=fig("MHA vs GQA vs MQA: who shares the getaway car",12,4.5); blank(a,(0,12),(0,4))
for gi,(name,nkv) in enumerate([("MHA (8 KV heads)",8),("GQA (2 KV heads)",2),("MQA (1 KV head)",1)]):
    x0=gi*4+0.2; a.text(x0+1.8,3.7,name,ha="center",fontweight="bold",color=[P,G,GOLD][gi])
    for q in range(8):
        qx=x0+q*0.45; box(a,qx,2.6,0.38,0.5,"Q",B,fs=8); kv=q*nkv//8; kx=x0+kv*(3.6/nkv)+(3.6/nkv-0.38)/2
        a.plot([qx+0.19,kx+0.19],[2.6,1.4],color=GR,lw=1)
    for k in range(nkv): box(a,x0+k*(3.6/nkv)+(3.6/nkv-0.38)/2,0.9,0.38,0.5,"KV",R,fs=7)
a.text(6,0.2,"KV-cache size ∝ number of KV heads → GQA cuts it 4x here",ha="center")
save(f,"03-heads-mha-gqa")

# 04-the-quadratic-bill
f,a=fig("Double the context, quadruple the scores"); n=np.array([1,2,4,8,16,32,64,128])*1024
a.bar([f"{k//1024}k" for k in n],n**2*2/2**20,color=[G,G,GOLD,GOLD,P,P,R,R]); a.set_yscale("log"); a.set_ylabel("fp16 score matrix per head (MiB, log)"); a.set_xlabel("context length")
for i,v in enumerate(n**2*2/2**20): a.text(i,v*1.2,f"{v:,.0f}",ha="center",fontsize=9)
save(f,"04-the-quadratic-bill")

# 01-why-cache
f,a=fig("KV cache grows one row per decode step",10,5); blank(a,(0,10),(0,6))
for s in range(4):
    x=0.3+s*2.4; a.text(x+0.9,5.4,f"step {s+1}",ha="center",fontweight="bold")
    for r in range(4+s):
        c=GOLD if r==3+s else G; box(a,x,4.6-r*0.6,1.8,0.45,"new K,V" if r==3+s else f"K,V t{r+1}",c,fc=c+"22",fs=8)
a.text(5,0.1,"Old rows are read, never recomputed. Only the new token's K,V are computed.",ha="center")
save(f,"01-why-cache")

# 02-sizing-the-cache
f,a=fig("KV bytes per token (fp16)"); m=["Llama 2 7B\n(32 KV heads)","Llama 3 8B\n(8 KV heads, GQA)","Llama 3 70B\n(80 layers, 8 KV)"]
v=[2*32*32*128*2,2*32*8*128*2,2*80*8*128*2]; a.bar(m,[x/1024 for x in v],color=[R,G,P]); a.set_ylabel("KiB per token")
for i,x in enumerate(v): a.text(i,x/1024+8,f"{x//1024} KiB",ha="center",fontweight="bold")
a.set_ylim(0,600); a.text(1.5,560,"2 × layers × kv_heads × head_dim × bytes",ha="center",color=B,fontsize=12)
save(f,"02-sizing-the-cache")

# 03-the-memory-budget
f,a=fig("80 GB GPU: Llama 3 8B fp16, 8k context",10,3.6); users=[1,16,48]
for i,u in enumerate(users):
    kv=u*1.07; a.barh(i,16,color=P); a.barh(i,kv,left=16,color=GOLD); a.text(16+kv+0.5,i,f"{u} seq: {16+kv:.0f} GB",va="center")
a.axvline(80,color=R,lw=2,ls="--"); a.text(80.5,2.35,"80 GB",color=R); a.set_yticks([]); a.set_xlabel("GB"); a.set_xlim(0,100)
a.legend(["HBM limit","weights 16 GB","KV cache"],facecolor=BG,loc="lower right"); save(f,"03-the-memory-budget")

# 01-memory-hierarchy
f,a=fig("H100 memory hierarchy: pocket → garage",9,5.5); blank(a,(0,10),(0,5))
lv=[("Registers  (256 KB / SM)",G),("Shared mem / L1  (up to 228 KB / SM)",GOLD),("L2 cache  (50 MB)",P),("HBM3  (80 GB @ ~3.35 TB/s)",B)]
for i,(t,c) in enumerate(lv): w=3+i*2; box(a,5-w/2,4-i*1.1,w,0.9,t,c,fc=c+"22")
a.text(0.1,0.2,"top = fastest, smallest     bottom = slowest, biggest",color=GR); save(f,"01-memory-hierarchy")

# 02-arithmetic-intensity
f,a=fig("Arithmetic intensity: GEMM vs GEMV (fp16)"); Ns=np.array([1,8,32,128,512,2048,8192])
a.loglog(Ns,Ns/3,"o-",color=G,lw=2.5,label="square GEMM n×n: ≈ n/3 FLOP/byte")
a.loglog(Ns,np.ones_like(Ns)*1.0,"s--",color=R,lw=2.5,label="GEMV (batch-1 decode): ≈ 1 FLOP/byte")
a.axhline(295,color=GOLD,ls=":",lw=2); a.text(1.2,330,"H100 ridge ≈ 295 FLOP/byte",color=GOLD)
a.set_xlabel("matrix size n"); a.set_ylabel("FLOP / byte"); a.legend(facecolor=BG); save(f,"02-arithmetic-intensity")

# 03-the-roofline / 05 boss reuse
f,a=fig("The roofline (H100 SXM, dense BF16)"); I=np.logspace(-1,4,200); peak=989; bw=3.35
a.loglog(I,np.minimum(peak,bw*I),color=INK,lw=3); a.axvline(peak/bw,color=GOLD,ls=":"); a.text(peak/bw*1.1,2,"ridge ≈ 295",color=GOLD)
for x,lab,c in [(1,"batch-1 decode",R),(32,"batch-32 decode",P),(2000,"prefill",G)]: a.plot(x,min(peak,bw*x),"o",ms=12,color=c); a.text(x*1.25,min(peak,bw*x)*0.45,lab,color=c,fontweight="bold",ha="left" if x<1000 else "center")
a.set_xlabel("arithmetic intensity (FLOP/byte)"); a.set_ylabel("attainable TFLOP/s"); a.text(0.15,500,"memory wall ↗",color=B); a.text(15,1300,"compute roof (989 TFLOP/s) →",color=B); a.set_ylim(0.2,3000)
save(f,"03-the-roofline")

# 04-decode-speed-limit
f,a=fig("Batch-1 decode ceiling, 8B model = bandwidth / weight bytes"); gp={"A100 (2.0 TB/s)":2.0,"H100 (3.35 TB/s)":3.35}; x=np.arange(3); wb=[16,8,4]
for k,(g,b) in enumerate(gp.items()):
    v=[b*1e12/(w*1e9) for w in wb]; a.bar(x+k*0.38-0.19,v,0.38,color=[GOLD,G][k],label=g)
    for i,t in enumerate(v): a.text(x[i]+k*0.38-0.19,t+10,f"{t:.0f}",ha="center",fontsize=9)
a.set_xticks(x,["fp16 (16 GB)","int8 (8 GB)","int4 (4 GB)"]); a.set_ylabel("max tokens/s"); a.legend(facecolor=BG); save(f,"04-decode-speed-limit")

# NEW 01-continuous-batching
f,ax=plt.subplots(2,1,figsize=(11,5.5),sharex=True); L=[3,9,4,6]; rq=[[3,9,4,6],[3,5,4,6,2,4,3]]
for k,(a,t) in enumerate(zip(ax,["STATIC: wait for the slowpoke","CONTINUOUS: refill a slot at every step"])):
    a.set_title(t,loc="left",fontweight="bold",color=[R,G][k]); a.set_yticks(range(4),[f"slot {i}" for i in range(4)])
    if k==0:
        for s,l in enumerate(L): a.barh(s,l,color=B); a.barh(s,9-l,left=l,color=GR,alpha=.5)
        a.barh(0,0,color=GR,alpha=.5,label="idle/padding"); a.legend(facecolor=BG,loc="lower right")
    else:
        q=[[3,4,2],[9],[4,5],[6,3]]; cols=[B,G,GOLD,P,R]
        for s,seq in enumerate(q):
            x=0
            for j,l in enumerate(seq): a.barh(s,l,left=x,color=cols[(s+j)%5],ec=BG); x+=l
ax[1].set_xlabel("decode step"); ax[0].set_xlim(0,9)
for a in ax: a.set_xlim(0,9)
ax[1].set_title("each colour = a different request",loc="right",fontsize=9,color=GR); save(f,"01-continuous-batching")

# NEW 01-kv-as-virtual-memory
f,a=fig("PagedAttention: block table → scattered physical blocks",12,5); blank(a,(0,12),(0,5))
a.text(0.2,4.5,"Seq A logical blocks",fontweight="bold",color=G); a.text(0.2,1.9,"Seq B logical blocks",fontweight="bold",color=P)
phys={0:7,1:2,2:5}; physB={0:7,1:2,2:10}
for i in range(3):
    box(a,0.2+i*1.1,3.5,1,0.7,f"A{i}",G,fc=G+"22"); box(a,0.2+i*1.1,0.9,1,0.7,f"B{i}",P,fc=P+"22")
for j in range(12):
    r,cc=divmod(j,4); x=6.2+cc*1.4; y=3.4-r*1.2; sh=j in (7,2); c=GOLD if sh else (G if j==5 else P if j==10 else GR)
    box(a,x,y,1.2,0.9,f"#{j}"+("\nshared" if sh else ""),c,fc=c+"22",fs=8)
def pos(j): r,cc=divmod(j,4); return 6.2+cc*1.4+0.6,3.4-r*1.2+0.45
for i in range(3):
    a.plot([0.7+i*1.1,pos(phys[i])[0]],[3.5,pos(phys[i])[1]],color=G,lw=1.2); a.plot([0.7+i*1.1,pos(physB[i])[0]],[1.6,pos(physB[i])[1]],color=P,lw=1.2,ls="--")
a.text(9,4.6,"physical KV blocks (16 tokens each)",ha="center",fontweight="bold"); a.text(3,0.2,"shared system-prompt prefix = same physical blocks (copy-on-write)",color=GOLD)
save(f,"01-kv-as-virtual-memory")

# NEW 01-fewer-bytes-faster-tokens
f,ax=plt.subplots(2,1,figsize=(11,5.5),gridspec_kw={"height_ratios":[1.3,1]})
a=ax[0]; blank(a,(0,17),(0,4)); a.set_title("BIT LAYOUTS",loc="left",color=G,fontweight="bold",fontsize=15)
fm=[("FP16",[(1,R,"S"),(5,GOLD,"E"),(10,B,"M")]),("BF16",[(1,R,"S"),(8,GOLD,"E"),(7,B,"M")]),("FP8 E4M3 (max 448)",[(1,R,"S"),(4,GOLD,"E"),(3,B,"M")]),("FP8 E5M2 (max 57,344)",[(1,R,"S"),(5,GOLD,"E"),(2,B,"M")]),("INT4",[(4,P,"int")])]
for r,(n,parts) in enumerate(fm):
    y=3.4-r*0.75; a.text(0,y+0.15,n,fontweight="bold",fontsize=9); x=5
    for cnt,c,l in parts:
        for b in range(cnt): a.add_patch(plt.Rectangle((x,y),0.7,0.5,fc=c,ec=BG)); x+=0.72
from matplotlib.patches import Patch
ax[0].legend(handles=[Patch(color=R,label="sign"),Patch(color=GOLD,label="exponent"),Patch(color=B,label="mantissa"),Patch(color=P,label="integer")],loc="lower right",facecolor=BG,ncol=2)
a=ax[1]; a.barh(["fp16","int8","int4"],[140,70,35],color=[R,GOLD,G]); a.axvline(80,color=INK,ls="--"); a.text(81,2.2,"one 80 GB GPU"); a.set_xlabel("Llama-class 70B weights (GB)")
save(f,"01-fewer-bytes-faster-tokens")

# NEW 01-draft-and-verify
f,a=fig("Speculative decoding: draft 4, verify in one pass",11,4.5); blank(a,(0,11.2),(0,4.5))
a.text(0.2,3.8,"draft model guesses:",fontweight="bold"); a.text(0.2,1.7,"target verifies (1 pass):",fontweight="bold")
dr=["the","grove","street","forever"]; ok=[1,1,1,0]
for i,(t,o) in enumerate(zip(dr,ok)):
    box(a,2.8+i*1.6,3.4,1.4,0.7,t,GOLD); c=G if o else R; box(a,2.8+i*1.6,1.3,1.4,0.7,("✓ " if o else "✗ ")+t,c,fc=c+"22")
box(a,2.8+4*1.6,1.3,1.6,0.7,"resample:\n'family'",B,fc=B+"22",fs=9); a.text(5.5,0.4,"3 accepted + 1 corrected = 4 tokens for one big-model pass; output distribution unchanged",ha="center")
save(f,"01-draft-and-verify")

# NEW 01-ttft-tpot-and-prefix-caching
f,ax=plt.subplots(1,2,figsize=(12,4.5)); a=ax[0]; blank(a,(0,10),(0,4)); a.set_title("LATENCY ANATOMY",loc="left",color=G,fontweight="bold")
box(a,0.2,2,1.2,0.8,"queue",GR,fs=8); box(a,1.5,2,2,0.8,"prefill",G,fs=9)
for i in range(10): box(a,3.6+i*0.6,2,0.5,0.8,"",P,fc=P+"33")
a.annotate("",(4.1,1.7),(0.2,1.7),arrowprops=dict(arrowstyle="<->",color=R)); a.text(2.15,1.3,"TTFT",color=R,fontweight="bold",ha="center")
a.annotate("",(4.7,1.7),(4.1,1.7),arrowprops=dict(arrowstyle="<->",color=B)); a.text(4.9,1.3,"TPOT",color=B,fontweight="bold",ha="center")
a.text(5,0.5,"E2E ≈ TTFT + TPOT × (N − 1)",ha="center",fontsize=12)
a=ax[1]; blank(a,(0,10),(0,5)); a.set_title("PREFIX (RADIX) CACHE",loc="left",color=G,fontweight="bold")
box(a,2,3.8,6,0.8,"shared system prompt (2,000 tok): cached",GOLD,fc=GOLD+"22",fs=9)
for i,t in enumerate(["user A","user B","user C"]): box(a,0.5+i*3.2,1.8,2.6,0.7,t+" (200 tok)",P,fs=9); a.plot([5,1.8+i*3.2],[3.8,2.5],color=GR)
a.text(5,0.8,"only ~9% of prefill recomputed",ha="center",color=G,fontweight="bold")
save(f,"01-ttft-tpot-and-prefix-caching")

# ================= Modules 05-12 completion (Oct 24 2026) =================
MOD.update({"02-batch-size-vs-latency":"05-batching","03-chunked-prefill":"05-batching",
"02-block-tables-and-copy-on-write":"06-paged-attention","03-preemption-and-swapping":"06-paged-attention",
"02-scales-and-groups":"07-quantization","03-activation-outliers-smoothquant":"07-quantization","04-kv-cache-quantization":"07-quantization",
"01-the-hbm-bottleneck":"08-flash-attention","02-online-softmax":"08-flash-attention","03-tiling-in-sram":"08-flash-attention",
"02-acceptance-and-speedup":"09-speculative-decoding","03-medusa-eagle-and-lookup":"09-speculative-decoding",
"01-tensor-parallelism":"10-parallelism","02-pipeline-parallelism":"10-parallelism","03-moe-and-expert-parallelism":"10-parallelism",
"02-engines-tour":"11-serving-systems","03-disaggregated-prefill-decode":"11-serving-systems",
"01-server-architecture":"12-capstone","02-build-the-scheduler":"12-capstone","03-benchmark-and-profile":"12-capstone"})

# 02-batch-size-vs-latency
f,a=fig("The batch-size bargain (8B fp16, H100, 2k ctx)"); b=np.array([1,2,4,8,16,32,64,128])
step=(16e9+b*2048*131072)/3.35e12*1e3; a.plot(b,b/step*1e3,"o-",color=G,lw=2.5,label="throughput (tokens/s)")
a.set_xscale("log",base=2); a.set_xlabel("batch size"); a.set_ylabel("tokens/s",color=G)
a2=a.twinx(); a2.plot(b,step,"s--",color=R,lw=2.5,label="step time (ms)"); a2.set_ylabel("decode step time (ms)",color=R)
a.text(10,7600,"past batch ~16, KV reads\ndominate the step time",color=INK,fontsize=9,ha="right")
for x,y in zip(b,step): a2.text(x,y+0.6,f"{y:.1f}",color=R,fontsize=8,ha="center")
a.legend(loc="upper left",facecolor=BG); a2.legend(loc="center left",facecolor=BG); save(f,"02-batch-size-vs-latency")

# 03-chunked-prefill
f,ax=plt.subplots(1,2,figsize=(12,4.5),sharey=True)
for k,(a,t) in enumerate(zip(ax,["NO CHUNKING: one monster step","CHUNKED: every step under budget"])):
    a.set_title(t,loc="left",fontweight="bold",color=[R,G][k]); steps=np.arange(1,9); dec=np.full(8,96)
    pre=np.array([0,0,8192,0,0,0,0,0]) if k==0 else np.array([0,0,1952,1952,1952,1952,384,0])
    a.bar(steps,dec,color=P,label="decode tokens (96 users)"); a.bar(steps,pre,bottom=dec,color=GOLD,label="prefill tokens (8k prompt)")
    a.axhline(2048,color=INK,ls="--"); a.text(0.6,2150,"token budget 2,048",fontsize=9); a.set_xlabel("scheduler step"); a.set_xticks(steps)
ax[0].set_ylabel("tokens in step"); ax[0].legend(facecolor=BG,loc="upper right",fontsize=9); save(f,"03-chunked-prefill")

# 02-block-tables-and-copy-on-write
f,a=fig("Copy-on-write: 4 samples share the prompt",12,5); blank(a,(0,12),(0,5))
for i in range(4): box(a,0.3+i*1.3,3.8,1.1,0.7,f"P{i}\nref=4",GOLD,fc=GOLD+"22",fs=8)
a.text(3.0,4.7,"shared full prompt blocks (62 in the exercise)",ha="center",fontweight="bold",color=GOLD)
cs=[G,P,B,R]
for s in range(4):
    x=6.2+s*1.45; box(a,x,3.8,1.2,0.7,f"tail copy\nsample {s}",cs[s],fc=cs[s]+"22",fs=8)
    for r in range(2): box(a,x,2.6-r*1.0,1.2,0.7,f"S{s} new {r}",cs[s],fs=8)
a.text(9.1,4.7,"partial last block: copied on first write",ha="center",fontweight="bold")
a.text(6,0.3,"Total blocks = shared + 4 × private  →  114 instead of 300",ha="center",fontsize=12,color=G,fontweight="bold")
save(f,"02-block-tables-and-copy-on-write")

# 03-preemption-and-swapping
f,a=fig("Out of blocks: preempt the newest",12,5); blank(a,(0,12),(0,5))
a.text(0.3,4.5,"GPU KV block pool (full)",fontweight="bold")
cols={0:G,1:B,2:P,3:R}
for j in range(32):
    r,c=divmod(j,8); owner=min(j//8,3); box(a,0.3+c*0.62,3.5-r*0.75,0.55,0.6,"",cols[owner],fc=cols[owner]+("55" if owner<3 else "aa"))
for i,(t,c) in enumerate([("seq A (oldest)",G),("seq B",B),("seq C",P),("seq D (newest)",R)]): a.text(5.5,3.7-i*0.75,t,color=c,fontweight="bold",va="center")
arrow(a,7.3,1.45,8.6,3.3,R); arrow(a,7.3,1.45,8.6,0.9,R)
box(a,8.7,3.0,3,0.9,"SWAP: copy D's blocks\nto CPU RAM over PCIe",B,fs=9); box(a,8.7,0.5,3,0.9,"RECOMPUTE: free D's blocks,\nre-run prefill later",G,fs=9)
save(f,"03-preemption-and-swapping")

# 02-scales-and-groups
f,ax=plt.subplots(1,2,figsize=(12,4.5),sharey=True); rng=np.random.default_rng(3); w=rng.normal(0,0.02,4000); w[7]=0.3
for k,(a,t,m) in enumerate(zip(ax,["PER-TENSOR SCALE (one outlier sets it)","PER-GROUP SCALE (local range)"],[0.3,0.06])):
    a.hist(np.clip(w,-0.07,0.07),bins=80,color=B,alpha=.7); grid=np.arange(-7,8)*m/7
    for g in grid[(grid>-0.075)&(grid<0.075)]: a.axvline(g,color=[R,G][k],lw=1.6)
    a.set_title(t,loc="left",fontweight="bold",color=[R,G][k],fontsize=11); a.set_xlabel("weight value (outlier at 0.3 off-chart)"); a.set_xlim(-0.075,0.075)
ax[0].set_ylabel("count"); ax[0].text(-0.072,ax[0].get_ylim()[1]*0.85,"only 3 int4 levels\ncover the bulk",color=R,fontweight="bold",bbox=dict(fc=BG,ec="none"))
ax[1].text(-0.072,ax[1].get_ylim()[1]*0.85,"fine steps\nacross the bulk",color=G,fontweight="bold",bbox=dict(fc=BG,ec="none")); save(f,"02-scales-and-groups")

# 03-activation-outliers-smoothquant
f,ax=plt.subplots(1,2,figsize=(12,4.5)); ch=np.arange(16); rng=np.random.default_rng(5); xa=rng.uniform(0.5,2,16); xa[[3,11]]=[64,40]; wa=rng.uniform(0.1,0.4,16); wa[3]=0.25
s=np.sqrt(xa)/np.sqrt(wa)
ax[0].bar(ch-0.2,xa,0.4,color=R,label="max|X| activations"); ax[0].bar(ch+0.2,wa,0.4,color=B,label="max|W| weights"); ax[0].set_title("BEFORE: monster activation channels",loc="left",color=R,fontweight="bold",fontsize=11)
ax[1].bar(ch-0.2,xa/s,0.4,color=R,label="max|X/s|"); ax[1].bar(ch+0.2,wa*s,0.4,color=B,label="max|s·W|"); ax[1].set_title("AFTER SmoothQuant (α = 0.5): balanced",loc="left",color=G,fontweight="bold",fontsize=11)
for a in ax: a.set_xlabel("hidden channel"); a.legend(facecolor=BG)
ax[1].set_ylim(0,4.8); ax[1].text(3,4.15,"ch 3: 64 → 4",ha="center",fontsize=9,fontweight="bold"); save(f,"03-activation-outliers-smoothquant")

# 04-kv-cache-quantization
f,a=fig("Sequences in a 40 GB KV pool (Llama 3 8B, 8k ctx)"); lab=["fp16 KV","fp8 KV","int4 KV*"]; per=[131072,65536,32768]
v=[int(40e9//(p*8192)) for p in per]; a.bar(lab,v,color=[R,GOLD,G])
for i,x in enumerate(v): a.text(i,x+2,f"{x} seqs",ha="center",fontweight="bold")
a.set_ylabel("concurrent 8k-token sequences"); a.text(2.4,5,"*ignoring scale overhead",ha="right",fontsize=9,color=GR); save(f,"04-kv-cache-quantization")

# 01-the-hbm-bottleneck
f,ax=plt.subplots(1,2,figsize=(12,5))
for k,a in enumerate(ax):
    blank(a,(0,6),(0,6)); a.set_title(["NAIVE: N×N crates ride to HBM","FLASH: tiles stay on-chip"][k],loc="left",color=[R,G][k],fontweight="bold")
    box(a,0.2,0.3,5.6,1.2,"HBM (80 GB, ~3.35 TB/s)",B,fc=B+"22"); box(a,0.2,4.2,5.6,1.2,"SRAM (≤228 KB/SM, on-chip)",GOLD,fc=GOLD+"22")
    if k==0:
        for i,t in enumerate(["S = QKᵀ","mask","P = softmax","O = PV"]):
            x=0.4+i*1.4; a.annotate("",(x+0.3,1.6),(x+0.3,4.1),arrowprops=dict(arrowstyle="->",color=R,lw=2)); a.annotate("",(x+0.7,4.1),(x+0.7,1.6),arrowprops=dict(arrowstyle="->",color=R,lw=2)); a.text(x+0.5,2.85,t,ha="center",fontsize=8,fontweight="bold",bbox=dict(fc=BG,ec="none"))
    else:
        a.annotate("",(2,4.1),(2,1.6),arrowprops=dict(arrowstyle="->",color=G,lw=2.5)); a.text(1.9,2.85,"Q,K,V tiles in",ha="right",fontsize=9)
        a.annotate("",(4,1.6),(4,4.1),arrowprops=dict(arrowstyle="->",color=G,lw=2.5)); a.text(4.1,2.85,"only O out",fontsize=9)
save(f,"01-the-hbm-bottleneck")

# 02-online-softmax
f,a=fig("Online softmax: merge tiles by rescaling",11,4.5); blank(a,(0,11),(0,4.5))
box(a,0.3,2.6,3,1.2,"tile 1: [1, 2]\nm₁ = 2,  l₁ = e⁻¹ + 1 = 1.368",G,fs=9); box(a,0.3,0.6,3,1.2,"tile 2: [3]\nm₂ = 3,  l₂ = 1",P,fs=9)
arrow(a,3.4,3.2,5.0,2.3); arrow(a,3.4,1.2,5.0,1.9)
box(a,5.1,1.4,5.6,1.4,"m = max(2, 3) = 3\nl = 1.368·e^(2−3) + 1·e^(3−3) = 1.503",GOLD,fc=GOLD+"22",fs=10)
a.text(7.9,0.6,"old sums shrink by exp(m_old − m_new)",ha="center",color=GR); save(f,"02-online-softmax")

# 03-tiling-in-sram
f,a=fig("Tiling: one Q block × one K/V block at a time",7,6.5); n=8; M=np.zeros((n,n)); M[2:4,:4]=1; M[2:4,4:6]=2
a.imshow(M,cmap=matplotlib.colors.ListedColormap([BG,"#e9d9a6",G]),vmin=0,vmax=2,extent=(0,n,n,0))
for i in range(n+1): a.axhline(i,color=GR,lw=0.6); a.axvline(i,color=GR,lw=0.6)
for i in range(0,n+1,2): a.axhline(i,color=INK,lw=1.8); a.axvline(i,color=INK,lw=1.8)
a.set_xlabel("keys / values (K/V blocks →)"); a.set_ylabel("queries (Q blocks ↓)"); a.set_xticks([]); a.set_yticks([])
a.text(5,3.1,"in SRAM\nnow",ha="center",color="white",fontweight="bold",fontsize=9); a.text(2,3.1,"done (folded into running m, l, O)",ha="center",fontsize=9); a.text(7,3.1,"next",ha="center",fontsize=9)
save(f,"03-tiling-in-sram")

# 02-acceptance-and-speedup
f,a=fig("Expected tokens per target pass vs draft length γ"); g=np.arange(1,11)
for al,c in [(0.6,R),(0.8,GOLD),(0.9,G)]: a.plot(g,(1-al**(g+1))/(1-al),"o-",color=c,lw=2.5,label=f"α = {al}")
a.axhline(1,color=GR,ls=":"); a.text(10,1.1,"no speculation",ha="right",color=GR); a.set_xlabel("γ (drafted tokens)"); a.set_ylabel("tokens per target pass"); a.legend(facecolor=BG); save(f,"02-acceptance-and-speedup")

# 03-medusa-eagle-and-lookup
f,a=fig("Medusa-style candidate tree (verified in one pass)",11,5.4); blank(a,(0,11),(-0.3,5.2))
box(a,0.3,2.2,1.6,0.7,"'Grove'",INK,fs=10)
firsts=["Street","St.","st"]; kids=[["forever","4 life"],["family","home"],["now","ok"]]
for i,t in enumerate(firsts):
    y=4.0-i*1.7; box(a,3.2,y,1.8,0.7,t,G if i==0 else GOLD,fs=10); a.plot([1.9,3.2],[2.55,y+0.35],color=GR)
    for j,k in enumerate(kids[i]):
        yy=y+0.4-j*0.8; box(a,6.6,yy,1.8,0.6,k,G if (i==0 and j==0) else P,fs=9); a.plot([5.0,6.6],[y+0.35,yy+0.3],color=GR)
a.text(9.0,2.4,"3 + 6 = 9\ncandidate tokens,\none forward pass,\ntree attention mask",fontsize=10,color=B,fontweight="bold"); save(f,"03-medusa-eagle-and-lookup")

# 01-tensor-parallelism
f,a=fig("Megatron MLP across 2 GPUs",12,4.8); blank(a,(0,12),(0,5))
box(a,0.2,2,1.5,1,"X\n(replicated)",INK,fs=9)
for gi,(y,c) in enumerate([(3.4,G),(0.6,P)]):
    box(a,2.4,y,2.4,1,f"GPU{gi}: X·A{gi}\n(A split by columns)",c,fs=9); box(a,5.6,y,2.4,1,f"GELU → ·B{gi}\n(B split by rows)",c,fs=9)
    arrow(a,1.7,2.5,2.4,y+0.5); arrow(a,4.8,y+0.5,5.6,y+0.5); arrow(a,8.0,y+0.5,8.8,2.5)
box(a,8.8,2,1.6,1,"ALL-REDUCE\n(sum)",R,fc=R+"22",fs=9); arrow(a,10.4,2.5,11.0,2.5); a.text(11.1,2.45,"Y",fontsize=14,fontweight="bold")
a.text(6,0.05,"1 all-reduce per MLP + 1 per attention = 2 per layer",ha="center",color=R); save(f,"01-tensor-parallelism")

# 02-pipeline-parallelism
f,a=fig("Pipeline: 4 stages, 6 micro-batches (bubbles in grey)",12,4); p,m=4,6; cs=[G,GOLD,P,B,R,"#00838f"]
for s in range(p):
    for t in range(m+p-1):
        mb=t-s; c=cs[mb] if 0<=mb<m else GR
        a.add_patch(plt.Rectangle((t,p-1-s),0.95,0.9,fc=c,alpha=1 if 0<=mb<m else .35))
        if 0<=mb<m: a.text(t+0.47,p-1-s+0.45,f"m{mb+1}",ha="center",va="center",color="white",fontweight="bold",fontsize=9)
a.set_xlim(0,m+p-1); a.set_ylim(0,p); a.set_yticks([i+0.45 for i in range(p)],[f"stage {p-i}" for i in range(p)]); a.set_xlabel("time slot")
a.text(m+p-1,-0.7,f"bubble = (p−1)/(m+p−1) = {p-1}/{m+p-1} = {100*(p-1)/(m+p-1):.0f}%",ha="right",color=R,fontweight="bold"); save(f,"02-pipeline-parallelism")

# 03-moe-and-expert-parallelism
f,ax=plt.subplots(1,2,figsize=(12,4.8),gridspec_kw={"width_ratios":[1.4,1]})
a=ax[0]; blank(a,(0,8),(0,5)); a.set_title("ROUTER PICKS TOP-2 OF 8",loc="left",color=G,fontweight="bold")
box(a,0.2,2.1,1.4,0.8,"token",INK,fs=9); box(a,2.0,2.1,1.4,0.8,"router",GOLD,fs=9); arrow(a,1.6,2.5,2.0,2.5)
for e in range(8):
    y=4.4-e*0.6; act=e in (2,5); box(a,5,y,2,0.45,f"expert {e}",G if act else GR,fc=(G+"33") if act else "white",fs=8)
    a.plot([3.4,5],[2.5,y+0.22],color=G if act else GR,lw=2 if act else 0.6)
a=ax[1]; mods=["Mixtral\n8x7B","DeepSeek-V3"]; tot=[46.7,671]; act=[12.9,37]
y=np.arange(2); a.barh(y+0.2,tot,0.4,color=GR,label="total params"); a.barh(y-0.2,act,0.4,color=G,label="active per token"); a.set_yticks(y,mods); a.set_xlabel("billions of parameters"); a.legend(facecolor=BG,fontsize=9,loc="lower right")
a.set_title("MEMORY vs BANDWIDTH",loc="left",color=G,fontweight="bold")
for i in range(2): a.text(tot[i]+8,i+0.2,f"{tot[i]}B",va="center",fontsize=9); a.text(act[i]+8,i-0.2,f"{act[i]}B",va="center",fontsize=9,color=G,fontweight="bold")
a.set_xlim(0,800)
save(f,"03-moe-and-expert-parallelism")

# 02-engines-tour
f,a=fig("The engine dealership",9,6.5); blank(a,(0,10),(0,10))
a.axhline(5,color=GR,lw=1); a.axvline(5,color=GR,lw=1)
a.text(5,9.6,"datacenter GPUs",ha="center",color=GR); a.text(5,0.2,"laptops / CPUs / Apple",ha="center",color=GR); a.text(0.2,5.2,"flexible, open",color=GR); a.text(9.8,5.2,"peak NVIDIA perf",ha="right",color=GR)
box(a,1.2,7,3,1.3,"vLLM\nPagedAttention, broad HW",G,fs=9); box(a,1.2,5.4,3,1.2,"SGLang\nRadixAttention, structured out",P,fs=9)
box(a,5.8,6.6,3.4,1.4,"TensorRT-LLM\ncompiled engines, FP8/FP4",B,fs=9); box(a,1.5,1.6,3.4,1.4,"llama.cpp / Ollama\nGGUF, Metal, CPU",GOLD,fs=9)
save(f,"02-engines-tour")

# 03-disaggregated-prefill-decode
f,a=fig("Disaggregated serving",12,4.5); blank(a,(0,12),(0,4.5))
for i in range(2): box(a,0.3,2.6-i*1.4,2.6,1.0,f"prefill GPU {i}\n(compute-bound)",G,fc=G+"22",fs=9)
for i in range(3): box(a,8.6,3.2-i*1.2,3,0.9,f"decode GPU {i}\n(memory-bound)",P,fc=P+"22",fs=9)
box(a,4.2,1.7,3,1.0,"KV transfer\nNVLink / RDMA",GOLD,fs=9); arrow(a,2.9,2.5,4.2,2.2,GOLD); arrow(a,7.2,2.2,8.6,2.2,GOLD)
a.text(1.6,4.0,"optimise TTFT",ha="center",color=G,fontweight="bold"); a.text(10.1,4.3,"optimise TPOT",ha="center",color=P,fontweight="bold")
a.text(5.7,0.5,"4k-token Llama 3 8B prompt ≈ 0.54 GB of KV ≈ 11 ms at 50 GB/s",ha="center"); save(f,"03-disaggregated-prefill-decode")

# 01-server-architecture
f,a=fig("Blueprint of a tiny LLM server",12,4.5); blank(a,(0,12),(0,4.5))
st=[("HTTP API",GR),("tokenizer",B),("scheduler\n+ block mgr",R),("model\nrunner",G),("sampler",GOLD),("detokenize\n+ stream",P)]
for i,(t,c) in enumerate(st):
    box(a,0.2+i*1.97,2.2,1.6,1.1,t,c,fs=9)
    if i: arrow(a,0.2+i*1.97-0.37,2.75,0.2+i*1.97,2.75)
a.annotate("",(4.94,2.15),(8.5,2.15),arrowprops=dict(arrowstyle="->",color=R,connectionstyle="arc3,rad=-0.4",lw=1.6)); a.text(6.7,0.9,"next decode step",ha="center",color=R,fontsize=9)
save(f,"01-server-architecture")

# 02-build-the-scheduler
f,a=fig("One scheduler step (budget 512)",11,3.8); blank(a,(0,11),(0,4))
a.barh(2.5,100/512*9,left=0.5,color=P,height=0.9); a.text(0.5+50/512*9,2.5,"100\ndecodes",ha="center",va="center",color="white",fontsize=8,fontweight="bold")
x=0.5+100/512*9
for n,c in [(200,G),(150,G)]: a.barh(2.5,n/512*9,left=x,color=c,height=0.9,ec=BG); a.text(x+n/1024*9,2.5,f"prompt {n}",ha="center",va="center",color="white",fontsize=9,fontweight="bold"); x+=n/512*9
a.barh(2.5,62/512*9,left=x,color=GR,height=0.9,alpha=.4); a.text(x+31/512*9,2.5,"62\nleft",ha="center",va="center",fontsize=8); a.axvline(9.5,color=INK,ls="--"); a.text(9.55,3.2,"budget",fontsize=9)
box(a,0.5,0.4,1.6,0.7,"prompt 100",R,fs=8); box(a,2.3,0.4,1.4,0.7,"prompt 50",GR,fs=8); a.text(4.0,0.7,"← waits: 100 > 62 left (FIFO stops)",color=R,fontsize=9)
save(f,"02-build-the-scheduler")

# 03-benchmark-and-profile
f,a=fig("Find the knee: latency vs request rate"); r=np.linspace(0.5,10,40); cap=8
p50=0.25+0.05*r+np.where(r>cap,(r-cap)**2*0.6,0); p99=p50*1.8+np.where(r>cap*0.85,(r-cap*0.85)**2*0.5,0)
a.plot(r,p50,color=G,lw=2.5,label="p50 TTFT"); a.plot(r,p99,color=R,lw=2.5,label="p99 TTFT"); a.axvline(cap,color=GOLD,ls=":"); a.text(cap+0.1,0.3,"saturation knee",color=GOLD)
a.set_xlabel("request rate (req/s)"); a.set_ylabel("TTFT (s)"); a.legend(facecolor=BG); a.text(0.6,a.get_ylim()[1]*0.8,"illustrative shape",color=GR,fontsize=9); save(f,"03-benchmark-and-profile")
