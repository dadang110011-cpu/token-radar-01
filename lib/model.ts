// The token radar's model (radar-2): one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every
// other rankable pre-token protocol: the early radar exists to find them all, not the top few by
// size. A protocol is pre-token when its index entry records no token (no market cap, no
// CoinGecko id, no symbol) and it is not a wrapped, staked or bridged product of a token that
// already trades (the watchlist's own exclusion, applied to every row); the snapshot's
// live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures — no protocol name is ever
// special-cased, and every multiplier below is computed from the snapshot or stated as a
// constant the dashboard shows:
//
//   base       = tvl_usd x BASE_MULTIPLE                     (0.25: a token tends to price near a
//                                                             quarter of the value it secures)
//   growth     = clamp(change_7d, -60, 150) per cent
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT         (0.5: a hot week lifts value, a cold
//                                                             one trims it, neither dominates)
//   maturity   = a hump over age_days (days since listed_at):
//                  age 0    -> 0.55   (too young to judge)
//                  age 540  -> 1.00   (about 18 months: proven, still pre-token, prime to launch)
//                  age 1840 -> 0.75   (ran for years with no token: probably never launching)
//                age unknown -> 365 days. A protocol that has run a long time with no token is
//                not more valuable for it; the starter's ever-rising maturity got this backwards.
//   chainMult  = 1 + 0.03 x min(chains - 1, 7)              (each extra chain widens the
//                                                             distribution a token would launch
//                                                             into; a single-chain protocol is
//                                                             concentrated, not diversified)
//   categoryMult = 0.85 + 0.30 x tokenShare(category), where tokenShare is the share of the
//                snapshot's protocols in that category that already record a token, smoothed
//                toward the snapshot-wide share (416/758) with a prior of 5 protocols. A
//                category where tokens are the norm (most Dexs and Lending protocols have one)
//                lifts a pre-token member; a category where tokens are rare trims it. The share
//                is read from this snapshot, never written by hand.
//   implied    = max(1, round(base x growthMult x maturityMult x chainMult x categoryMult))
//
// The board is every rankable protocol, strongest first: the watchlist rows are guaranteed in,
// then every other rankable pre-token protocol, ranked by this score — not by raw TVL, so a
// smaller protocol that is growing fast, multi-chain and in a tokenising category can outrank a
// larger stagnant one.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_peak_days: number;
  maturity_late_floor: number;
  maturity_late_days: number;
  unknown_age_days: number;
  chain_bonus: number;
  chain_bonus_max: number;
  category_base: number;
  category_range: number;
  category_prior_n: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_peak_days: 540,
  maturity_late_floor: 0.75,
  maturity_late_days: 1300,
  unknown_age_days: 365,
  chain_bonus: 0.03,
  chain_bonus_max: 7,
  category_base: 0.85,
  category_range: 0.3,
  category_prior_n: 5,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    category_multiplier: number;
    category_token_share: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan carried along. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiplier: number;
  category_share: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The maturity hump: 0.55 at birth, rising to 1.00 at `peak_days`, then falling toward
 * `late_floor` over `late_days` after the peak. A protocol that has run for years with no token
 * is discounted, not rewarded, for its age.
 */
export function maturityMultiplier(age: number | null, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  if (a <= model.maturity_peak_days) {
    return model.maturity_floor + (1 - model.maturity_floor) * (a / model.maturity_peak_days);
  }
  const past = Math.min(a - model.maturity_peak_days, model.maturity_late_days);
  return 1 - (1 - model.maturity_late_floor) * (past / model.maturity_late_days);
}

/** The chain-diversity multiplier: each chain past the first adds `chain_bonus`, capped. */
export function chainMultiplier(chains: string[], model: ModelConstants): number {
  return 1 + model.chain_bonus * Math.min(Math.max(chains.length - 1, 0), model.chain_bonus_max);
}

/**
 * The category's token share, read from the whole snapshot and smoothed toward the
 * snapshot-wide share with a prior of `category_prior_n` protocols. Categories with few
 * protocols stay near the overall share instead of swinging on one or two members.
 */
export function categoryTokenShare(category: string | null, snapshot: Snapshot, model: ModelConstants): number {
  let total = 0;
  let withToken = 0;
  let allTotal = 0;
  let allWithToken = 0;
  for (const p of snapshot.protocols) {
    const has = !isPreToken(p);
    allTotal++;
    if (has) allWithToken++;
    if ((p.category ?? null) === category) {
      total++;
      if (has) withToken++;
    }
  }
  const prior = allTotal === 0 ? 0.5 : allWithToken / allTotal;
  return (withToken + model.category_prior_n * prior) / (total + model.category_prior_n);
}

/** The category multiplier: 0.85 plus up to 0.30 for a category where tokens are the norm. */
export function categoryMultiplier(category: string | null, snapshot: Snapshot, model: ModelConstants): number {
  return model.category_base + model.category_range * categoryTokenShare(category, snapshot, model);
}

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  snapshot: Snapshot,
  model: ModelConstants,
): { implied: number; growthPct: number; growthMult: number; maturityMult: number; chainMult: number; categoryMult: number; categoryShare: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const maturityMult = maturityMultiplier(age, model);
  const chainMult = chainMultiplier(protocol.chains, model);
  const categoryShare = categoryTokenShare(protocol.category, snapshot, model);
  const categoryMult = model.category_base + model.category_range * categoryShare;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * chainMult * categoryMult));
  return { implied, growthPct, growthMult, maturityMult, chainMult, categoryMult, categoryShare, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking is a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** The exchange names the watchlist rule treats as a product of that exchange's token. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Categories the watchlist rule keeps off the list: a bridge, a liquid staking product or a restaked product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades. The rule is the watchlist's own, applied to every row,
 * not just the floor: WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in Binance's
 * staking product, and neither is a protocol still waiting on a launch of its own. A board that
 * ranked them at the top would claim a token that already trades is still to come.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/**
 * The protocols the board ranks, strongest first, with ranks 1..n: every watchlist slug, plus
 * every other rankable pre-token protocol — the whole early radar, ranked by the model's score.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot,
  // but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, whatever its size. Selection is by
  // the model's score below, never by raw TVL, so a small fast grower can outrank a big stagnant
  // one. Never a replacement for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, snapshot, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      category_multiplier: round4(s.categoryMult),
      category_token_share: round4(s.categoryShare),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's first action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('liquid staking') || c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into a ${name} strategy vault on ${chain} and keep the shares.`;
  if (c === 'chain') return `Bridge $${capital} of USDC to ${name}'s chain and use its flagship app once.`;
  if (c.includes('payment')) return `Pay $${capital} through ${name} on ${chain} for a real purchase or transfer.`;
  if (c.includes('governance')) return `Deposit $${capital} of USDC into ${name}'s governance vault on ${chain} and vote once.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second, deepening action: a second touch that proves the wallet is a user, not a tourist. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const half = Math.max(10, Math.round(capital / 2));
  if (c.includes('dex')) return `Swap $${half} of USDC through ${name}'s main pool on ${chain} so the wallet has both a position and a trade.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${half} of USDC against the supply on ${name}, use it for one swap, then repay it the same week.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount of $${half} a week later, so the wallet shows repeated use instead of one crossing.`;
  if (c.includes('liquid staking') || c.includes('staking') || c.includes('restak')) return `Deposit the receipt token from ${name} into one of its partner apps on ${chain} instead of letting it sit idle.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis')) return `Close the first hedge on ${name} and open a second one half its size, so the wallet shows two fills.`;
  if (c.includes('prediction')) return `Settle the first market position on ${name} and place a second one in a different market.`;
  if (c.includes('stable')) return `Use $${half} of the minted stable asset in one of ${name}'s partner pools on ${chain}.`;
  if (c.includes('rwa')) return `Move $${half} of the yield asset into a second ${name} product on ${chain} to show a second holding.`;
  if (c.includes('insurance')) return `Renew or top up the cover on ${name} once, so the policy covers a second period.`;
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) return `Move the vault shares into ${name}'s compounding option on ${chain}, if it offers one, and leave them there.`;
  if (c.includes('payment')) return `Make a second payment of $${half} through ${name} on ${chain} to a different recipient.`;
  if (c.includes('governance')) return `Vote a second time on ${name} on a different proposal, so the wallet is a repeat voter.`;
  if (c === 'chain') return `Use a second app on ${name}'s chain once, so the wallet is active on the chain and not only on its bridge.`;
  return `Make a second deposit of $${half} into ${name} on ${chain} a week after the first.`;
}

/**
 * A protocol's farm plan: six to eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names. Multi-chain protocols get a step to repeat the position on a second chain;
 * bridge protocols get a step to use the bridged funds, so the plan follows the money.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${Math.max(2, Math.round(capital / 25))} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  if (p.chains.length > 1) {
    const secondChain = p.chains[1]!;
    steps.splice(3, 0, {
      text: `Repeat the position on ${secondChain} with half the capital, so the wallet is active on two of the protocol's chains.`,
      cost: `about $${Math.max(25, Math.round(capital / 2))} of capital and $4 of gas`,
      time: '15 minutes',
    });
  }
  return steps;
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan carried along. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiplier: row.model.category_multiplier,
    category_share: row.model.category_token_share,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
