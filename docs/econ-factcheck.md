# Economics and game theory fact-check (Round 9)

Checked November 2026. I verified every factual claim, date, attribution, experiment result and worked answer in `content/courses/economics` and `content/courses/game-theory` against the sources below. I recomputed every payoff, equilibrium and number by hand, and I simulated the game configs with `src/lib/games/*.ts` (200 to 300 seeds for the tournaments).

The generators live outside the repo in `/workspace/gnosis/econgen/`. The edits are in `factcheck_edits.py` and `sources.py`. No lesson or exercise id changed. The two new lessons are appended to module 08 of each course.

Severity levels: **High** means it teaches something wrong or a hint fails. **Medium** means a misattribution, a misleading claim, or an exercise that marks a correct answer wrong. **Low** means imprecise wording or missing context.

## Issues

| # | Sev | Where | Claim | Verdict | Source | Fix |
|---|---|---|---|---|---|---|
| 1 | High | econ 07 compounding-race | "₹10,000/month at 12% for 25 years gets there; so does ₹8,000 for 30" (₹50 lakh real at 6% inflation) | Wrong. The game's own `compound()` gives ₹43.8 lakh and ₹48.7 lakh, so both hints fail | Recomputed with `compound()` | ₹10,000 needs 27 years (₹50.0 lakh); ₹8,000 needs about 32 |
| 2 | High | econ 03 elastic-or-not, "What to remember" | Long-run petrol demand is elastic (card data gave 1.25) | Wrong. Long-run fuel elasticity is about 0.64 on average (0.25 short run) | Goodwin, Dargay & Hanly 2004 | Card data now gives 0.88. Text says petrol gets 2-3x more elastic but stays below 1 |
| 3 | High | gt 06 axelrod-tournament, clean round | "Always defect gets stonewalled", so TFT and grim finish top 2 | Config bug. Always defect finished top 2 in 75% of seeds, because the field fed it always-cooperate, random and alternator | Simulation, 200 seeds | Added tit-for-two-tats to the field. Now TFT is top 2 in 100% of seeds, grim in 99%, always-defect 0% |
| 4 | High | gt 03 think-like-the-crowd | Shares are "typical results from class polls" | Invented, except heads/tails (36/42 is Schelling's real figure) | Schelling 1957 JCR footnote | Labelled the shares as estimates. Used Schelling's real number list (7, 100, 13, 261) and his 50-50 split figure (36/41) |
| 5 | Medium | gt 06 repeated-concepts | "Each played every other for 200 rounds. The winner, both times..." | Wrong for round 2: 62 entries, unknown length averaging 151 moves | Axelrod 1980a/b; Axelrod 1984 | Described both tournaments correctly |
| 6 | Medium | gt 04 mixed-concepts, penalty table | Rows and columns labelled literal left and right | Palacios-Huerta's L/R mean the kicker's non-natural/natural side. The numbers 58.30/94.97/92.91/69.92 are correct | Palacios-Huerta 2003 | Added the side definition, the kicker mix (38%) and the observed mixes (about 40% and 42%). Updated the diagram label |
| 7 | Medium | gt 02 beauty-contest | 0 is "the only Nash equilibrium" | With whole numbers 0-100, everyone picking 1 is also an equilibrium | Standard result (e.g. Brown CS1440 notes); Nagel 1995 | Added the note |
| 8 | Medium | gt 04 hawks-and-doves | Maynard Smith & Price (1973) used hawk and dove | The 1973 paper used five strategies (Mouse, Hawk, Bully, Retaliator, Prober-Retaliator). The two-strategy hawk-dove game came later (Maynard Smith 1982) | Maynard Smith & Price 1973 | Reworded |
| 9 | Medium | econ 04 test-firms, ordering | Order: MR, then MC, then quantity, then price | The MR and MC steps can be swapped, so a correct order was marked wrong | Logic | Merged them into one step and added "find the demand curve" first |
| 10 | Low | econ 07 inflation-eats | Aunt keeps real value iff inflation is 6.5% or less | The game compounds monthly (6.70% a year), so the threshold is about 6.7% | `compound()` | Explained it |
| 11 | Low | gt 02 beauty-contest hint | Round-1 winners pick 20 to 25 | The bot crowd's target is 19-22 across seeds | Simulation | Changed to 19 to 22 |
| 12 | Low | gt 02 beauty-contest | "Nagel ran this number version ... in 1995" | Published 1995. Nagel's p=2/3 first round had mean 36.73, median 33 and no zeros (all confirmed) | Nagel 1995 AER | Reworded and added the median |
| 13 | Low | gt 08 fairness-concepts + test | Proposers offer "about 40% on average" | Mode and median are 40-50%, the mean 30-40%. Offers under 20% are rejected about half the time | Camerer 2003; Güth et al. 1982 | Reworded; test option is now "30-50%" |
| 14 | Low | gt 03 nash-concepts | "Most of his students chose Grand Central at noon" | An absolute majority of an informal New Haven sample chose the Grand Central information booth; nearly all chose noon | Schelling 1957/1960 | Reworded |
| 15 | Low | econ 06 failure-concepts | Tragedy of the commons "named by Hardin in 1968" | Hardin named it. The idea is from W. F. Lloyd (1833) | Hardin 1968 | Added Lloyd |
| 16 | Low | gt 01 monty-hall | Host rules unstated | 2/3 holds only if the host always opens a goat door and always offers the switch | Selvin 1975; vos Savant 1990 | Stated the rules and added a source note |
| 17 | Low | econ 08 macro-concepts | Recession "often defined as two quarters in a row" | A rule of thumb, not official (the NBER uses several measures) | NBER; OpenStax | Reworded |
| 18 | Low | gt 07 auction-concepts | Online ad auctions are "close cousins" of Vickrey | Search ads used generalised second-price; most display ads moved to first price around 2019 | Industry record | Reworded |
| 19 | Low | gt 07 auction-concepts | Revenue equivalence conditions | Needs independent private values from the same distribution. Credit Vickrey 1961 and Myerson 1981 | Osborne ch. 3 | Added |
| 20 | Low | gt 05 centipede | Attribution | The game is Rosenthal (1981). McKelvey & Palfrey 1992 found fewer than 1 in 10 take at the first node | McKelvey & Palfrey 1992 | Added |
| 21 | Low | econ 01 scarcity-concepts | Study-hours example gave only hours 1 and 4 | The answer "3 hours" couldn't be checked | Logic | Listed all four hours |
| 22 | Low | econ 06 commons and lemons | Ostrom "won", Akerlof "shared" | Ostrom shared 2009 with Williamson; Akerlof shared 2001 with Spence and Stiglitz | nobelprize.org | Reworded |
| 23 | Low | econ 07 money-concepts | RBI 4% (2-6%) target | Correct, and renewed March 2026 for 2026-2031 | Govt of India / RBI, Mar 2026 | Added the renewal |
| 24 | Low | econ 08 macro-concepts | Long-run Phillips curve | Correct; added the Friedman 1968 / Phelps attribution | Friedman 1968 | Added |
| 25 | Low | gt 03 nash-concepts | Stag hunt origin | Correct game; it comes from Rousseau (1755) | SEP | Added |

**Totals: 4 High, 5 Medium, 16 Low (25 issues).**

## Checked and correct (no change)

- **Econ maths and claims:** all of these were correct: opportunity cost and sunk cost items; the bakery (3 workers); the lemonade optimum (5+40)/2 = 22.5 and the 43.75% share; the four market-maker equilibria (10, 14, 17, 13); tax incidence (buyers ₹30→₹32, sellers keep ₹26, so a ₹2/₹4 split, and the supply side is less elastic, 0.75 vs 1.5); and the tax and supply-demand diagrams.
- **Elasticity:** all midpoint elasticities are right (1.22, 0.43, 1.0), and so are the card values. The revenue peaks are at 200 and 60. Monopoly figures (Q 40, P 60, profit 1,600, CS 800, DWL 800, competitive CS 3,200; 120; Q 30) are right.
- **Trade:** both trade puzzles are right: the splits, end bundles, price range 0.75-2, and the 11 and 12.7 hours needed alone. Ricardo 1817 is right.
- **Market failures:** Akerlof 1970, the lemons maths (P/2, 0.75P, 40), the logistic 125 peak, the commons hints (simulated: 4 boats 25-30 is OK and 35+ fails; 6 boats 18-20 is OK and 25 collapses), and the inspection EV (+15k a round) are all right.
- **Money and macro:** the rule of 72, real rates, the unemployment rate (7.4%), the central bank neutral rate of 3%, and 1.06^30 ≈ 1/5.7 are right.
- **Game theory basics:** these are right: the PD and stag payoffs; the dominance 3x3 (the solver reaches Top/Centre); all Nash-hunt answers, including the price war (Medium/Medium and Low/Low); and Monty Hall (2/3, 9/10, 99%).
- **Mixed strategies:** the mixed EV (69%), the penalty keeper mix of 41.7% and score of 79.6% (matches the paper's 41.99%), and hawk-dove V/C (the simulation reaches 0.300 for V=3, C=10) are right. Maynard Smith & Price 1973 is the right citation.
- **Sequential games:** the entry and launch trees and the centipede (stage-3 take = 12, pot at stage 5 = 64; the component's botTakeAt semantics match the text) are right.
- **Repeated games:** TFT vs always-defect over 10 rounds scores 9. Exploiting tit-for-two-tats by alternating works. Noisy tournament: TFT is top 3 in 85% of seeds, GTFT 71%, grim 50%, which matches "usually". The GTFT forgiveness of 1/3 is right for these payoffs (Nowak & Sigmund).
- **Auctions:** Vickrey 1961, bid shading (n−1)/n, and the answers 64 and 45 are right.
- **Fairness:** ultimatum game totals (35 + 11), Fehr & Gächter 2000 (contributions start at 40-60%, decline, and stay high with punishment), Ostrom's design principles and Hardin 1968 are right.

## Sources

Textbooks:

- CORE Econ, *The Economy 2.0*
- OpenStax, *Principles of Economics 3e*
- Mankiw, *Principles of Economics*
- Osborne, *An Introduction to Game Theory*
- Dixit & Nalebuff, *The Art of Strategy*
- SEP entries on game theory and the prisoner's dilemma

Papers and books (links are on the Sources pages):

- Axelrod 1980a/b and 1984
- Nash 1950
- Schelling 1957/1960
- Nagel 1995
- Palacios-Huerta 2003
- Maynard Smith & Price 1973
- McKelvey & Palfrey 1992
- Nowak & Sigmund 1993
- Vickrey 1961
- Capen, Clapp & Campbell 1971
- Güth et al. 1982
- Camerer 2003
- Fehr & Gächter 2000
- Akerlof 1970
- Hardin 1968
- Ostrom 1990
- Goodwin, Dargay & Hanly 2004
- Friedman 1968
- The Government of India / RBI inflation target notification of March 2026

## New pages

- `economics/08-central-banks/04-econ-sources`
- `game-theory/08-cooperation-and-fairness/04-gt-sources`

Each one has fun 1, cards listing the sources with links, and one MCQ. Short source notes were added inline to the cards that cite a specific result.
