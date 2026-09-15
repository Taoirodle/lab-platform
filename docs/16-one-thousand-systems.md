# 16 · One Thousand Systems

A working catalogue of things the L.A.B estate could become. Not a wish list — every entry is a system with a real data source, a real surface, and a reason to exist.

**How to read it.** Each item is marked by what it actually needs:

- **▲ Buildable now** — with the server, the app and the data we already have.
- **◆ Needs hardware** — a sensor, a bulb, a camera, a meter.
- **●  Needs an account** — a third-party API, an OAuth app, or a provider login.
- **✱ Needs a person** — someone in the family to supply or confirm something.

Written for a South African household, so the assumptions are load-shedding, municipal prepaid meters, medical aid, fibre ISPs and Rand — not garbage day and 401ks.

---

## 1 · The House Registry — the single source of truth (1–40)

1. **▲ Asset confirmation queue** — walk the 13 discovered devices one at a time, name each, and the register turns inference into fact.
2. **▲ Room model** — rooms as first-class rows with floor, type, adjacency and exterior walls, not a free-text string on a device.
3. **▲ Floor-plan editor** — draw rooms on a grid; the drawing produces the machine-readable adjacency graph.
4. **▲ Floor-plan viewer with live state** — the same plan rendered with devices, lights and presence on it.
5. **▲ Asset-to-room binding** — every device pinned to a room, so "what's in the studio" becomes answerable.
6. **▲ Ownership map** — which person owns which device, for cost splitting and "whose phone is that on the network".
7. **▲ Warranty tracker** — purchase date plus term, with a nudge 60 days before expiry.
8. **▲ Serial-number vault** — serials and IMEIs for insurance claims, stored once, exportable as a claim pack.
9. **✱ Proof-of-purchase store** — receipts and invoices attached to assets as files.
10. **▲ Replacement-cycle forecast** — age plus category gives an expected replacement year and a savings target.
11. **▲ Insurance schedule generator** — produce the itemised list an insurer asks for, with values and serials.
12. **▲ Depreciation view** — what the household's kit is actually worth now, not what it cost.
13. **▲ Spare-parts and cables register** — what's in the drawer, so nothing gets bought twice.
14. **▲ Consumables tracker** — printer ink, filters, batteries, with reorder thresholds.
15. **▲ Loan register** — what the house has lent out and to whom, with a nudge to get it back.
16. **✱ Manual and firmware library** — PDFs and firmware versions per device, kept with the asset.
17. **▲ Firmware-currency check** — flag devices running versions older than the latest known.
18. **✱ Provider directory** — ISP, banks, insurers, municipality, medical aid, with reference numbers and portals.
19. **✱ Contract end-date tracker** — every contract's renewal date and what it reverts to.
20. **▲ Contact book with context** — the plumber, plus what he fixed, when, and what it cost.
21. **▲ Job history per contractor** — a running record so you can judge whether to call him again.
22. **✱ Quote comparison** — log quotes for a job, compare, and record the decision.
23. **▲ Fact table with provenance** — where the water shutoff is, which breaker feeds the server, who said so and when.
24. **▲ Contradiction detector** — when two sources disagree about a fact, raise it rather than silently pick one.
25. **▲ Staleness decay** — facts that have not been confirmed in a year get flagged as possibly out of date.
26. **▲ Confidence scoring** — stated, observed and inferred facts weighted differently in answers.
27. **▲ Registry changelog** — who changed what in the household record, and when.
28. **▲ Registry search** — one search box across every domain of the registry.
29. **▲ Registry export** — the whole household record as a printable pack for an emergency or a move.
30. **▲ Import from spreadsheet** — because everyone has a half-finished inventory in a spreadsheet already.
31. **✱ Property record** — erf number, municipal account, title deed reference, plot size.
32. **✱ Tenancy or bond record** — bond balance, rate, term, or lease dates and escalation.
33. **▲ Room dimensions** — square metres per room, for paint, flooring and aircon sizing.
34. **▲ Paint and finishes log** — the exact colour codes used in each room, for touch-ups years later.
35. **▲ Key register** — which keys exist, who holds them, what they open.
36. **▲ Access log** — who has alarm codes, gate remotes and wifi passwords.
37. **▲ Neighbour and emergency contacts** — the practical list, on every surface.
38. **▲ Household constitution** — the agreed house rules, written once and visible.
39. **▲ Move-out pack** — everything a person needs when they leave home, generated from the registry.
40. **▲ Registry health score** — how complete the household record actually is, with the next best gap to fill.

## 2 · Money, bills and debt (41–95)

41. **✱ Bill register** — every recurring cost with amount, cadence, day it lands and who it belongs to.
42. **▲ True monthly cost** — weekly, quarterly and annual costs normalised so the total means something.
43. **▲ Annualised view** — what each bill actually costs per year, which changes decisions.
44. **▲ Cost per person** — household costs split by who benefits, for fair contributions.
45. **● Bank statement import** — OFX or CSV from FNB, Capitec, Absa, Nedbank or Standard Bank.
46. **▲ Transaction categoriser** — learns the household's own merchants rather than a generic model.
47. **▲ Recurring-payment detector** — finds subscriptions in the statement that nobody remembered.
48. **▲ Debit-order calendar** — what comes off on which day, laid against payday.
49. **▲ Cashflow timeline** — the month ahead as a running balance, showing the tight days before they arrive.
50. **▲ Payday planner** — allocate a salary across bills, savings and spending the moment it lands.
51. **▲ Bill-increase detector** — flags when an amount changes from its usual, with the percentage.
52. **▲ Above-inflation alert** — costs rising faster than CPI, which is where negotiation pays.
53. **▲ Debt register** — balances, rates, minimums and terms in one place.
54. **▲ Avalanche vs snowball comparison** — what each strategy costs in interest and months.
55. **▲ Payoff simulator** — drag an extra amount onto a debt and see the date and interest change.
56. **▲ Total interest counter** — what the household pays for borrowing, per month, in Rand.
57. **▲ Debt-free date** — one number, updated as payments land.
58. **▲ Extra-payment impact** — "R500 more on this one saves R7,400 and 11 months".
59. **✱ Credit agreement store** — the paperwork, rates and terms behind each debt.
60. **▲ Settlement calculator** — what an early settlement should cost, so a quote can be checked.
61. **▲ Emergency-fund tracker** — months of household costs covered, as a progress bar.
62. **▲ Sinking funds** — save monthly toward known future costs: tyres, licence, school fees.
63. **▲ Annual-cost smoothing** — turn big yearly bills into a monthly set-aside.
64. **▲ Shared-expense ledger** — who paid for what, and who owes whom.
65. **▲ Household kitty** — a shared pot for groceries or utilities, with contributions tracked.
66. **✱ Income register** — salaries, side income and dates, so cashflow is real.
67. **▲ Savings-rate view** — what proportion of income the household keeps.
68. **▲ Net-worth snapshot** — assets minus debts, tracked monthly.
69. **▲ Spending heatmap** — the calendar coloured by outflow, so patterns show.
70. **▲ Merchant leaderboard** — where the money actually goes, ranked.
71. **▲ Price-per-use** — what each subscription costs per actual hour used, joined to measured usage.
72. **▲ Cancellation candidates** — ranked by cost against evidence of use.
73. **▲ Duplicate-service detector** — two music services, two cloud storage plans.
74. **▲ Free-trial tracker** — trials that convert to paid, with a nudge before they do.
75. **▲ Renewal negotiation prompt** — a reminder and a script two weeks before insurance or fibre renews.
76. **● Rate-shop comparison** — current package against published market alternatives.
77. **▲ Insurance excess register** — what each claim would cost out of pocket.
78. **▲ Claim history** — what has been claimed, when, and how it affected premiums.
79. **✱ Medical aid tracker** — plan, savings balance, threshold, and what has been used.
80. **▲ Out-of-pocket medical log** — receipts and totals for the tax year.
81. **✱ SARS tax pack** — collect deductible expenses through the year, ready for eFiling.
82. **▲ Tax-year calendar** — South African tax dates, provisional deadlines, and what is due.
83. **▲ Receipt capture** — photograph a receipt, extract the total and merchant, file it.
84. **▲ Warranty-claim assistant** — assemble serial, proof of purchase and fault description into a claim.
85. **▲ Budget vs actual** — a simple envelope budget checked against real outflow.
86. **▲ Overspend early-warning** — flags a category trending past budget mid-month.
87. **▲ Grocery inflation tracker** — the same basket over time, from till slips.
88. **▲ Fuel-cost tracker** — litres, price and distance, giving a real cost per kilometre.
89. **▲ Subscription seat audit** — family plans with unused seats, which is pure waste.
90. **▲ Household cost per day** — one honest number for what running this house costs daily.
91. **▲ What-if simulator** — model a rate rise, a lost income, or a new debt.
92. **▲ Bill-splitting for shared services** — one Netflix, four people, split fairly.
93. **▲ Payment-due notifications** — on the kiosk and the phone, before the money is needed.
94. **▲ Late-payment risk flag** — bills due before the next payday, highlighted early.
95. **▲ Money report for the family** — a monthly plain-English summary anyone can read.

## 3 · Subscriptions and recurring spend (96–125)

96. **▲ Subscription register** — every service, tier, price, renewal date and who uses it.
97. **● Spotify tier and usage** — the API returns the plan and the listening, so cost meets evidence.
98. **● Steam spend history** — what has actually been spent on games, per year.
99. **▲ Game cost-per-hour** — purchase price against measured playtime.
100. **● Cloud storage audit** — Google, OneDrive and iCloud tiers against actual usage.
101. **▲ Storage right-sizing** — paying for 2TB while using 300GB, flagged with the cheaper tier.
102. **▲ Streaming overlap map** — which shows are on which service, so one can be dropped.
103. **✱ DStv and Showmax register** — no API, so cost and viewer recorded once.
104. **▲ Rotation planner** — subscribe to one streaming service a month rather than four continuously.
105. **▲ Pause-and-resume tracker** — services that allow a hold, and when to use it.
106. **▲ Annual vs monthly advisor** — where paying yearly saves, and by how much.
107. **▲ Student and family discount finder** — plans the household qualifies for but is not on.
108. **▲ Shared-plan optimiser** — consolidating individual plans into a family one.
109. **▲ Renewal wall** — everything renewing in the next 90 days on one screen.
110. **▲ Cancellation how-to** — the actual steps to cancel each service, stored so it is not a search.
111. **▲ Cancellation follow-through** — confirm the money actually stopped coming off.
112. **▲ Zombie-service detector** — paid for, never used, for three months.
113. **▲ Per-service usage evidence** — measured app time joined to each subscription.
114. **● Mobile plan analysis** — data and minutes used against what is paid for.
115. **▲ Prepaid vs contract comparison** — for each phone in the house.
116. **✱ Airtime and data purchases** — logged, so top-up spend is visible.
117. **▲ Software licence register** — perpetual licences the household owns, so they are not re-bought.
118. **▲ Licence-vs-subscription advisor** — where a one-off purchase beats a monthly fee.
119. **▲ Domain and hosting register** — with expiry dates, because those lapse quietly.
120. **▲ Free-alternative suggester** — where a paid tool has a good free replacement.
121. **▲ Subscription budget cap** — a household ceiling with a warning as it is approached.
122. **▲ New-subscription approval** — a light request flow so services stop appearing unnoticed.
123. **▲ Spend-by-person view** — who is responsible for what share of recurring spend.
124. **▲ Year-in-subscriptions** — the annual total, and what it could have bought instead.
125. **▲ Gift and one-off tracker** — non-recurring spend that still needs remembering.

## 4 · Hardware and asset lifecycle (126–165)

126. **▲ Device health index** — age, warranty, failures and performance in one score per device.
127. **▲ Upgrade advisor** — which machine most needs which part, given what it is used for.
128. **▲ Bottleneck analysis** — CPU, RAM, GPU or disk, based on measured load, not guesswork.
129. **▲ Build-plan estimator** — parts list and cost for a planned upgrade.
130. **● Price watcher** — track component prices at local retailers and alert on a drop.
131. **▲ Cascade planner** — when a new PC arrives, who inherits the old one.
132. **▲ E-waste and resale log** — what was sold or disposed of, for what, and when.
133. **▲ Resale-value estimator** — what old kit is worth before it becomes worthless.
134. **▲ Disk health monitor** — SMART attributes per drive, with failure prediction.
135. **▲ Disk space forecast** — when each drive will fill, based on its own trend.
136. **▲ Battery health tracker** — laptops and phones, cycle counts and capacity fade.
137. **◆ UPS monitoring** — runtime remaining, battery age, and events.
138. **▲ Thermal history** — temperatures over time per machine, so dust build-up shows as a trend.
139. **▲ Maintenance scheduler** — clean filters, repaste, replace fans, on a real cadence.
140. **▲ Cable and port map** — what is plugged into which port on which switch.
141. **▲ Rack and shelf layout** — where physically each piece of kit sits.
142. **▲ Power draw per device** — measured or estimated, feeding the energy model.
143. **◆ Smart-plug energy metering** — real watts per appliance.
144. **▲ Idle-waste finder** — devices drawing power for no benefit.
145. **▲ Device commissioning checklist** — the steps to bring a new device onto the estate properly.
146. **▲ Decommissioning checklist** — wipe, unregister, remove from the network, update the register.
147. **▲ Loaner tracking** — kit lent to family or friends, with return dates.
148. **▲ Peripheral register** — monitors, keyboards, headsets, with their own lifecycles.
149. **▲ Display inventory** — resolution, refresh, age, and what is driving each one.
150. **▲ Printer supply forecast** — pages printed against cartridge life.
151. **● Printer cost-per-page** — real running cost, including the ink nobody counts.
152. **▲ Asset QR labels** — print a label per device that opens its registry page.
153. **▲ Photo documentation** — a picture of each device and its serial plate.
154. **▲ Purchase-decision log** — why a thing was bought, so the reasoning survives.
155. **▲ Bring-your-own-device register** — guests' and visitors' kit, temporarily.
156. **▲ Spare-capacity finder** — which machine has room to run a new workload.
157. **▲ Virtualisation inventory** — VMs and containers as first-class assets.
158. **▲ Storage pool view** — total household storage, used and free, across every machine.
159. **▲ Redundancy check** — which data exists in only one place.
160. **▲ Retirement forecast** — a rolling five-year view of what will need replacing and when.
161. **▲ Warranty-claim likelihood** — devices failing inside warranty, worth claiming on.
162. **▲ Recall checker** — flag assets subject to a manufacturer recall.
163. **▲ Compatibility checker** — will this part work in that machine.
164. **▲ Kit utilisation report** — what the household owns but does not use.
165. **▲ Capital plan** — the year's expected hardware spend, laid out in advance.

## 5 · Network and connectivity (166–210)

166. **▲ Continuous device discovery** — a scheduled sweep that keeps the register current.
167. **▲ New-device alert** — something joined the network that has never been seen before.
168. **▲ Device-left alert** — something expected has not appeared for days.
169. **▲ MAC-vendor enrichment** — a fuller OUI database for better identification.
170. **▲ Hostname and mDNS harvesting** — names devices announce about themselves.
171. **▲ Open-port inventory** — what each device exposes, tracked over time.
172. **▲ Port-change alert** — a device that suddenly opens a new port.
173. **● Ubiquiti integration** — pull clients, signal strength and uptime from the access points.
174. **▲ Per-AP client map** — who is connected to which access point right now.
175. **▲ Signal-strength heatmap** — coverage per room, using the plan.
176. **▲ Roaming analysis** — devices bouncing between access points.
177. **▲ Band steering check** — devices stuck on 2.4GHz that should be on 5GHz.
178. **▲ Channel-congestion advisor** — which channels the neighbours are using.
179. **▲ Bandwidth per device** — who is actually using the line.
180. **▲ Bandwidth hog alert** — one device saturating the connection.
181. **● Speed-test history** — scheduled tests, graphed against what the package promises.
182. **▲ ISP accountability report** — measured speed and uptime against the contract.
183. **▲ Outage log** — when the line dropped, for how long, evidence for a complaint.
184. **▲ Latency monitor** — ping and jitter, which matters for gaming and calls.
185. **▲ DNS monitoring** — resolution failures and slow lookups.
186. **▲ Pi-hole integration** — blocked queries, top offenders, per-device breakdown.
187. **▲ Content filtering per person** — age-appropriate rules bound to devices.
188. **▲ Guest network management** — a rotating password and a time limit.
189. **▲ Guest wifi QR code** — printed for the wall or shown on the kiosk.
190. **▲ Device quarantine** — move an unknown or misbehaving device to an isolated network.
191. **▲ Bandwidth schedule** — throttle or pause a device during homework or sleep hours.
192. **▲ Internet curfew** — per person, per device, enforced at the router.
193. **▲ VPN status** — which devices are on a VPN, and whether it is actually up.
194. **▲ Double-NAT detector** — exactly the Tenda situation, explained in plain terms.
195. **▲ Network topology map** — what is connected to what, drawn automatically.
196. **▲ Switch port mapping** — which physical port each device sits on.
197. **▲ PoE budget tracker** — power drawn by access points and cameras.
198. **▲ Cable-fault detector** — links renegotiating to 100Mbit when they should be gigabit.
199. **▲ IP address plan** — static assignments recorded so they stop colliding.
200. **▲ DHCP lease view** — what the router has handed out.
201. **▲ Port-forward register** — what is exposed to the internet and why.
202. **▲ External exposure check** — what the household looks like from outside.
203. **● Dynamic DNS** — a stable name for a changing home IP.
204. **▲ Tailscale management** — who is on the tailnet, and from where.
205. **▲ Certificate tracker** — internal TLS certificates and their expiry.
206. **▲ Network change log** — every change to the estate's networking, recorded.
207. **▲ Wi-Fi password rotation** — with a plan for updating every device that uses it.
208. **▲ Rogue access point detection** — an unexpected SSID broadcasting in the house.
209. **▲ Network map export** — a diagram to hand to whoever fixes it next.
210. **▲ Connectivity capability answer** — "can two people stream 4K while I upload" answered from package, access point and current load.

## 6 · Security, CCTV and access (211–260)

211. **✱ Camera onboarding** — a view-only account on the recorder at .105, never the admin login.
212. **◆ Live camera tiles** — RTSP streams on the kiosk and in the app.
213. **▲ Snapshot on demand** — a still from any camera, so "what's going on" has an answer.
214. **▲ Snapshot archive** — periodic stills kept cheaply, long after video has rotated away.
215. **▲ Motion detection by frame difference** — motion events without needing the recorder's own analytics.
216. **▲ Motion timeline** — a scrubable day of activity per camera.
217. **▲ Person detection** — local model distinguishing a person from a moving tree.
218. **▲ Vehicle detection** — a car arriving in the driveway as an event.
219. **▲ Package detection** — something left at the door.
220. **▲ Animal detection** — so the dog stops triggering alerts.
221. **▲ Zone masking** — ignore the street, watch the gate.
222. **▲ Event-to-automation bridge** — a camera event running a Conductor scene.
223. **▲ Arrival announcement** — the kiosk says someone is at the gate.
224. **▲ Clip extraction** — pull the 30 seconds around an event and keep it.
225. **▲ Event review queue** — a morning digest of what the cameras saw overnight.
226. **▲ False-positive training** — mark an event as nothing, and the threshold adapts.
227. **▲ Camera health monitor** — a stream that has gone dark, flagged.
228. **▲ Recorder disk monitor** — how many days of footage remain before overwrite.
229. **✱ Alarm panel register** — zones, codes, and what each zone actually covers.
230. **◆ Alarm integration** — armed state and zone triggers as events.
231. **✱ Armed-response details** — company, contract, panic procedure, on every surface.
232. **▲ Panic procedure card** — what to do and who to call, one tap from the kiosk.
233. **▲ Arm-when-empty** — suggest arming when presence says the house is empty.
234. **▲ Unarmed-overnight nudge** — a gentle check at bedtime.
235. **▲ Door and window state** — open or closed, per opening.
236. **◆ Contact sensors** — reed switches on the doors that matter.
237. **▲ Left-open alert** — the back door has been open for twenty minutes.
238. **◆ Gate motor integration** — open, close, and know which it is.
239. **▲ Gate event log** — every open, with who or what triggered it.
240. **✱ Access register** — who holds keys, remotes, codes and cards.
241. **▲ Code rotation reminder** — alarm and gate codes changed on a schedule.
242. **▲ Visitor log** — who came, when, and who let them in.
243. **▲ Expected-visitor list** — the plumber is due at 10, so his arrival is not an alert.
244. **▲ Delivery expectation** — a parcel is due today, so a person at the gate is explained.
245. **▲ Away mode** — a coordinated posture: armed, lights on a schedule, alerts escalated.
246. **▲ Holiday simulation** — lights and sounds that look like occupancy.
247. **▲ Perimeter summary** — one honest line about whether the house is secure right now.
248. **▲ Security event correlation** — motion plus gate plus alarm as a single incident, not three alerts.
249. **▲ Incident timeline** — everything that happened around an event, assembled automatically.
250. **▲ Evidence pack** — clips, stills and logs bundled for an insurer or the police.
251. **▲ Silent-failure detector** — a sensor that has not reported in days is itself an alert.
252. **▲ Tamper detection** — a camera moved or covered.
253. **▲ Night-only rules** — different sensitivity after dark.
254. **▲ Load-shedding blind-spot warning** — which cameras die when the power does.
255. **◆ Camera battery backup** — and monitoring of it.
256. **▲ Neighbourhood watch export** — share an incident with neighbours without sharing the whole system.
257. **▲ Privacy schedule** — cameras that switch off when the family is home.
258. **▲ Recording-consent notice** — a clear statement of what is recorded and kept.
259. **▲ Retention policy** — footage deleted on a schedule, automatically.
260. **▲ Security posture score** — an honest read of how protected the house actually is.

## 7 · Energy, load-shedding and utilities (261–310)

261. **● Load-shedding schedule** — pull the suburb's stage and slots from EskomSePush.
262. **▲ Next-outage countdown** — on the kiosk, the app and the lock screen.
263. **▲ Stage-change alert** — the moment the stage moves, everyone knows.
264. **▲ Pre-outage checklist** — charge the laptops, fill the kettle, shut down the server gracefully.
265. **▲ Graceful server shutdown** — the L.A.B powers itself down before the UPS dies.
266. **▲ Auto-restart after power** — everything comes back in the right order.
267. **▲ Outage actual-vs-scheduled log** — what really happened against what was published.
268. **▲ Outage impact report** — hours lost per month, and what it cost.
269. **◆ Inverter and battery monitoring** — state of charge, load, and time remaining.
270. **▲ Battery runtime forecast** — how long the house can hold out at the current draw.
271. **▲ Load-shedding load management** — shed the geyser and pool pump first, automatically.
272. **◆ Solar generation monitoring** — production by hour and day.
273. **▲ Solar self-consumption** — how much generation is actually used versus exported.
274. **▲ Solar payback tracker** — cumulative savings against the install cost.
275. **▲ Best-time-to-run advisor** — run the washing when the sun is up or the rate is low.
276. **✱ Prepaid meter balance** — units remaining, entered or read.
277. **▲ Prepaid burn rate** — days of electricity left at the current rate of use.
278. **▲ Top-up reminder** — before the house goes dark at an inconvenient moment.
279. **✱ Token purchase log** — every prepaid purchase, for cost tracking.
280. **▲ Tariff model** — municipal blocks and steps, so cost per unit is real.
281. **▲ Bill forecast** — projected electricity cost at the current consumption.
282. **▲ Appliance-level consumption** — what each big appliance costs to run per month.
283. **▲ Geyser cost model** — the single biggest electrical cost in most SA homes.
284. **◆ Geyser timer control** — heat only before it is needed.
285. **▲ Geyser schedule optimiser** — learned from when hot water is actually used.
286. **▲ Standby-power audit** — what the house burns doing nothing.
287. **▲ Consumption anomaly detector** — a sudden rise usually means a fault.
288. **▲ Month-on-month energy comparison** — with weather normalisation.
289. **▲ Energy leaderboard** — per person or per room, gently competitive.
290. **▲ Efficiency suggestions** — ranked by Rand saved per Rand spent.
291. **▲ LED conversion calculator** — payback per room.
292. **▲ Appliance replacement economics** — when an old fridge costs more to run than to replace.
293. **◆ Whole-house energy meter** — one clamp, everything measured.
294. **▲ Power-factor and voltage log** — brownouts and surges recorded.
295. **▲ Surge event log** — with a nudge to check equipment afterwards.
296. **◆ Generator monitoring** — fuel, run hours, service intervals.
297. **▲ Generator run log** — hours and fuel cost per outage.
298. **▲ Gas bottle tracker** — weight or usage estimate, with reorder timing.
299. **▲ Fireplace and heating log** — wood or gas used per season.
300. **▲ Heating and cooling schedule** — by room, by occupancy.
301. **◆ Room temperature sensing** — the basis for any real climate control.
302. **▲ Comfort report** — which rooms are actually too hot or too cold, with data.
303. **▲ Insulation advice** — from temperature decay curves per room.
304. **▲ Aircon runtime tracking** — hours and cost per unit.
305. **▲ Aircon service reminder** — filters and gas, on schedule.
306. **▲ Weather-aware pre-cooling** — cool the house before the heat arrives.
307. **● Weather integration** — forecast driving automations and advice.
308. **▲ Seasonal energy review** — summer against winter, honestly compared.
309. **▲ Carbon estimate** — the household's grid footprint, if anyone cares to see it.
310. **▲ Utility contact and fault reporting** — log a municipal fault reference and track it.

## 8 · Water, plumbing and outdoors (311–340)

311. **✱ Water meter readings** — captured manually or photographed.
312. **▲ Water consumption trend** — litres per day, per person.
313. **▲ Leak detection by baseline** — overnight flow that never reaches zero.
314. **◆ Flow sensor** — real-time water use.
315. **▲ Water bill forecast** — against the municipal tariff blocks.
316. **▲ Restriction-level awareness** — what the current water restrictions actually permit.
317. **▲ Tank level tracking** — JoJo tank percentage.
318. **◆ Tank level sensor** — ultrasonic, cheap, genuinely useful.
319. **▲ Rainwater harvest log** — collected against rainfall.
320. **● Rainfall integration** — so irrigation skips when it has rained.
321. **▲ Irrigation schedule** — by zone, by season, by restriction.
322. **◆ Irrigation valve control** — the actual watering.
323. **▲ Borehole run log** — pump hours and yield.
324. **▲ Pool chemistry log** — readings and dosing over time.
325. **▲ Pool pump schedule** — hours matched to season and temperature.
326. **▲ Pool cost model** — what the pool actually costs per month.
327. **▲ Geyser and plumbing fault log** — every leak, burst and repair.
328. **▲ Shutoff valve map** — where every stopcock is, with photos.
329. **▲ Drain and gutter maintenance** — seasonal reminders before the rains.
330. **▲ Septic or sewer record** — service dates and contractor.
331. **▲ Garden zone map** — beds, lawn, pots, and what lives in each.
332. **▲ Plant care schedule** — watering, feeding, pruning by species.
333. **▲ Harvest log** — what the vegetable patch actually produced.
334. **▲ Compost tracker** — turns and readiness.
335. **▲ Lawn care calendar** — mowing, feeding, aerating.
336. **▲ Tree register** — species, age, and when each was last trimmed.
337. **▲ Pest and treatment log** — what was sprayed, when, and whether it worked.
338. **▲ Outdoor lighting schedule** — dusk to dawn, or motion.
339. **▲ Braai readiness** — gas, charcoal, weather and who is coming.
340. **▲ Outdoor task board** — the jobs that only make sense in good weather.

## 9 · People, presence and identity (341–380)

341. **▲ Person model** — who lives here, their room, their devices, their patterns.
342. **▲ Duplicate account cleanup** — there are currently two of Tao in the accounts table.
343. **▲ Household roles** — admin, adult, teen, child, guest, with real permission differences.
344. **▲ Presence by device** — phones on the network as the cheapest possible presence signal.
345. **● Presence via Ubiquiti** — association events give near-instant arrival and departure.
346. **▲ Randomised-MAC handling** — the modern phone problem, solved by pairing a device to a person once.
347. **▲ Grace periods** — a sleeping phone is not an absent person.
348. **▲ Who's home board** — on the kiosk, honest about confidence.
349. **▲ Arrival and departure events** — the trigger behind half of all useful automation.
350. **▲ First-home and last-out rules** — lights on when the first person arrives, everything off when the last leaves.
351. **▲ Expected-home time** — learned per person per weekday.
352. **▲ Late-home nudge** — a quiet check when someone is much later than usual.
353. **▲ Presence history** — who was home when, useful and slightly uncomfortable, so opt-in.
354. **▲ Room-level presence** — with sensors, which room someone is in.
355. **▲ Sleep and wake detection** — from device activity, not a wearable.
356. **▲ Do-not-disturb awareness** — the house knows not to announce things at 2am.
357. **▲ Per-person quiet hours** — respected by every surface.
358. **▲ Personal preference store** — temperature, lighting, music, learned and stated.
359. **▲ Personal routine model** — what this person usually does at this hour.
360. **▲ Routine deviation detection** — useful for care, dangerous if misused, so strictly opt-in.
361. **▲ Household schedule composite** — everyone's commitments in one view.
362. **▲ Conflict detection** — two people need the car at the same time.
363. **▲ Handover notes** — one person leaving a note for the next person home.
364. **▲ Chore fairness ledger** — who actually did what, over time.
365. **▲ Contribution view** — money and effort, side by side.
366. **▲ Family announcements** — one message to every screen in the house.
367. **▲ Per-person dashboards** — the same Hub showing different things to different people.
368. **▲ Kid mode** — a simplified, safe surface.
369. **▲ Teen mode** — more autonomy, fewer parental levers, negotiated.
370. **▲ Elder mode** — larger type, fewer choices, louder alerts.
371. **▲ Guest identity** — temporary accounts that expire by themselves.
372. **▲ Visitor wifi and access bundle** — one action grants everything a guest needs.
373. **▲ Emergency contact card** — per person, reachable without unlocking anything.
374. **▲ Medical essentials per person** — allergies, conditions, medications, blood type.
375. **▲ Consent register** — what each person has agreed to share, changeable at any time.
376. **▲ Data self-service** — anyone can see and delete what the house holds about them.
377. **▲ Birthday and anniversary register** — with useful lead time.
378. **▲ Gift ideas store** — captured through the year, not panicked over in December.
379. **▲ Family tree and relationships** — so the AI understands who is who.
380. **▲ Per-person onboarding flow** — the thing that finally gets Mom, Dad and your brother on the system.

## 10 · Calendar, time and planning (381–415)

381. **▲ Per-person calendars** — already linked by ICS; now attributed to people rather than pooled.
382. **▲ Household composite calendar** — everyone's commitments, colour-coded.
383. **▲ Free-time finder** — when is everyone actually available at once.
384. **▲ Travel-time awareness** — leave-by times, not just start times.
385. **● Traffic-aware departure** — with a live routing API.
386. **▲ Conflict warnings** — two events, one car, one person.
387. **▲ Recurring-event health** — recurrences that have quietly drifted or died.
388. **▲ School term calendar** — terms, holidays and public holidays, South African.
389. **▲ Public holiday awareness** — which affects bins, shops and schedules.
390. **▲ Event templates** — a braai, a doctor's visit, a school run, pre-filled.
391. **▲ Preparation checklists per event** — what to take, generated from the event type.
392. **▲ Day-before briefing** — tomorrow, in one paragraph, on the kiosk at bedtime.
393. **▲ Morning briefing** — today, in one paragraph, when the first person wakes.
394. **▲ Week-ahead view** — Sunday evening, the whole week in one screen.
395. **▲ Countdown boards** — exams, trips, birthdays.
396. **▲ Deadline register** — the things with dates that are not calendar events.
397. **▲ Renewal calendar** — licences, contracts, insurance, domains, in one timeline.
398. **▲ Bin day** — Monday, once a week, and no more than that.
399. **▲ Recurring household rhythms** — the weekly, monthly and seasonal jobs.
400. **▲ Seasonal switch** — the tasks that only matter in summer or winter.
401. **▲ Time-blocking assistant** — protect focus time against the calendar.
402. **▲ Focus sessions with measurement** — start a block, and Stats proves whether it held.
403. **▲ Pomodoro with real data** — sessions logged, not just timed.
404. **▲ Shared timers** — a kitchen timer that rings on every screen in the house.
405. **▲ Named timers** — "pasta", "laundry", visible to everyone.
406. **▲ Alarm coordination** — who is waking when, so the house can prepare.
407. **▲ Wake-up routine** — lights, briefing and kettle, in sequence.
408. **▲ Bedtime routine** — the reverse, with a lock-up check.
409. **▲ Meeting-mode** — quiet the house when someone is on a call.
410. **▲ Calendar-driven automation** — an event in the diary changing the house.
411. **▲ Availability broadcast** — a simple busy or free light for the family.
412. **▲ Appointment reminders with context** — the address, the reference, what to bring.
413. **▲ Recurring-payment calendar merge** — money dates on the same timeline as life dates.
414. **▲ Historical calendar analysis** — where the household's time actually went last month.
415. **▲ Calendar export** — the family calendar as a subscribable feed, already built, now per person.

## 11 · Lists, chores and household operations (416–450)

416. **▲ Multiple named lists** — already built; now with per-list settings and owners.
417. **▲ List templates** — a camping list, a braai list, a back-to-school list.
418. **▲ Recurring list items** — things that come back every week without being retyped.
419. **▲ Assignment** — items belonging to a person, not just floating.
420. **▲ Due dates on list items** — so a list becomes a plan.
421. **▲ Rotating chores** — the same job changing hands fairly, on a schedule.
422. **▲ Chore verification** — a photo or a tick from someone else.
423. **▲ Chore points and rewards** — gentle gamification for younger family members.
424. **▲ Effort estimates** — so a list can be balanced rather than dumped.
425. **▲ Quick-capture** — one keystroke or one word to The Sauce, and it lands on the right list.
426. **▲ Voice capture** — from the kiosk, hands busy.
427. **▲ Barcode scanning** — scan the empty packet, it joins the shopping list.
428. **▲ Pantry inventory** — what is actually in the cupboard.
429. **▲ Low-stock detection** — from consumption patterns, not manual counting.
430. **▲ Auto-shopping list** — generated from the pantry and the meal plan.
431. **▲ Store-aisle ordering** — the list sorted by the layout of the shop you use.
432. **▲ Price memory** — what things usually cost, so a bad price is visible.
433. **▲ Shopping-trip summary** — what was bought, what it cost, what was missed.
434. **▲ Household request queue** — anyone can ask for something to be bought or fixed.
435. **▲ Approval flow for purchases** — over a threshold, someone signs off.
436. **▲ Task escalation** — undone for a week, and it gets louder.
437. **▲ Someday list** — the things that are not urgent but should not be forgotten.
438. **▲ Project tracking** — multi-step household projects with real steps.
439. **▲ Room-by-room to-do** — jobs attached to places, so they surface when you are there.
440. **▲ Seasonal deep-clean planner** — the annual jobs, spread sensibly.
441. **▲ Declutter tracker** — what left the house, and what it earned.
442. **▲ Repair-or-replace decisions** — logged with the reasoning.
443. **▲ Household manual** — how things work here, written once.
444. **▲ Standard operating procedures** — how to restart the router, bleed a radiator, reset the gate.
445. **▲ Emergency procedures** — the first sixty seconds of a leak, a fire, a break-in.
446. **▲ Handover pack for a sitter** — generated from the registry, not written from scratch.
447. **▲ Task history and analytics** — who does what, and how long things really take.
448. **▲ Completion streaks** — for the household, not just individuals.
449. **▲ List sharing outside the house** — a read-only link for a helper.
450. **▲ Print to paper** — the list on the fridge, from the HP at .106.

## 12 · Communication and notifications (451–485)

451. **▲ One notification spine** — every alert routed by rules, not scattered per feature.
452. **▲ Per-person channel preferences** — push, kiosk, email, or nothing.
453. **▲ Severity levels** — ambient, notable, urgent, emergency, with different behaviour.
454. **▲ Quiet hours enforcement** — across every channel.
455. **▲ Escalation chains** — if nobody acknowledges, try the next person.
456. **▲ Acknowledgement tracking** — who saw it, and when.
457. **▲ Digest batching** — the unimportant collected into one daily summary.
458. **▲ Notification history** — searchable, so nothing vanishes.
459. **▲ Snooze and mute per source** — because one noisy sensor should not poison everything.
460. **● Push to phones** — a real mobile push channel.
461. **● WhatsApp bridge** — the channel a South African family actually uses.
462. **● Telegram or Signal bridge** — for those who prefer them.
463. **● Email fallback** — for things that need a record.
464. **● SMS for emergencies** — when data is down, which during load-shedding it is.
465. **▲ Kiosk announcements** — full-screen, for things that matter.
466. **◆ Text-to-speech** — the house speaking, sparingly.
467. **▲ Family message board** — asynchronous notes between people.
468. **▲ Direct messages between household members** — inside the Hub.
469. **▲ Shout to everyone** — one message, every screen, instantly.
470. **▲ Read receipts for household notices** — did everyone actually see the plumber is coming.
471. **▲ Poll the family** — takeaway tonight, three options, one tap each.
472. **▲ Voting on household decisions** — with a record of what was decided.
473. **▲ Suggestion box** — anyone can propose a change to how the house runs.
474. **▲ Feedback on the Hub itself** — already built, now actually consumed by the AI.
475. **▲ Incident broadcast** — one action tells everyone something serious happened.
476. **▲ Check-in requests** — "are you okay", with a one-tap reply.
477. **▲ Location share on request** — temporary and consensual, not tracking.
478. **▲ Arrival notifications** — tell Mom when the school run is home.
479. **▲ Away-from-home status** — who is travelling and when they return.
480. **▲ Guest notifications** — the guest wifi and house rules, sent on arrival.
481. **▲ Contractor coordination** — confirm a time, send the address, log the visit.
482. **▲ Scheduled messages** — write it now, send it when they get home.
483. **▲ Reminder delegation** — ask the house to remind someone else.
484. **▲ Notification effectiveness report** — which alerts get acted on and which are ignored.
485. **▲ Alert fatigue guard** — the system noticing it is being annoying, and quieting itself.

## 13 · Media and entertainment (486–525)

486. **● Spotify listening history** — top artists, tracks and the subscription tier in one call.
487. **▲ Your week in music** — alongside your week in apps, from the same measurement idea.
488. **▲ Household music taste map** — what everyone listens to, and the overlap.
489. **▲ Taste model** — build a real preference model on top of the listening data.
490. **▲ Recommendations of our own** — not Spotify's, built from the household's own history.
491. **▲ Shared playlists by occasion** — braai, cleaning, focus, road trip.
492. **▲ Now-playing on the kiosk** — what is playing and where.
493. **◆ Multi-room audio state** — what is playing in which room.
494. **▲ Listening-time report** — hours per week, per person.
495. **▲ Music discovery log** — what was added and whether it stuck.
496. **● Plex or Jellyfin integration** — the household's own library.
497. **▲ Watch history** — what has been watched, by whom.
498. **▲ Continue-watching board** — across services, in one place.
499. **▲ Household watchlist** — what everyone wants to see next.
500. **▲ Watch-together scheduler** — find the evening everyone is free.
501. **▲ Where-to-watch resolver** — which of the household's services has this film.
502. **▲ Leaving-soon alerts** — content about to drop off a service.
503. **▲ Content-rating guardrails** — per person, enforced where possible.
504. **▲ Screen-time by person** — measured, not guessed.
505. **▲ Screen-time agreements** — negotiated limits, visible to all.
506. **▲ TV power state** — on, off, and for how long.
507. **◆ TV and receiver control** — via HDMI-CEC or the network.
508. **▲ Movie-night scene** — lights, volume, phones quiet, one action.
509. **▲ Intermission mode** — pause everything, lights up.
510. **▲ Subtitle and audio preferences** — remembered per person.
511. **▲ Rating and review log** — what the household thought, kept.
512. **▲ Household top-ten of the year** — films, shows, albums, games.
513. **▲ Media spend report** — what entertainment costs per month, all in.
514. **▲ Cost per hour watched** — the honest metric for a streaming service.
515. **▲ Podcast tracking** — subscriptions and listening.
516. **▲ Reading log** — books, progress, and what is next.
517. **▲ Audiobook progress** — across devices.
518. **▲ Library due dates** — physical books and their return dates.
519. **▲ Photo library stats** — how many photos, where they live, whether they are backed up.
520. **▲ Photo of the day** — a memory surfaced on the kiosk.
521. **▲ On-this-day** — household photos and events from previous years.
522. **▲ Slideshow mode** — the kiosk as a frame when idle.
523. **▲ Family archive** — the important photos, deliberately preserved rather than trapped on a phone.
524. **▲ Music and media backup check** — is the library actually safe.
525. **▲ Party mode** — queue, volume limits, and lighting, handed to guests safely.

## 14 · Gaming (526–560)

526. **▲ Full library across launchers** — Steam, Epic, GOG, Xbox, in one place.
527. **● Steam playtime and achievements** — the Web API, joined to local data.
528. **▲ Playtime by title, per week** — already measurable from the sampler.
529. **▲ Cost per hour played** — purchase price against real hours.
530. **▲ Backlog tracker** — bought, never played, with a nudge.
531. **▲ Completion tracking** — started, finished, abandoned.
532. **▲ Next-game suggester** — from the backlog, based on mood and time available.
533. **▲ Session summary** — what you played, for how long, and how it went.
534. **▲ Longest-session records** — personal bests, which is genuinely fun.
535. **▲ Gaming vs everything-else balance** — an honest weekly ratio.
536. **▲ Late-night gaming report** — sessions past midnight, for self-awareness.
537. **▲ Performance capture** — FPS and frametime logged per game.
538. **▲ Thermal and clock logging during play** — where a machine actually struggles.
539. **▲ Settings recommendations** — from measured performance on this specific hardware.
540. **▲ Upgrade impact prediction** — what a GPU change would actually buy in your games.
541. **▲ Storage pressure from games** — which installs to remove, ranked by hours-per-gigabyte.
542. **▲ Auto-uninstall suggestions** — 90GB, not touched in a year.
543. **▲ Update and download scheduler** — patch at night, off-peak.
544. **▲ Game-mode scene** — lights, do-not-disturb, background apps closed.
545. **▲ Background-process killer** — reclaim RAM before launch, restore after.
546. **▲ Game launch shortcut** — launch from the Hub, the kiosk, or The Sauce.
547. **▲ Co-op availability** — who else in the house is free to play.
548. **● Friends-online awareness** — via platform APIs.
549. **▲ Multiplayer session log** — who played with whom.
550. **▲ Screenshot and clip library** — collected from every launcher into one place.
551. **▲ Highlight reel** — the month's clips, assembled automatically.
552. **▲ Achievement showcase** — on the kiosk, because it is fun.
553. **▲ Wishlist and price tracking** — alert on a sale for a wishlisted game.
554. **▲ Sale-value calculator** — is this bundle actually worth it.
555. **▲ Game spend per year** — the honest total.
556. **▲ Controller and peripheral battery** — charge state where readable.
557. **▲ Network quality during play** — latency and packet loss while gaming.
558. **▲ Bandwidth reservation** — deprioritise other traffic during a match.
559. **▲ Streaming setup checklist** — if you ever stream, everything verified before going live.
560. **▲ Gaming health nudges** — posture, water, and a break, without being preachy.

## 15 · Creative work and the studio (561–600)

561. **▲ Blender project register** — 40 .blend files, catalogued with where and when.
562. **▲ Project timeline** — time spent per project, from measured application focus.
563. **▲ Render job log** — what was rendered, how long it took, on which hardware.
564. **▲ Render queue manager** — queue jobs and run them overnight.
565. **▲ Distributed render** — use the server and idle machines as render nodes.
566. **▲ Render-time estimator** — from the history of this machine on similar scenes.
567. **▲ Render-cost estimator** — electricity per render, which for GPU work is real money.
568. **▲ Render-on-cheap-power** — schedule around load-shedding and solar generation.
569. **▲ Render failure alerts** — a crash at 2am should not be discovered at 9am.
570. **▲ Render completion notification** — to the phone, with a preview frame.
571. **▲ DaVinci Resolve project register** — projects, timelines and versions.
572. **▲ Export log** — what was delivered, when, at what settings.
573. **▲ Asset library** — textures, models, HDRIs, LUTs, indexed and searchable.
574. **▲ Duplicate asset finder** — the same texture in nine folders.
575. **▲ Project storage report** — what each project costs in gigabytes.
576. **▲ Archive workflow** — finished projects compressed and moved off the fast drive.
577. **▲ Project backup verification** — the creative work is the irreplaceable part.
578. **▲ Version-history snapshots** — for project files that have no version control.
579. **▲ Work-in-progress board** — every project and its actual state.
580. **▲ Client and brief register** — if any of the work is commissioned.
581. **▲ Time-to-invoice** — hours per project turned into a bill.
582. **▲ Creative-hours report** — how much real making happened this month.
583. **▲ Tool-usage breakdown** — Blender against Resolve against everything else.
584. **▲ Learning tracker** — tutorials watched and skills practised.
585. **▲ Reference library** — inspiration collected and tagged.
586. **▲ Colour palette store** — palettes used, reusable.
587. **▲ Font and licence register** — which fonts are licensed for what.
588. **▲ Plugin and add-on inventory** — with versions and compatibility.
589. **▲ Software version log** — what a project was made in, which matters when reopening it.
590. **▲ Hardware performance for creative work** — viewport FPS, render throughput, over time.
591. **▲ GPU memory monitoring** — where creative work actually hits the wall.
592. **▲ Scratch-disk health** — the drive that dies first.
593. **▲ Colour-managed display check** — calibration age and reminder.
594. **▲ Peripheral profile per app** — tablet and shortcut layouts.
595. **▲ Shot and scene tracker** — for longer video projects.
596. **▲ Deliverable checklist** — resolution, codec, loudness, before sending.
597. **▲ Portfolio builder** — assemble the best work from the project register.
598. **▲ Showreel assembler** — clips gathered by date and rating.
599. **▲ Creative streak tracking** — days in a row with real making.
600. **▲ Studio mode scene** — lights, quiet, phone away, render nodes freed.

## 16 · PC management and diagnostics (601–650)

601. **▲ Fleet dashboard** — every machine in the house, health at a glance.
602. **▲ Remote inventory** — installed software per machine, kept current.
603. **▲ Software version drift** — who is running an old, vulnerable build.
604. **▲ Update orchestration** — patch the household's machines on a schedule.
605. **▲ Update failure alerts** — an update that did not apply is worse than one not attempted.
606. **▲ Driver currency check** — especially GPU drivers, which matter here.
607. **▲ Startup program audit** — what is slowing the boot.
608. **▲ Boot-time tracking** — trending slower is a real signal.
609. **▲ Crash and bluescreen log** — collected, correlated, explained.
610. **▲ Event-log triage** — surface the handful of Windows events that actually mean something.
611. **▲ Application crash tracking** — which app fails most, and when.
612. **▲ Resource-hog detection** — the process eating the machine.
613. **▲ Memory-leak detection** — processes growing without bound.
614. **▲ Disk I/O bottleneck analysis** — where the machine actually waits.
615. **▲ Temperature alerting** — before thermal throttling becomes damage.
616. **▲ Fan-curve advice** — from measured thermals.
617. **▲ Dust-and-clean prediction** — rising idle temperatures over months.
618. **▲ SMART failure prediction** — replace the drive before it takes the work with it.
619. **▲ Disk cleanup advisor** — what is safe to delete, ranked by size.
620. **▲ Large-file finder** — across every machine in the house.
621. **▲ Duplicate-file finder** — household-wide, not per machine.
622. **▲ Old-download cleanup** — the folder everyone forgets.
623. **▲ Recycle-bin and temp audit** — reclaimed space, reported.
624. **▲ Windows bloat report** — preinstalled software nobody uses.
625. **▲ Service audit** — services running that need not.
626. **▲ Scheduled-task audit** — what is running behind the scenes.
627. **▲ Network-usage per application** — which app is using the line.
628. **▲ Background-telemetry finder** — what your own PC sends out.
629. **▲ Antivirus and defender status** — across every machine.
630. **▲ Firewall rule audit** — what has been allowed through, and by what.
631. **▲ Vulnerability check** — known-bad versions of installed software.
632. **▲ Password-manager coverage** — which accounts are not in it.
633. **▲ Breach checking** — household email addresses against known breaches.
634. **▲ Backup status per machine** — the single most important line in this whole document.
635. **▲ Backup verification** — a restore test, automatically, because untested backups are folklore.
636. **▲ Backup coverage map** — which files are covered and which are not.
637. **▲ Offsite backup status** — the fire-and-theft copy.
638. **▲ Restore drill** — a practised, timed recovery.
639. **▲ System image scheduling** — bare-metal recovery for each machine.
640. **▲ Driver and key backup** — licence keys and drivers kept with the asset record.
641. **▲ New-PC setup automation** — a repeatable build from a stored profile.
642. **▲ Software install manifests** — the household's standard toolset, scripted.
643. **▲ Settings sync across machines** — beyond what the OS offers.
644. **▲ Remote assistance launcher** — help a family member's machine, with consent.
645. **▲ Remote wake and sleep** — already half-built with Wake-on-LAN.
646. **▲ Power schedule per machine** — sleep at night, wake for backups.
647. **▲ Idle-machine harvesting** — use spare CPU for household work like renders.
648. **▲ Benchmark history** — is this machine getting slower, with evidence.
649. **▲ Repair log per machine** — what was done, when, and by whom.
650. **▲ End-of-life planning** — when each machine stops being worth maintaining.

## 17 · Files, documents and records (651–685)

651. **▲ Household document vault** — IDs, passports, policies, warranties, in one encrypted place.
652. **▲ Document expiry tracking** — passports, licences, permits, with real lead time.
653. **▲ Document request flow** — "I need a copy of the lease" answered without a phone call.
654. **▲ OCR on upload** — scanned documents made searchable.
655. **▲ Auto-classification** — an invoice recognised as an invoice and filed.
656. **▲ Bill parsing** — extract amount, due date and account from a PDF bill into the registry.
657. **▲ Statement parsing** — bank statements into transactions.
658. **▲ Receipt parsing** — merchant, total, date, line items.
659. **▲ Contract summariser** — the AI reading a contract and listing the terms that matter.
660. **▲ Policy comparison** — two insurance quotes, side by side, in plain language.
661. **▲ Renewal-letter triage** — what changed against last year.
662. **▲ Document sharing** — a time-limited link for a landlord or an insurer.
663. **▲ Redaction tool** — share proof of address without the account number.
664. **▲ Version history per document** — last year's policy against this year's.
665. **▲ Signature tracking** — what needs signing and by whom.
666. **▲ Certified-copy tracker** — what has been certified and when it expires.
667. **▲ Tax pack assembly** — everything needed for a return, gathered.
668. **▲ Warranty document linking** — attached to the asset, not a folder.
669. **▲ Manual library** — searchable appliance manuals.
670. **▲ How-to capture** — write down how something was fixed, the first time.
671. **▲ Household wiki** — the accumulated knowledge of running this house.
672. **▲ Photo-of-the-thing** — a picture of the meter, the breaker board, the serial plate.
673. **▲ Before-and-after records** — for renovations and repairs.
674. **▲ Improvement log** — what has been done to the property, for resale value.
675. **▲ Renovation cost tracking** — budget against actual.
676. **▲ Plans and drawings store** — architectural plans, kept with the property record.
677. **▲ Compliance certificates** — electrical, gas, plumbing, with expiry.
678. **▲ Inspection history** — what has been inspected and what was found.
679. **▲ Insurance claim pack generator** — documents, photos, serials, in one bundle.
680. **▲ Estate pack** — the document everyone hopes is never needed but should exist.
681. **▲ Digital legacy plan** — what happens to accounts and data.
682. **▲ Storage encryption** — at rest, for this category specifically.
683. **▲ Access audit** — who opened which document, and when.
684. **▲ Retention rules** — documents deleted when no longer needed.
685. **▲ Full-text search across everything** — one box over the household's whole record.

## 18 · Food, kitchen and shopping (686–720)

686. **▲ Meal planner** — the week's dinners, decided once.
687. **▲ Recipe store** — the family's actual recipes, not a website's.
688. **▲ Recipe scaling** — for four, for eight, for one.
689. **▲ Shopping list from the meal plan** — already sketched, now real.
690. **▲ Pantry-aware planning** — plan around what is already in the house.
691. **▲ Leftover tracker** — what is in the fridge and how old it is.
692. **▲ Expiry tracking** — what needs eating first.
693. **▲ Food-waste log** — what got thrown away, and what that cost.
694. **▲ Freezer inventory** — the chest freezer nobody can see into.
695. **▲ Braai planner** — meat quantities per head, and what else is needed.
696. **▲ Dietary requirements per person** — allergies and preferences respected by the planner.
697. **▲ Nutrition summary** — if anyone wants it, from the meal plan.
698. **▲ Favourite-meal ranking** — what the household actually likes.
699. **▲ Meal rotation fairness** — so it is not the same five dinners forever.
700. **▲ Cook roster** — who is cooking, on the same board as the chores.
701. **▲ Takeaway spend tracker** — the honest monthly number.
702. **▲ Takeaway vs cooking comparison** — cost per meal, both ways.
703. **● Sixty60 and online grocery integration** — where an API or an export exists.
704. **▲ Price-per-unit comparison** — the real way to compare grocery prices.
705. **▲ Basket history** — what the household buys, every month.
706. **▲ Staples auto-list** — the things always needed, never remembered.
707. **▲ Bulk-buy advisor** — when buying big actually saves.
708. **▲ Store-run optimiser** — which shops, in which order, for this list.
709. **▲ Shopping budget per trip** — with a running total while shopping.
710. **▲ Till-slip capture** — photograph the slip, and the pantry updates.
711. **▲ Grocery inflation report** — the same basket, tracked over a year.
712. **▲ Seasonal produce advice** — what is cheap and good right now.
713. **▲ Kitchen appliance timers** — shared, named, on every screen.
714. **▲ Oven and cooking reminders** — because that is what timers are for.
715. **▲ Coffee and tea supply tracking** — a genuine household emergency.
716. **▲ Water filter replacement** — on schedule.
717. **▲ Dishwasher and washing machine cycles** — run when power is cheap or solar is up.
718. **▲ Laundry status board** — whose wash is in the machine, and is it done.
719. **▲ Ironing and folding queue** — the household's least-loved backlog.
720. **▲ Kitchen inventory reset** — a periodic audit that keeps the model honest.

## 19 · Health and wellbeing (721–750)

721. **▲ Medication schedule** — per person, with reminders.
722. **▲ Repeat-prescription tracking** — before the last tablet, not after.
723. **▲ Medical aid balance** — savings used and threshold distance.
724. **▲ Claim tracking** — submitted, paid, outstanding.
725. **▲ Doctor and specialist directory** — with practice numbers and last visit.
726. **▲ Appointment history** — who saw whom, when, and why.
727. **▲ Vaccination records** — per person, with due dates.
728. **▲ Allergy and condition register** — visible in an emergency.
729. **▲ Emergency medical card** — the one screen a paramedic would want.
730. **▲ Symptom log** — for a conversation with a doctor, not a diagnosis.
731. **▲ Health-document store** — test results and referral letters.
732. **▲ Dental and optical schedule** — the appointments everyone postpones.
733. **● Wearable integration** — steps, sleep and heart rate, opt-in.
734. **▲ Sleep pattern from device activity** — a proxy that needs no wearable.
735. **▲ Screen-time versus sleep correlation** — the honest, uncomfortable graph.
736. **▲ Break reminders** — during long measured sessions.
737. **▲ Posture and eye-strain nudges** — timed to real sitting.
738. **▲ Hydration reminders** — gentle, ignorable.
739. **▲ Exercise log** — whatever form it takes.
740. **▲ Activity streaks** — the same streak mechanic that works elsewhere.
741. **▲ Household step challenge** — mildly competitive, opt-in.
742. **▲ Mood check-in** — private, one tap, trended over time.
743. **▲ Air quality** — with a sensor, genuinely useful in winter.
744. **◆ CO and smoke detector integration** — the alerts that actually matter.
745. **▲ Humidity and damp tracking** — mould prevention, room by room.
746. **▲ Noise level monitoring** — for sleep and for focus.
747. **▲ Light exposure tracking** — daylight, which affects everything.
748. **▲ Sick-day kit checklist** — what the house should have, checked seasonally.
749. **▲ First-aid inventory** — with expiry dates.
750. **▲ Emergency numbers card** — ambulance, doctor, armed response, poison line.

## 20 · Vehicles and transport (751–780)

751. **✱ Vehicle register** — make, model, VIN, registration, per vehicle.
752. **▲ Licence disc expiry** — the annual South African renewal nobody remembers.
753. **▲ Driver licence expiry** — per person.
754. **▲ Service schedule** — by kilometres and by date, whichever comes first.
755. **▲ Service history** — what was done, where, and what it cost.
756. **▲ Odometer tracking** — entered or photographed.
757. **▲ Fuel log** — litres, price, odometer, giving real consumption.
758. **▲ Consumption trend** — a rising figure usually means a fault.
759. **▲ Cost per kilometre** — the honest cost of running each car.
760. **▲ Trip log** — for business claims or just for knowing.
761. **▲ Insurance and tracker details** — policy, excess, tracker contact.
762. **▲ Tyre tracker** — fitted date, mileage, rotation and replacement.
763. **▲ Battery age** — the part that strands you.
764. **▲ Warranty and service plan expiry** — before it lapses.
765. **▲ Roadworthy and inspection dates** — kept ahead of.
766. **▲ Traffic fine tracking** — AARTO notices and payment status.
767. **▲ Toll and e-toll spend** — logged.
768. **▲ Parking and fine documents** — filed with the vehicle.
769. **▲ Accident and claim history** — per vehicle.
770. **▲ Vehicle document pack** — everything needed at a roadblock, on a phone.
771. **▲ Who-has-the-car board** — the household's most common argument, solved.
772. **▲ Car booking** — reserve the car for a trip.
773. **▲ Lift scheduling** — who is fetching whom.
774. **▲ School-run roster** — the recurring one.
775. **● Departure advice with traffic** — leave-by time for a real appointment.
776. **▲ Fuel price tracking** — the monthly South African price change, and its effect on the budget.
777. **▲ Trip cost estimator** — fuel and tolls for a planned journey.
778. **▲ Road-trip checklist** — vehicle, documents, supplies.
779. **▲ Breakdown procedure card** — who to call and what to say.
780. **▲ Vehicle replacement planning** — when this car stops being economical.

## 21 · Home maintenance and repairs (781–810)

781. **▲ Maintenance calendar** — the recurring jobs a house actually needs.
782. **▲ Seasonal maintenance** — gutters before the rains, geyser before winter.
783. **▲ Appliance service schedule** — per appliance, per manufacturer guidance.
784. **▲ Filter replacement register** — aircon, water, vacuum, extractor.
785. **▲ Fault reporting** — anyone in the house can log something broken.
786. **▲ Fault triage** — urgent, soon, or someday, with a reason.
787. **▲ Repair history per item** — the third failure means replace, not repair.
788. **▲ Contractor scheduling** — book, confirm, and log the visit.
789. **▲ Quote collection** — multiple quotes for one job, compared.
790. **▲ Job cost tracking** — quoted against actual.
791. **▲ Contractor rating** — the household's own record of who is good.
792. **▲ Warranty-versus-repair check** — is this still covered.
793. **▲ DIY guidance** — the AI walking through a safe repair, with a hard stop at anything electrical or gas.
794. **▲ Parts identification** — photograph the part, find what it is.
795. **▲ Spare-parts ordering** — with the model number already known.
796. **▲ Tool inventory** — what the house owns, and where it lives.
797. **▲ Tool borrowing register** — including from neighbours.
798. **▲ Paint and material stock** — what is left in the garage.
799. **▲ Project planning** — a renovation broken into steps and costs.
800. **▲ Permit tracking** — municipal approvals for building work.
801. **▲ Snag list** — the small defects, collected rather than forgotten.
802. **▲ Room condition log** — with photographs over time.
803. **▲ Damp and crack monitoring** — photographed periodically from the same spot.
804. **▲ Roof and gutter inspection log** — annual, with photos.
805. **▲ Pest control schedule** — treatments and their effect.
806. **▲ Fire extinguisher and alarm checks** — with service dates.
807. **▲ Emergency shutoff drill** — practised, so it is known under pressure.
808. **▲ Maintenance budget** — an annual figure, tracked.
809. **▲ Deferred maintenance register** — what is being put off, and the growing risk.
810. **▲ House condition score** — an honest overall read.

## 22 · The AI layer: The Sauce, agents and memory (811–865)

811. **▲ World-model context** — The Sauce reading the registry instead of a hand-assembled snippet.
812. **▲ Retrieval rather than stuffing** — fetch the facts relevant to the question, not everything.
813. **▲ Long-term memory** — durable facts learned from conversation, recalled later.
814. **▲ Memory with provenance** — who told it, when, and how sure it is.
815. **▲ Memory review** — see what the AI believes, and correct it.
816. **▲ Forgetting** — the right to have something unlearned.
817. **▲ Per-person memory** — what it knows about each family member, separately governed.
818. **▲ Conversation continuity** — remembering across sessions, not just turns.
819. **▲ Proactive suggestions** — only when genuinely warranted, and easy to switch off.
820. **▲ Confidence expression** — saying "I think" versus "I know", correctly.
821. **▲ Refusal to guess** — answering "I don't know that about your house" rather than inventing.
822. **▲ Contradiction surfacing** — telling you when two sources disagree.
823. **▲ Sensor reliability scoring** — from corroboration, not introspection.
824. **▲ Explain-yourself mode** — why the AI said or did something, traceable.
825. **▲ Action preview** — what it is about to do, before it does it.
826. **▲ Undo for AI actions** — everything reversible.
827. **▲ Action audit trail** — every AI action, logged and reviewable.
828. **▲ Permission tiers for the AI** — read, suggest, act, and act without asking.
829. **▲ Per-domain permissions** — it can run the lights but not touch the money.
830. **▲ Spending limits** — a hard ceiling on anything with a cost.
831. **▲ Escalation to a human** — when confidence is low or stakes are high.
832. **▲ Multi-step planning** — plan, show the plan, execute on approval.
833. **▲ Tool expansion** — more verbs than the current four.
834. **▲ Tool reliability tracking** — which tools actually work, measured.
835. **▲ Local model fallback** — a small model for when the internet is down.
836. **▲ Cost tracking for AI calls** — what the intelligence itself costs per month.
837. **▲ Response-time monitoring** — and a fallback when the brain is slow.
838. **▲ Agent roles with real scope** — each agent owning a domain rather than all of them writing skins.
839. **▲ Agent proposal pipeline** — proposals that can become real features, not silently downgraded to none.
840. **▲ Artifact types beyond decoration** — adapters, automations, reports, integrations.
841. **▲ Live-bound widgets** — cards that read real data instead of reciting prose.
842. **▲ Generated-artifact consumption** — the surfaces actually rendering what is generated.
843. **▲ Keep-or-drop verdicts** — one button per artifact, feeding the ledger.
844. **▲ Usage-based pruning** — unused generations retired automatically.
845. **▲ Generation quality scoring** — measured by whether anyone kept it.
846. **▲ Evidence pack for the agents** — real usage data, so they optimise against reality.
847. **▲ Volume governance** — a cap on how much can be produced before something is consumed.
848. **▲ Ledger pruning** — the AI's memory kept useful rather than merely large.
849. **▲ Agent debate** — two agents arguing a proposal before it reaches you.
850. **▲ Red-team agent** — one whose job is to find the flaw in a plan.
851. **▲ Postmortem agent** — reviewing what shipped and whether it helped.
852. **▲ Self-assessment honesty** — the team reporting failure as clearly as success.
853. **▲ Roadmap proposal** — the agents proposing what to build next, ranked.
854. **▲ Code review by agent** — before anything touches the estate.
855. **▲ Test generation** — every generated artifact arriving with a test.
856. **▲ Rollback on regression** — automatic, when a change makes things worse.
857. **▲ Canary deployment** — a change visible to one person first.
858. **▲ Household-specific fine-tuning** — prompts shaped by this family's actual patterns.
859. **▲ Voice input to The Sauce** — from the kiosk.
860. **◆ Voice output** — spoken responses, sparingly.
861. **▲ Wake-word-free interaction** — a button, not always-on listening.
862. **▲ Multilingual support** — English and Afrikaans, at least.
863. **▲ Tone control** — how chatty the house is, per person.
864. **▲ AI off-switch** — a genuine one, that everyone can reach.
865. **▲ Transparency report** — what the AI did this week, in plain language.

## 23 · Onboarding, the census and integrations (866–905)

866. **▲ App census at install** — enumerate what is installed and match it against the integration catalogue.
867. **▲ Per-app integration offers** — a specific benefit and a switch, never a blanket permission ask.
868. **▲ Integration catalogue as data** — detection rules and capabilities declared, not hard-coded.
869. **▲ Detection confidence** — "we think you use Blender" with a way to say no.
870. **▲ Subscription capture during census** — found Spotify, so ask the tier, and the registry gains a bill.
871. **● Spotify OAuth** — listening history and plan tier.
872. **● Steam Web API** — playtime and achievements beyond the local library.
873. **▲ Epic, GOG and Battle.net manifests** — local read, no accounts needed.
874. **▲ Blender recent-files import** — projects, instantly.
875. **▲ Resolve project database read** — local, no API.
876. **▲ Claude and ChatGPT history import** — the trick that started this idea.
877. **▲ Browser profile import** — bookmarks and top sites, strictly opt-in.
878. **● Google account integration** — calendar already done, plus Drive usage and storage tier.
879. **● Microsoft account integration** — OneDrive and Office subscription state.
880. **● Xbox and PlayStation** — playtime and achievements.
881. **▲ Discord presence and Nitro cost** — mostly a cost entry.
882. **✱ Streaming services without APIs** — cost and viewer, entered once.
883. **▲ Per-integration health** — is this connection still working.
884. **▲ Token refresh handling** — OAuth that does not quietly die.
885. **▲ Integration permission review** — see and revoke what each one can do.
886. **▲ Data-pull scheduling** — how often each integration syncs.
887. **▲ First-run personalisation** — the archetype detection already built, extended by the census.
888. **▲ Import from other tools** — spreadsheets, Notion, whatever the family already uses.
889. **▲ Guided household setup** — the conversational version, for the parts no machine can detect.
890. **▲ Setup progress** — how complete the household model is, with the next best gap.
891. **▲ Per-person invite flow** — already built, now with a real reason to accept.
892. **▲ Onboarding for non-technical family** — Mom and Dad, specifically designed for.
893. **▲ Device pairing flow** — add a phone to the household in under a minute.
894. **▲ QR-code onboarding** — scan from the kiosk, and you are in.
895. **▲ Migration between machines** — move a person's L.A.B setup to a new PC.
896. **▲ Multi-household support** — if someone moves out but stays connected.
897. **▲ Export everything** — the household's whole model, portable.
898. **▲ Integration marketplace** — the App Store listing real integrations, not colour themes.
899. **▲ Community integration definitions** — since the catalogue is data, others could contribute.
900. **▲ Webhook receiver** — a generic way to let anything push into the Hub.
901. **▲ Generic REST poller** — pull from any JSON API on a schedule, declaratively.
902. **▲ IFTTT and Zapier bridge** — for the long tail.
903. **▲ MQTT broker** — the lingua franca of home hardware.
904. **▲ Matter and Thread support** — the standard that most new devices will speak.
905. **▲ Home Assistant adapter** — as invisible plumbing, never as the identity of the product.

## 24 · Kiosks and ambient surfaces (906–930)

906. **▲ Kiosk assignment** — the original idea: name a kiosk and give it a role and a room.
907. **▲ Per-kiosk layout** — the kitchen screen and the hall screen showing different things.
908. **▲ Context-aware kiosk** — different content by time of day.
909. **▲ Proximity wake** — the screen comes alive as someone approaches.
910. **▲ Idle slideshow** — photos and quiet information when nobody is near.
911. **▲ Night mode** — dim, red-shifted, unobtrusive.
912. **▲ Kiosk as a clock** — the most-used feature of any wall screen.
913. **▲ Weather panel** — today and the next few days.
914. **▲ Load-shedding panel** — the single most useful South African wall-screen feature.
915. **▲ Transport and traffic panel** — for the morning run.
916. **▲ Arrivals board** — who is home, who is on the way.
917. **▲ Family message wall** — notes left on the screen.
918. **▲ Photo-frame mode** — a genuine use for an old tablet.
919. **▲ Recipe mode** — hands-free in the kitchen, step by step.
920. **▲ Shopping list at the door** — visible on the way out.
921. **▲ Quick actions per room** — the three things you actually do in this room.
922. **▲ Touch-free interaction** — voice or gesture where hands are busy.
923. **▲ Screen-burn protection** — for an always-on panel.
924. **▲ Kiosk health monitoring** — a screen that has frozen, detected.
925. **▲ Remote kiosk refresh** — push an update to every wall screen at once.
926. **▲ Old-device kiosk mode** — turn a retired phone or tablet into a wall panel.
927. **▲ E-ink surface support** — for a low-power always-on list.
928. **▲ TV dashboard mode** — the household board on the living-room TV.
929. **▲ Ambient light adaptation** — brightness that matches the room.
930. **▲ Kiosk lock-down** — a wall screen cannot be used to change the house's money.

## 25 · Platform, operations and reliability (931–960)

931. **▲ Backup verification** — already running nightly; now prove a restore works.
932. **▲ Offsite backup** — the copy that survives a fire or a theft.
933. **▲ Backup encryption** — before anything leaves the house.
934. **▲ Restore runbook** — written, tested, timed.
935. **▲ Database migration system** — schema changes with a real up and down path.
936. **▲ Configuration as code** — the estate reproducible from a repository.
937. **▲ Secrets management** — properly, not in environment files.
938. **▲ Staging environment** — test before the family sees it.
939. **▲ Feature flags** — ship dark, enable per person.
940. **▲ Canary releases** — one machine first.
941. **▲ Automated smoke tests** — already built, now run on every deploy.
942. **▲ Integration test suite** — the paths that matter, tested end to end.
943. **▲ Synthetic monitoring** — a robot that uses the Hub every hour and complains when it breaks.
944. **▲ Error tracking** — exceptions collected and grouped.
945. **▲ Structured logging** — searchable, not a wall of text.
946. **▲ Metrics and dashboards** — the server's own health over time.
947. **▲ Alerting on the platform itself** — when the Hub is sick, someone should know.
948. **▲ Uptime tracking** — honest numbers for the household's own service.
949. **▲ Performance budgets** — pages that must load in under a second.
950. **▲ Dependency-update automation** — with tests as the gate.
951. **▲ Security patching cadence** — for the server itself.
952. **▲ Certificate renewal** — automated, before expiry.
953. **▲ Disk-space guard** — the server protecting itself from filling up.
954. **▲ Log rotation and retention** — bounded growth.
955. **▲ Graceful degradation** — the Hub still useful when a dependency is down.
956. **▲ Offline-first everywhere** — already in the app, now on every surface.
957. **▲ Tailscale for off-home access** — the outstanding one, five minutes of work.
958. **▲ Multi-server support** — if the estate ever outgrows the G50.
959. **▲ Hardware migration plan** — moving the L.A.B to better hardware without losing anything.
960. **▲ Disaster recovery drill** — practise losing the server entirely.

## 26 · Privacy, governance and trust (961–980)

961. **▲ Household data policy** — written in plain language, agreed by everyone.
962. **▲ Per-person data dashboard** — what the house holds about you, visible to you.
963. **▲ Consent management** — granular, revocable, and honoured.
964. **▲ Data deletion on request** — real deletion, verified.
965. **▲ Visibility rules between family members** — Dad's debt is not the teenager's business.
966. **▲ Sensitive-field masking** — account numbers as last-four everywhere.
967. **▲ Encryption at rest for the registry** — the financial and document domains specifically.
968. **▲ Access logging** — who looked at what.
969. **▲ Admin action audit** — already built, now surfaced to the family.
970. **▲ AI data boundary** — what reaches a prompt, documented and enforced.
971. **▲ Local-only mode** — a switch that stops anything leaving the house.
972. **▲ Third-party data inventory** — which integrations hold household data.
973. **▲ Right to leave** — export everything and walk away cleanly.
974. **▲ Child data protections** — stricter defaults for minors.
975. **▲ Monitoring versus surveillance line** — written down, so it is not crossed by accident.
976. **▲ Presence-tracking consent** — explicit, per person, revocable.
977. **▲ Camera privacy schedule** — off when the family is home, if they want.
978. **▲ Transparency notice on every surface** — what this screen knows.
979. **▲ Governance dial** — how much autonomy the AI has, one control, understood by everyone.
980. **▲ Household review meeting** — a monthly report the family reads together.

## 27 · Guests, pets and the edges (981–1000)

981. **▲ Guest mode** — a temporary identity with its own expiry.
982. **▲ Guest welcome pack** — wifi, house rules, bins, quiet hours, on arrival.
983. **▲ Guest room readiness** — the checklist before someone stays.
984. **▲ Visitor parking and access** — gate codes that expire.
985. **▲ House-sitter mode** — elevated access for a fixed window, then revoked.
986. **▲ Airbnb-style handover** — if a room is ever let.
987. **▲ Pet register** — species, age, vet, microchip, feeding.
988. **▲ Feeding schedule** — with a tick, so nobody double-feeds.
989. **▲ Vet appointment and vaccination tracking** — per animal.
990. **▲ Pet medication reminders** — the ones easily forgotten.
991. **◆ Pet feeder integration** — if one exists.
992. **▲ Pet-sitter instructions** — generated, not rewritten each time.
993. **▲ Lost-pet pack** — photos and details, ready instantly.
994. **▲ Livestock or chickens** — because this is South Africa and some households have them.
995. **▲ Household inventory for moving** — box-by-box, if you ever move.
996. **▲ Insurance-grade home inventory video** — walk through with a phone, and it is catalogued.
997. **▲ Estate and succession pack** — the grown-up version of the document vault.
998. **▲ Time capsule** — a yearly snapshot of the household, kept.
999. **▲ Household annual report** — the year in money, time, energy and memories.
1000. **▲ The honest scoreboard** — one page saying what the L.A.B actually did for this family this year, including where it failed.

---

## If you only do ten

Ranked by value delivered per hour of work, given where the estate stands today:

1. **#811 World-model context** — The Sauce reading the registry. Everything else the AI does gets better for free.
2. **#841 Live-bound widgets** — the single structural flaw that makes 123 generated cards dead prose.
3. **#842 Generated-artifact consumption** — the hub renders skins only; fixing that unlocks 247 existing artifacts.
4. **#41 Bill register** — the fastest path to a number that matters to your Dad.
5. **#344 Presence by device** — zero hardware, and it is the trigger behind half of all useful automation.
6. **#261 Load-shedding schedule** — the most useful South African feature on any wall screen.
7. **#211 Camera onboarding** — the hardware is already there and already found.
8. **#866 App census** — your Spotify idea, and the thing that makes onboarding feel like magic.
9. **#634 Backup status per machine** — unglamorous, and the one that saves the creative work.
10. **#957 Tailscale** — five minutes, and your brother can finally reach it.

