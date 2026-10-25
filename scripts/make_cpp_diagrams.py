"""Diagrams for the cpp-systems course. Same palette and helpers as make_diagrams.py.
Run: python scripts/make_cpp_diagrams.py  (needs matplotlib, numpy)."""
import os, pathlib, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
BG="#f4ecd8"; INK="#1b1b1b"; G="#2e7d32"; GOLD="#d4a017"; P="#6a1b9a"; B="#1565c0"; R="#b71c1c"; GR="#9e9e9e"
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":11,"axes.facecolor":BG,"figure.facecolor":BG,"axes.edgecolor":INK,"text.color":INK,"axes.labelcolor":INK})
OUT=str(pathlib.Path(__file__).resolve().parent.parent/"public"/"diagrams"/"cpp-systems")+"/"
def fig(t,w=10,h=5.5):
    f,a=plt.subplots(figsize=(w,h)); a.set_title(t.upper(),fontsize=15,fontweight="bold",color=G,loc="left"); return f,a
def box(a,x,y,w,h,txt,c,fc="white",fs=10):
    a.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.02,rounding_size=0.08",fc=fc,ec=c,lw=2.2))
    a.text(x+w/2,y+h/2,txt,ha="center",va="center",fontsize=fs,color=INK,fontweight="bold")
def cell(a,x,y,w,h,txt,c,fs=9,tc=INK): a.add_patch(Rectangle((x,y),w,h,fc=c,ec=INK,lw=1)); a.text(x+w/2,y+h/2,txt,ha="center",va="center",fontsize=fs,color=tc,fontweight="bold")
def arrow(a,x1,y1,x2,y2,c=INK,ls="-"): a.annotate("",(x2,y2),(x1,y1),arrowprops=dict(arrowstyle="->",lw=2,color=c,ls=ls))
def blank(a,xl,yl): a.set_xlim(*xl); a.set_ylim(*yl); a.axis("off")
def note(a,x,y,t,c=GR,fs=9,**k): a.text(x,y,t,color=c,fontsize=fs,**k)
def save(f,path):
    d=OUT+os.path.dirname(path); os.makedirs(d,exist_ok=True); f.tight_layout(); f.savefig(OUT+path+".png",dpi=150); plt.close(f); print(path)

# ---------- 01-lifetime
f,a=fig("Scope exit runs destructors in reverse",11,4.6); blank(a,(0,11),(0,4.2))
for i,(n,c) in enumerate([("a",G),("b",GOLD),("c",P)]):
    box(a,0.3+i*1.4,2.6,1.1,0.8,f"+{n}",c); box(a,6.3+(2-i)*1.4,2.6,1.1,0.8,f"~{n}",c,fc=c+"22")
arrow(a,4.6,3.0,6.1,3.0); note(a,4.7,3.25,"scope ends",INK,10)
note(a,0.3,2.1,"construction order →",INK,10); note(a,6.3,2.1,"destruction order: c, b, a",INK,10)
box(a,0.3,0.4,3.6,1.0,"throw in the middle\n(stack unwinding)",R,fc=R+"15"); arrow(a,4.0,0.9,6.1,0.9,R)
box(a,6.3,0.4,4.1,1.0,"destructors of already-built\nlocals still run: no leaks",G,fc=G+"15")
save(f,"01-lifetime/01-raii-scope-guards")

f,a=fig("Copy: shallow, deep, or move",11,5); blank(a,(0,11),(0,5))
for k,(t,c) in enumerate([("Shallow (default copy)",R),("Deep copy (rule of 3)",G),("Move (rule of 5)",B)]):
    x=0.3+k*3.6; note(a,x,4.5,t,c,11,fontweight="bold")
    box(a,x,3.2,1.4,0.8,"a.ptr",c); box(a,x+1.7,3.2,1.4,0.8,"b.ptr",c)
    if k==0: box(a,x+0.7,1.0,1.8,0.9,"heap [..]",R,fc=R+"22"); arrow(a,x+0.7,3.2,x+1.3,1.95,R); arrow(a,x+2.4,3.2,x+1.9,1.95,R); note(a,x,0.4,"two deletes = double free",R,9)
    if k==1: box(a,x,1.0,1.4,0.9,"heap A",G,fc=G+"22"); box(a,x+1.7,1.0,1.4,0.9,"heap B",G,fc=G+"22"); arrow(a,x+0.7,3.2,x+0.7,1.95,G); arrow(a,x+2.4,3.2,x+2.4,1.95,G); note(a,x,0.4,"each owns its own buffer",G,9)
    if k==2: box(a,x+1.7,1.0,1.4,0.9,"heap",B,fc=B+"22"); arrow(a,x+2.4,3.2,x+2.4,1.95,B); note(a,x+0.2,2.6,"a.ptr = nullptr",GR,9); note(a,x,0.4,"pointer stolen: O(1), no alloc",B,9)
save(f,"01-lifetime/02-rule-of-zero-three-five")

f,a=fig("A view outliving its owner",10,4.6); blank(a,(0,10),(0,4.4))
box(a,0.3,3.0,2.6,0.9,"std::string tmp\n(temporary)",GOLD); box(a,4.0,3.0,3.2,0.9,"heap: \"Carl Johnson\"",GOLD,fc=GOLD+"22"); arrow(a,2.9,3.45,4.0,3.45,GOLD)
box(a,0.3,1.0,2.6,0.9,"string_view sv",B); arrow(a,2.9,1.45,4.4,2.95,B)
a.plot([4.0,7.2],[3.0,3.9],color=R,lw=3); a.plot([4.0,7.2],[3.9,3.0],color=R,lw=3)
note(a,4.0,2.4,"freed at end of full-expression",R,10); note(a,3.4,0.9,"sv still points here → dangling (UB)",R,10)
save(f,"01-lifetime/03-lifetime-and-dangling")

# ---------- 02-move
f,a=fig("Value categories",10,5.4); blank(a,(0,10),(0,5.4))
a.add_patch(FancyBboxPatch((0.3,0.5),5.6,3.6,boxstyle="round,pad=0.02",fc=G+"18",ec=G,lw=2.5)); note(a,0.5,3.75,"glvalue (has identity)",G,11,fontweight="bold")
a.add_patch(FancyBboxPatch((3.6,0.3),6.0,3.0,boxstyle="round,pad=0.02",fc=P+"18",ec=P,lw=2.5)); note(a,7.1,2.95,"rvalue (movable)",P,11,fontweight="bold")
box(a,0.7,1.3,2.4,1.3,"lvalue\nx, *p, v[0]",G); box(a,3.85,1.0,1.9,1.5,"xvalue\nstd::move(x)",GOLD); box(a,6.6,1.0,2.6,1.5,"prvalue\n42, f(), T{}",P)
note(a,0.5,4.6,"Rule of thumb: a name is an lvalue, even if its type is T&&",INK,10)
save(f,"02-move/01-value-categories")

f,a=fig("vector growth: copy or move?",11,4.8); blank(a,(0,11),(0,4.6))
for r,(t,c,y,lab) in enumerate([("move ctor NOT noexcept → copies",R,2.7,"copy"),("move ctor noexcept → moves",G,0.5,"move")]):
    note(a,0.2,y+1.45,t,c,11,fontweight="bold")
    for i in range(4): cell(a,0.3+i*0.9,y,0.8,0.8,f"e{i}",c+"33")
    for i in range(8): cell(a,5.6+i*0.65,y,0.6,0.8,f"e{i}" if i<4 else "",c+"33" if i<4 else "white",8)
    arrow(a,4.0,y+0.4,5.5,y+0.4,c); note(a,4.15,y+0.55,lab,c,10)
note(a,5.6,4.3,"strong exception guarantee wins unless the move can't throw",GR,9)
save(f,"02-move/02-move-and-noexcept")

f,a=fig("Reference collapsing",8,4.8); blank(a,(0,8),(0,4.8))
rows=[("T& &","T&",R),("T& &&","T&",R),("T&& &","T&",R),("T&& &&","T&&",G)]
cell(a,1,4.0,3,0.6,"combined",GR,11,"white"); cell(a,4,4.0,3,0.6,"collapses to",GR,11,"white")
for i,(x,y,c) in enumerate(rows): cell(a,1,3.3-i*0.7,3,0.7,x,"white",12); cell(a,4,3.3-i*0.7,3,0.7,y,c+"33",12)
note(a,1,0.2,"Any & wins. std::forward<T> restores the original category.",INK,10)
save(f,"02-move/03-perfect-forwarding")

# ---------- 03-ownership
f,a=fig("unique_ptr: what it costs",10,4.2); blank(a,(0,10),(0,4))
box(a,0.3,2.4,2.4,0.9,"unique_ptr<T>",G); cell(a,3.2,2.4,2.0,0.9,"T* (8 B)",G+"33",10); note(a,5.5,2.75,"empty deleter: 8 bytes, same as T*",G,10)
box(a,0.3,0.6,2.4,0.9,"unique_ptr<T,\nvoid(*)(T*)>",GOLD); cell(a,3.2,0.6,2.0,0.9,"T* (8 B)",GOLD+"33",10); cell(a,5.2,0.6,2.0,0.9,"fn ptr (8 B)",GOLD+"66",10); note(a,7.4,0.95,"16 bytes",GOLD,11)
save(f,"03-ownership/01-unique-ptr-and-deleters")

f,a=fig("shared_ptr and its control block",11,5); blank(a,(0,11),(0,5))
note(a,0.3,4.5,"shared_ptr<T>(new T)",INK,11,fontweight="bold"); box(a,0.3,3.0,2.0,0.9,"sp: ptr | ctrl",B)
box(a,3.2,3.6,2.0,0.8,"T object",G,fc=G+"22"); box(a,3.2,2.5,2.6,0.8,"ctrl: strong=1 weak=0",GOLD,fc=GOLD+"22"); arrow(a,2.3,3.6,3.2,4.0); arrow(a,2.3,3.2,3.2,2.9)
note(a,0.3,3.0-0.6,"2 allocations",R,10)
note(a,6.4,4.5,"make_shared<T>()",INK,11,fontweight="bold"); box(a,6.4,3.0,2.0,0.9,"sp: ptr | ctrl",B)
box(a,8.8,2.6,2.0,1.6,"ctrl + T\n(one block)",G,fc=G+"22"); arrow(a,8.4,3.45,8.8,3.45); note(a,6.4,2.4,"1 allocation, better locality",G,10)
note(a,0.3,0.8,"Copying a shared_ptr = atomic increment of strong count.\nThe object dies at strong=0; the block dies at strong=weak=0.",INK,10)
save(f,"03-ownership/02-shared-ptr-control-block")

f,a=fig("Cycles leak; weak edges don't",11,4.4); blank(a,(0,11),(0,4.2))
for x,c,t in [(0.5,R,"shared ↔ shared"),(6.2,G,"shared → / weak ←")]:
    box(a,x,2.0,1.6,0.9,"A",c); box(a,x+3.0,2.0,1.6,0.9,"B",c); note(a,x,3.5,t,c,12,fontweight="bold")
    arrow(a,x+1.6,2.65,x+3.0,2.65,c); arrow(a,x+3.0,2.25,x+1.6,2.25,c,"--" if c==G else "-")
note(a,0.5,1.2,"counts stuck at 1 after owners go: leak",R,10); note(a,6.2,1.2,"back-edge doesn't count: both freed",G,10)
save(f,"03-ownership/03-weak-ptr-and-cycles")

# ---------- 04-templates
f,a=fig("Deduction with const int& argument",10,4.2); blank(a,(0,10),(0,4))
hdr=["parameter","T deduced","param type"]; rows=[("f(T x)","int","int (copy, const dropped)"),("f(T& x)","const int","const int&"),("f(T&& x)","const int&","const int& (collapsed)")]
for j,h in enumerate(hdr): cell(a,0.3+[0,2.4,5.0][j],3.0,[2.4,2.6,4.4][j],0.6,h,GR,11,"white")
for i,r in enumerate(rows):
    for j,v in enumerate(r): cell(a,0.3+[0,2.4,5.0][j],2.3-i*0.7,[2.4,2.6,4.4][j],0.7,v,[G,GOLD,P][i]+"22",10)
save(f,"04-templates/01-templates-and-deduction")

f,a=fig("Most constrained overload wins",9,5); blank(a,(0,9),(0,5))
a.add_patch(Circle((3.2,2.4),2.1,fc=G+"18",ec=G,lw=2.5)); a.add_patch(Circle((3.6,2.0),1.1,fc=P+"22",ec=P,lw=2.5))
note(a,1.6,3.8,"std::integral",G,12,fontweight="bold"); note(a,2.9,2.0,"signed_integral",P,10,fontweight="bold")
note(a,5.8,3.3,"f(42)  → signed overload",P,11); note(a,5.8,2.5,"f(42u) → integral overload",G,11); note(a,5.8,1.7,"f(1.0) → no match",R,11)
save(f,"04-templates/02-concepts-and-constraints")

f,a=fig("Move work to compile time",11,4.4); blank(a,(0,11),(0,4.2))
box(a,0.3,2.4,4.6,1.2,"COMPILE TIME\nconstexpr tables, static_assert,\nif constexpr picks a branch per T",G,fc=G+"18")
box(a,6.0,2.4,4.6,1.2,"RUN TIME\njust loads a precomputed value",B,fc=B+"18"); arrow(a,4.9,3.0,6.0,3.0)
box(a,0.3,0.4,2.1,1.0,"T = int\n→ branch A",P); box(a,2.8,0.4,2.1,1.0,"T = float\n→ branch B",P); note(a,6.0,0.8,"untaken branch is never instantiated",GR,10)
save(f,"04-templates/03-constexpr-and-compile-time")

# ---------- 05-stl
f,a=fig("Vector growth and invalidation",11,4.6); blank(a,(0,11),(0,4.4))
x=0.3
for cap in [1,2,4,8]:
    for i in range(cap): cell(a,x+i*0.55,3.0,0.5,0.6,"",G+"55" if cap<8 else G+"22")
    note(a,x,3.75,f"cap {cap}",INK,9); x+=cap*0.55+0.5
note(a,0.3,2.4,"each growth: allocate 2x, move elements, free old block",INK,10)
cell(a,0.3,1.0,2.0,0.7,"freed block",GR,9,"white"); box(a,3.2,1.0,2.4,0.7,"int& first",R); arrow(a,3.2,1.35,2.35,1.35,R); note(a,6.0,1.2,"held reference now dangles: UB",R,10)
note(a,0.3,0.3,"1000 push_backs (libstdc++): 11 reallocations; reserve(1000): 1",GR,9)
save(f,"05-stl/01-containers-and-invalidation")

f,a=fig("A lazy pipeline: one element at a time",11,3.8); blank(a,(0,11),(0,3.4))
for i,(t,c) in enumerate([("v\n5 2 8 1 9 4",GR),("filter\nx > 3",G),("transform\nx * x",P),("take(2)",GOLD),("out\n25 64",B)]):
    box(a,0.3+i*2.15,1.4,1.8,1.1,t,c)
    if i: arrow(a,0.3+i*2.15-0.35,1.95,0.3+i*2.15,1.95)
note(a,0.3,0.6,"no temporary vectors: values are pulled through on demand, then the pipeline stops",GR,10)
save(f,"05-stl/02-algorithms-and-ranges")

f,a=fig("span = pointer + length",10,3.8); blank(a,(0,10),(0,3.4))
for i in range(12): cell(a,0.3+i*0.75,1.6,0.7,0.7,f"{i}",GOLD+("66" if 3<=i<8 else "15"))
box(a,2.55,0.2,3.6,0.8,"span{ data=&buf[3], size=5 }",B); arrow(a,3.0,1.0,2.6,1.55,B)
note(a,0.3,2.7,"buffer (owned by someone else)",INK,10); note(a,6.6,0.4,"16 bytes, no copy",B,10)
save(f,"05-stl/03-views-span-and-string-view")

# ---------- 06-layout
f,a=fig("Same members, different size",11,4.4); blank(a,(0,12.6),(0,4))
def row(y,lbl,cells,tot):
    note(a,0.2,y+0.25,lbl,INK,10,fontweight="bold")
    for i,c in enumerate(cells): cell(a,3.0+i*0.75,y,0.72,0.6,c if c!="." else "",{"c":G+"55","d":G+"55","i":P+"55",".":GR+"55"}[c])
    note(a,3.0+len(cells)*0.75+0.2,y+0.2,f"= {tot} B",INK,11)
row(2.6,"A {char c; int i; char d;}",list("c...iiiid..."),12)
row(1.2,"B {int i; char c; char d;}",list("iiiicd.."),8)
note(a,3.0,0.4,"grey = padding",GR,10)
save(f,"06-layout/01-sizeof-padding-alignment")

f,a=fig("Row walk vs column walk",11,5); blank(a,(0,11),(0,5))
for k,(t,c) in enumerate([("row order: consecutive lines",G),("column order: new line every step",R)]):
    x0=0.3+k*5.5; note(a,x0,4.5,t,c,11,fontweight="bold")
    for r in range(4):
        cell(a,x0,3.4-r*0.85,4.6,0.7,"",c+"15")
        for j in range(8): a.add_patch(Rectangle((x0+j*0.575,3.4-r*0.85),0.575,0.7,fc="none",ec=GR,lw=0.6))
    if k==0: arrow(a,x0+0.1,3.75,x0+4.5,3.75,c)
    else: arrow(a,x0+0.28,3.9,x0+0.28,0.9,c)
    note(a,x0,0.3,"each band = one 64-byte line (16 floats)" if k==0 else "uses 4 of 64 bytes per line fetched",c,9)
save(f,"06-layout/02-cache-lines-and-locality")

f,a=fig("Rounding up to a 64-byte boundary",11,3.6); blank(a,(900,1150),(0,3))
a.plot([900,1150],[1.5,1.5],color=INK,lw=2)
for b in [960,1024,1088]: a.plot([b,b],[1.2,1.8],color=B,lw=3); note(a,b-12,2.0,str(b),B,11)
a.plot([1000],[1.5],"o",color=R,ms=10); note(a,988,0.9,"1000",R,11); arrow(a,1002,1.35,1022,1.35,G)
note(a,905,0.25,"(1000 + 63) & ~63 = 1024",INK,11,fontweight="bold")
save(f,"06-layout/03-aligned-allocation")

# ---------- 07-dod
f,a=fig("AoS vs SoA: reading only x",11,4.6); blank(a,(0,11.5),(0,4.4))
note(a,0.2,3.9,"AoS: x is 1 of every 8 fields",R,11,fontweight="bold")
for i in range(16): cell(a,0.3+i*0.68,3.0,0.65,0.6,["x","y","z","vx","vy","vz","m","id"][i%8],(R+"66") if i%8==0 else "white",8)
note(a,0.2,2.0,"SoA: x values back to back",G,11,fontweight="bold")
for i in range(16): cell(a,0.3+i*0.68,1.1,0.65,0.6,f"x{i}",G+"66",8)
note(a,0.3,0.3,"same 1M-particle loop: 32 MB streamed (AoS) vs 4 MB (SoA)",INK,10)
save(f,"07-dod/01-aos-vs-soa")

f,a=fig("Hot/cold splitting",11,4.6); blank(a,(0,11),(0,4.4))
note(a,0.2,3.9,"before: 128-byte Enemy, half an object per 64-byte line",R,10,fontweight="bold")
for i in range(2): cell(a,0.3+i*4.2,3.0,0.7,0.6,"hot",R+"66",8); cell(a,1.0+i*4.2,3.0,3.4,0.6,"name, inventory, debug (cold)",GR+"44",8)
note(a,0.2,2.1,"after: hot array (16 B each, 4 per line) + cold array",G,10,fontweight="bold")
for i in range(12): cell(a,0.3+i*0.75,1.2,0.72,0.6,"hot",G+"66",8)
for i in range(3): cell(a,0.3+i*2.4,0.3,2.3,0.5,"cold[i]",GR+"44",8)
save(f,"07-dod/02-hot-cold-splitting")

f,a=fig("A mispredict flushes the pipeline",11,4.2); blank(a,(0,22),(0,4))
for i in range(20): cell(a,1+i,2.6,1,0.7,"",G+"55")
note(a,1,3.5,"correct guess: keeps streaming",G,10,fontweight="bold")
for i in range(6): cell(a,1+i,0.8,1,0.7,"",G+"55")
for i in range(6,10): cell(a,1+i,0.8,1,0.7,"✗",R+"55")
for i in range(10,20): cell(a,1+i,0.8,1,0.7,"",G+"55")
note(a,7,1.7,"wrong path discarded: ~15-20 cycles lost",R,10,fontweight="bold")
save(f,"07-dod/03-branches-and-predictability")

# ---------- 08-ub
f,a=fig("How a null check disappears",11,3.8); blank(a,(0,11),(0,3.4))
for i,(t,c) in enumerate([("int v = *p;",INK),("so p != nullptr\n(UB otherwise)",P),("if (p == nullptr)\nis always false",GOLD),("check deleted",R)]):
    box(a,0.3+i*2.75,1.4,2.3,1.2,t,c if c!=INK else B)
    if i: arrow(a,0.3+i*2.75-0.45,2.0,0.3+i*2.75,2.0)
note(a,0.3,0.5,"fix: test the pointer before dereferencing",G,11)
save(f,"08-ub/01-ub-catalogue")

f,a=fig("float32 and bfloat16 bits",11,3.8); blank(a,(0,33),(0,3.4))
for i in range(32): cell(a,0.5+i,1.6,1,0.8,"",(R if i==0 else GOLD if i<9 else B)+("66" if i<16 else "22"),7)
note(a,0.5,2.65,"sign",R,10); note(a,3.5,2.65,"exponent (8, bias 127)",GOLD,10); note(a,14,2.65,"mantissa (23)",B,10)
a.annotate("",(16.5,1.3),(0.5,1.3),arrowprops=dict(arrowstyle="<->",color=G,lw=2)); note(a,5,0.6,"bfloat16 = top 16 bits",G,11,fontweight="bold")
note(a,18,0.6,"read the bits with std::bit_cast, not a pointer cast",INK,10)
save(f,"08-ub/02-aliasing-and-bit-cast")

f,a=fig("Sanitizer cameras",11,4); blank(a,(0,11),(0,3.6))
for i,(n,w,s,c) in enumerate([("ASan","out-of-bounds, use-after-free, leaks","~2x",B),("UBSan","overflow, bad shifts, misalignment","small",GOLD),("TSan","data races","5-15x",P)]):
    box(a,0.3+i*3.6,1.4,3.2,1.5,f"{n}\n{w}",c,fs=9); note(a,0.3+i*3.6,0.9,f"slowdown {s}",c,10)
note(a,0.3,0.25,"ASan+UBSan in one build; TSan in a separate job",INK,10)
save(f,"08-ub/03-sanitizers")

# ---------- 09-concurrency
f,a=fig("jthreads with per-thread slots",10,4.4); blank(a,(0,10),(0,4.2))
for t in range(4):
    box(a,0.3+t*2.4,2.8,2.0,0.8,f"jthread {t}\nchunk {t}",[G,GOLD,P,B][t],fs=9); arrow(a,1.3+t*2.4,2.75,1.3+t*2.4,2.0,[G,GOLD,P,B][t]); cell(a,0.8+t*2.4,1.3,1.0,0.6,f"part[{t}]",[G,GOLD,P,B][t]+"44",9)
box(a,3.5,0.2,3.0,0.7,"scope exit: join all, then sum",INK)
save(f,"09-concurrency/01-threads-and-jthread")

f,a=fig("Release publishes, acquire receives",11,4.6); blank(a,(0,11),(0,4.4))
note(a,0.5,3.9,"producer",G,12,fontweight="bold"); note(a,6.5,3.9,"consumer",B,12,fontweight="bold")
box(a,0.5,2.7,3.6,0.7,"payload = 42",G); box(a,0.5,1.5,3.6,0.7,"ready.store(true, release)",G)
box(a,6.5,1.5,3.9,0.7,"ready.load(acquire) == true",B); box(a,6.5,0.3,3.9,0.7,"reads payload → 42",B)
arrow(a,2.3,2.7,2.3,2.2); arrow(a,8.45,1.5,8.45,1.0); arrow(a,4.1,1.85,6.5,1.85,P); note(a,4.3,2.05,"synchronizes-with",P,10)
save(f,"09-concurrency/02-atomics-and-memory-order")

f,a=fig("False sharing",11,4.4); blank(a,(0,11),(0,4.2))
note(a,0.3,3.8,"one line, two writers: it ping-pongs",R,11,fontweight="bold"); cell(a,0.3,2.7,2.4,0.7,"c0 | c1",R+"44",10)
box(a,3.4,3.0,1.4,0.6,"core 0",R,fs=9); box(a,3.4,2.2,1.4,0.6,"core 1",R,fs=9); arrow(a,2.7,3.2,3.4,3.3,R); arrow(a,2.7,2.9,3.4,2.5,R)
note(a,5.8,3.8,"alignas(64): one line each",G,11,fontweight="bold"); cell(a,5.8,2.9,2.4,0.6,"c0 + pad",G+"44",10); cell(a,5.8,2.2,2.4,0.6,"c1 + pad",G+"44",10)
note(a,0.3,0.8,"symptom: more threads → slower. Fix: pad, or accumulate locally and write once.",INK,10)
save(f,"09-concurrency/03-false-sharing")

# ---------- 10-simd
f,a=fig("Scalar vs 4-lane SSE",10,4.2); blank(a,(0,10),(0,4))
note(a,0.3,3.5,"scalar: 4 instructions",R,11,fontweight="bold")
for i in range(4): cell(a,0.3+i*1.1,2.6,1.0,0.6,f"a{i}+b{i}",R+"33",9)
note(a,5.3,3.5,"SSE addps: 1 instruction",G,11,fontweight="bold"); cell(a,5.3,2.6,4.4,0.6,"[a0..a3] + [b0..b3]",G+"44",10)
note(a,0.3,1.2,"SSE2: 4 floats (x86-64 baseline) | AVX2: 8 | AVX-512: 16",INK,10)
save(f,"10-simd/01-auto-vectorization")

f,a=fig("Vector body, horizontal sum, scalar tail",11,4.4); blank(a,(0,11.5),(0,4.2))
for i in range(11): cell(a,0.3+i*0.95,3.0,0.9,0.6,f"x{i}",(G if i<8 else GOLD)+"44",9)
note(a,0.3,3.8,"n = 11: two 4-wide iterations + 3 tail elements",INK,10)
for l in range(4): cell(a,0.3+l*1.0,1.6,0.95,0.6,f"acc{l}",G+"66",9)
arrow(a,4.4,1.9,5.4,1.9); box(a,5.5,1.5,2.4,0.8,"(a0+a1)+(a2+a3)",P,fs=9); arrow(a,7.9,1.9,8.6,1.9); box(a,8.7,1.5,2.4,0.8,"+ tail x8..x10",GOLD,fs=9)
save(f,"10-simd/02-intrinsics-sse")

f,a=fig("One chain vs four chains",11,4.6); blank(a,(0,21),(0,4.6))
note(a,0.3,4.1,"1 accumulator: each add waits ~4 cycles for the previous one",R,10,fontweight="bold")
for i in range(4): cell(a,0.3+i*4,3.3,4,0.5,f"s += x{i}",R+"44",8)
note(a,0.3,2.6,"4 accumulators: independent chains overlap in the pipeline",G,10,fontweight="bold")
for ch in range(4): cell(a,0.3+ch,2.0-ch*0.42,4,0.36,f"s{ch} += x{ch}",[G,GOLD,P,B][ch]+"55",7)
note(a,9.0,1.0,"4 adds finish in ~7 cycles instead of 16",G,10)
note(a,0.3,0.05,"cycles →",GR,9)
save(f,"10-simd/03-reductions-and-accumulators")

# ---------- 11-perf
f,a=fig("Warm up, repeat, take the median",10,4.6)
rng=np.random.default_rng(3); xs=np.arange(30); ys=np.r_[rng.normal(140,10,5),rng.normal(100,4,25)]; ys[17]=150
a.plot(xs,ys,"o",color=B); a.axvspan(-0.5,4.5,color=GOLD,alpha=0.25); a.axhline(np.median(ys[5:]),color=G,lw=2.5)
a.text(0.2,165,"warm-up",color=GOLD,fontweight="bold"); a.text(18,103,"median",color=G,fontweight="bold"); a.text(17.4,153,"outlier",color=R)
a.set_xlabel("repetition"); a.set_ylabel("ns / call"); a.set_ylim(80,175)
save(f,"11-perf/01-benchmarking-pitfalls")

f,a=fig("Reading a flame graph",11,4.6); blank(a,(0,100),(0,5.4))
for x,w,y,t,c in [(0,100,0,"main",GR),(0,78,1,"forward",B),(78,22,1,"tokenize",B),(0,62,2,"matmul",R),(62,16,2,"softmax",GOLD),(78,10,2,"lookup",GOLD),(0,8,3,"pack_B",P),(62,6,3,"exp",P)]:
    cell(a,x,y*1.0+0.2,w,0.9,t,c+"88",10)
note(a,10,4.6,"wide plateau = hot self-time (matmul): look here first",R,11,fontweight="bold")
save(f,"11-perf/02-profilers-and-flamegraphs")

f,a=fig("Source and assembly side by side",11,4.4); blank(a,(0,11),(0,4.2))
box(a,0.3,0.6,4.2,3.0,"for (i...)\n  y[i] += a * x[i];",B,fs=11)
asm=["vbroadcastss ymm0, xmm0","vmovups ymm1, [rsi+rax]","vfmadd213ps ymm1, ymm0, [rdi+rax]","vmovups [rdi+rax], ymm1","add rax, 32 ; cmp ; jne"]
for i,l in enumerate(asm): cell(a,5.3,3.2-i*0.6,5.4,0.55,l,(G+"55") if "ps" in l else "white",9)
arrow(a,4.5,2.1,5.3,2.1); note(a,5.3,0.2,"ps = packed single: 8 floats per instruction (AVX2)",G,10)
save(f,"11-perf/03-reading-assembly")

# ---------- 12-building-blocks
f,a=fig("Arena: bump, bump, reset",11,3.8); blank(a,(0,11),(0,3.4))
cell(a,0.3,1.6,10.4,0.8,"",BG)
for x,w,c,t in [(0.3,1.5,G,"a"),(2.0,2.2,GOLD,"b (64-aligned)"),(4.2,1.4,P,"c")]: cell(a,x,1.6,w,0.8,t,c+"66",9)
cell(a,1.8,1.6,0.2,0.8,"",GR+"88"); arrow(a,5.6,2.9,5.6,2.45,R); note(a,5.0,3.0,"offset",R,10)
note(a,0.3,0.8,"alloc = align_up(offset) + bump  •  reset() = offset = 0 (everything freed at once)",INK,10)
save(f,"12-building-blocks/01-arena-allocator")

f,a=fig("SPSC ring buffer",9,6); blank(a,(-4.5,4.5),(-3.7,3.7)); a.set_aspect("equal")
for i in range(8):
    th=np.pi/2-i*2*np.pi/8; x,y=2.4*np.cos(th),2.4*np.sin(th); a.add_patch(Circle((x,y),0.55,fc=(G+"66") if i in (2,3,4) else "white",ec=INK)); a.text(x,y,str(i),ha="center",va="center",fontweight="bold")
note(a,-4.4,-3.5,"head = 5: producer writes next (own cache line)",G,10); note(a,0.4,3.3,"tail = 2: consumer reads next (own cache line)",B,10)
a.annotate("",(-2.16,-2.16),(-3.2,-3.2),arrowprops=dict(arrowstyle="->",color=G,lw=2)); a.annotate("",(3.05,0.00),(3.4,3.1),arrowprops=dict(arrowstyle="->",color=B,lw=2))
a.text(0,0,"slot = i & 7",ha="center",fontweight="bold",color=P)
save(f,"12-building-blocks/02-spsc-ring-buffer")

f,a=fig("Thread pool with futures",11,4.4); blank(a,(0,11),(0,4.2))
box(a,0.3,1.6,1.8,1.0,"submit(f)",B); arrow(a,2.1,2.1,2.9,2.1)
for i in range(4): cell(a,3.0+i*0.7,1.8,0.65,0.6,"task",GOLD+"66",8)
for w in range(3): box(a,6.6,3.0-w*1.1,1.8,0.8,f"worker {w}",G,fs=9); arrow(a,5.8,2.1,6.6,3.4-w*1.1,G)
box(a,9.0,1.6,1.7,1.0,"future\n.get()",P,fs=9); arrow(a,8.4,2.3,9.0,2.1,P)
note(a,0.3,0.3,"exceptions travel through the future too",GR,10)
save(f,"12-building-blocks/03-thread-pool")

# ---------- 13-capstone
f,a=fig("Shape, strides and a free transpose",11,4.6); blank(a,(0,12.5),(0,4.4))
for i in range(24): cell(a,0.3+i*0.5,3.0,0.48,0.6,str(i),[G,GOLD][(i//12)]+("55" if (i//4)%2 else "22"),7)
note(a,0.3,3.8,"flat buffer, shape [2,3,4], strides [12,4,1]",INK,10,fontweight="bold")
note(a,0.3,2.2,"offset[1,2,3] = 1·12 + 2·4 + 3·1 = 23",P,11,fontweight="bold")
box(a,0.3,0.4,4.6,1.0,"[3,4] strides [4,1]",B,fs=10); arrow(a,4.9,0.9,6.0,0.9); box(a,6.0,0.4,4.6,1.0,"transpose: [4,3] strides [1,4]\nsame buffer, no copy",G,fs=10)
save(f,"13-capstone/01-tensors-and-strides")

f,a=fig("Tiled matmul",11,4.8); blank(a,(0,11),(0,4.6))
for x0,lab,hi in [(0.3,"A (M×K)",(1,0)),(4.0,"B (K×N)",(0,2)),(7.7,"C (M×N)",(1,2))]:
    for r in range(4):
        for c in range(4): cell(a,x0+c*0.75,3.2-r*0.75,0.75,0.75,"",(R+"77") if (r,c)==hi else "white")
    note(a,x0,4.15,lab,INK,11,fontweight="bold")
note(a,3.5,2.0,"×",INK,20); note(a,7.2,2.0,"=",INK,20)
note(a,0.3,0.2,"each T×T tile stays in cache and is reused T times; i-k-j inner loop streams rows",INK,10)
save(f,"13-capstone/02-tiled-matmul")

f,ax=plt.subplots(1,3,figsize=(12,3.8)); lg=np.array([1000,1001,1002.])
ax[0].bar(range(3),lg,color=GR); ax[0].set_ylim(995,1003); ax[0].set_title("logits",fontweight="bold")
ax[1].bar(range(3),lg-lg.max(),color=GOLD); ax[1].set_title("minus max",fontweight="bold")
p=np.exp(lg-lg.max()); p/=p.sum(); ax[2].bar(range(3),p,color=G); ax[2].set_title("softmax (max p = 0.665)",fontweight="bold")
for x in ax: x.set_xticks(range(3),["t0","t1","t2"])
f.suptitle("STABLE SOFTMAX",color=G,fontweight="bold",fontsize=15,x=0.1,ha="left"); save(f,"13-capstone/03-softmax-and-sampling")
