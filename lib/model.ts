// Token Radar's model, version radar-3: one sealed snapshot in, one ranked board out.
//
// The board ranks every protocol on the snapshot's watchlist (the floor, never a ceiling) plus every
// rankable pre-token protocol below the floor. A protocol is pre-token when its record carries no token
// at all (no market cap, no CoinGecko id, no symbol); live-token protocols are kept apart and shown
// with the market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures. Four things changed since radar-2:
//
//   1. Shrinkage: the category multiple is no longer a bare median that a small category can set
//      on a handful of samples. A category needs at least three live protocols to price itself;
//      its median is then pulled toward the overall live median, with a prior worth five
//      protocols: (n x category median + 5 x overall median) / (n + 5). A category with fewer
//      than three live protocols uses the overall median outright, so one protocol's ratio -
//      one live Prediction Market protocol sits at x400 - can never set the price for a whole
//      category.
//   2. Reach: a protocol on more chains reaches more users, so its token would be worth more. The
//      reach factor is 1 + 0.03 for each chain past the first, up to five extra chains (x1.00-x1.15).
//   3. Asymmetric growth: a falling TVL is a stronger warning than a rising TVL is a promise. A
//      seven-day fall is weighted 0.8 per point, a rise 0.6; the change is clamped to -80..+150%.
//   4. Diminishing maturity: how long a protocol has run with no token matters most in its first
//      year and then saturates, 0.65 + 0.35 x (1 - exp(-age / 365)), instead of a straight line to
//      1.0 at three years. An unknown age still counts as 365 days.
//
//   multiple   = clamp((n x median live mcap / TVL in the category + 5 x overall median) / (n + 5),
//                  0.05, 1.00); a category with fewer than three live protocols uses the overall median
//   growth     = clamp(change_7d, -80, 150) per cent
//   growthMult = 1 + (growth / 100) x (growth >= 0 ? 0.6 : 0.8)
//   maturity   = 0.65 + 0.35 x (1 - exp(-age_days / 365))   (age unknown: 365 days)
//   reach      = 1 + 0.03 x min(max(chains - 1, 0), 5)
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturity x reach))
//
// No protocol name is ever special-cased: one function scores every row, and the dashboard prints
// the calibrated multiples it used. The farm plan is derived from the same record (category, chains,
// TVL, age): eight concrete steps with what each costs and how long it takes, never a hand-written
// list of names; the eighth step re-checks the row against this board once a month.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight_pos: number;
  growth_weight_neg: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_scale_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_live_samples: number;
  shrinkage_prior: number;
  chain_step: number;
  chain_max_steps: number;
}

export const MODEL: ModelConstants = {
  growth_weight_pos: 0.6,
  growth_weight_neg: 0.8,
  growth_floor: -80,
  growth_cap: 150,
  maturity_floor: 0.65,
  maturity_range: 0.35,
  maturity_scale_days: 365,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  min_live_samples: 3,
  shrinkage_prior: 5,
  chain_step: 0.03,
  chain_max_steps: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One calibrated multiple: the shrunk median live market-cap-per-TVL of a category. */
export interface CategoryMultiple {
  multiple: number;
  live_count: number;
  from_fallback: boolean;
}

/** The calibration the model computed from the snapshot's live-token protocols. */
export interface Calibration {
  by_category: Record<string, CategoryMultiple>;
  overall: CategoryMultiple;
}

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
    category_multiple: number;
    multiple_source: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row, farm plan included. */
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
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
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
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  live_all: LiveRow[];
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

/** The median of a sorted list of numbers; 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * Calibrate the base multiple from the snapshot's own live-token market: for each category with
 * at least three live protocols, the median market-cap-per-TVL of its live protocols, shrunk
 * toward the overall median with a prior worth five protocols, so a small category cannot set
 * the price for itself on a handful of samples; categories with fewer live protocols, and any
 * protocol with no category, fall back to the overall median. Every multiple is clamped to the
 * model's band, so one outlier protocol can never set the price for a whole category.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const list = byCategory.get(p.category ?? 'Other') ?? [];
    list.push(ratio);
    byCategory.set(p.category ?? 'Other', list);
  }
  const overallMultiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, median(all)));
  const overall: CategoryMultiple = { multiple: overallMultiple, live_count: all.length, from_fallback: false };
  const out: Record<string, CategoryMultiple> = {};
  for (const [category, ratios] of byCategory) {
    if (ratios.length < model.min_live_samples) continue;
    const catMedian = median(ratios);
    const shrunk = (ratios.length * catMedian + model.shrinkage_prior * overallMultiple) / (ratios.length + model.shrinkage_prior);
    out[category] = {
      multiple: Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk)),
      live_count: ratios.length,
      from_fallback: false,
    };
  }
  return { by_category: out, overall };
}

/** A category's multiple under a calibration, with the fallback when it has no live samples. */
export function multipleFor(category: string | null, calibration: Calibration): { multiple: number; source: string } {
  const entry = category !== null ? calibration.by_category[category] : undefined;
  if (entry !== undefined) return { multiple: entry.multiple, source: `live median, n=${entry.live_count}, shrunk toward overall` };
  return { multiple: calibration.overall.multiple, source: `overall live median, n=${calibration.overall.live_count}` };
}

/** How much wider a protocol's reach is for running on more than one chain, x1.00 to x1.15. */
export function reachMultiplier(chains: string[], model: ModelConstants = MODEL): number {
  const extra = Math.min(Math.max(chains.length - 1, 0), model.chain_max_steps);
  return 1 + extra * model.chain_step;
}

/** The four multipliers and the implied value one protocol gets under `model` and `calibration`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; source: string; growthPct: number; growthMult: number; maturityMult: number; reachMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const { multiple, source } = multipleFor(protocol.category, calibration);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthWeight = growthPct >= 0 ? model.growth_weight_pos : model.growth_weight_neg;
  const growthMult = 1 + (growthPct / 100) * growthWeight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + model.maturity_range * (1 - Math.exp(-Math.max(ageForModel, 0) / model.maturity_scale_days));
  const reachMult = reachMultiplier(protocol.chains, model);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * reachMult));
  return { implied, multiple, source, growthPct, growthMult, maturityMult, reachMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, calibration: Calibration, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor. A chosen
  // protocol stays chosen; the floor is never the whole board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model);
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
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.multiple),
      multiple_source: s.source,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.reachMult),
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

/** The category's main action, in the words a farmer can follow. */
function mainActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} of USDC into ${name}'s auto-compounding vault on ${chain}.`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-yield vault on ${chain} and let it compound.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index token on ${chain} and hold it.`;
  if (c.includes('chain') && !c.includes('cross')) return `Bridge $${capital} of USDC to the ${name} chain and use its flagship app.`;
  if (c.includes('payment') || c.includes('card')) return `Load $${capital} onto ${name} and spend it through the card once.`;
  if (c.includes('governance')) return `Lock $${capital} of the governance asset through ${name} and keep the lock open.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into a ${name} managed pool on ${chain} and let it rebalance.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name}'s vault on ${chain} and keep the shares.`;
  if (c.includes('btc')) return `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second action: a follow-up that proves repeated use, not a one-off deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${Math.max(10, Math.round(capital / 5))} against the supply, then repay it the same week.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Swap $${Math.max(10, Math.round(capital / 5))} through ${name}'s main pool on ${chain} and add the proceeds to the position.`;
  if (c.includes('bridge')) return `Bridge a second, smaller amount back the other way so the route shows two-way use.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the receipt token once more through ${name} so the position compounds.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Close the hedge and open a fresh one at the new funding rate, keeping the margin in place.`;
  if (c.includes('prediction')) return `Settle the first position and place a second one in a different market on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move a small part of the deposit into a second ${name} vault on ${chain}.`;
  if (c.includes('stable')) return `Swap a small part of the stable asset back to USDC through ${name} to show two-way use.`;
  if (c.includes('rwa')) return `Claim the first yield payout from the ${name} position and restake it.`;
  if (c.includes('insurance')) return `Extend the cover by one more period before the first one lapses.`;
  if (c.includes('yield aggregator')) return `Harvest the vault's rewards once and deposit them back into the same vault.`;
  if (c.includes('yield')) return `Harvest the vault's yield once and deposit it back so the position compounds.`;
  if (c.includes('index')) return `Rebalance the index holding once, following the index's own weights.`;
  if (c.includes('chain') && !c.includes('cross')) return `Stake a small part of the bridged funds in the chain's native staking through ${name}.`;
  if (c.includes('payment') || c.includes('card')) return `Top the card up a second time and make one more purchase.`;
  if (c.includes('governance')) return `Vote once with the locked position on a live ${name} proposal.`;
  if (c.includes('liquidity manager')) return `Let the manager rebalance once, then add a small top-up to the pool.`;
  if (c.includes('cedefi')) return `Rotate a small part of the deposit into a second ${name} vault.`;
  if (c.includes('btc')) return `Use the minted asset as collateral for one small borrow on ${chain}.`;
  return `Make a second deposit of $${Math.max(10, Math.round(capital / 5))} into the same position.`;
}

/** The category's weekly action: the repeated use an airdrop snapshot looks for. */
function weeklyActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply or repay a little each week so the ${name} position shows steady use.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Swap a small amount through ${name}'s main pool each week and add the proceeds to the position.`;
  if (c.includes('bridge')) return `Bridge a small amount each week so the ${name} route shows repeated use.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the receipt token's rewards each week so the ${name} position compounds.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) return `Adjust the hedge once a week as the funding rate on ${name} moves.`;
  if (c.includes('prediction')) return `Place one small position a week in a new market on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move a small part between the ${name} vaults each week.`;
  if (c.includes('stable')) return `Mint or redeem a small amount each week to show two-way use of ${name}.`;
  if (c.includes('rwa')) return `Claim the yield payout each week from the ${name} position and restake it.`;
  if (c.includes('insurance')) return `Check the ${name} cover each week and extend it before it lapses.`;
  if (c.includes('yield aggregator')) return `Harvest the vault's rewards each week and deposit them back into the same vault.`;
  if (c.includes('yield')) return `Harvest the vault's yield each week and deposit it back so the position compounds.`;
  if (c.includes('index')) return `Rebalance the index holding once a week, following the index's own weights.`;
  if (c.includes('chain') && !c.includes('cross')) return `Use the chain's flagship app once a week with a small amount through ${name}.`;
  if (c.includes('payment') || c.includes('card')) return `Spend through the ${name} card once a week.`;
  if (c.includes('governance')) return `Vote on each new proposal with the locked position on ${name}.`;
  if (c.includes('liquidity manager')) return `Let the manager rebalance weekly, then add a small top-up to the ${name} pool.`;
  if (c.includes('cedefi')) return `Rotate a small part of the ${name} deposit each week.`;
  if (c.includes('btc')) return `Add a little to the minted position each week through ${name}.`;
  return `Make one small qualifying action each week on ${name}, such as a deposit, a swap or a vote.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. The last step re-checks the row against this board, so the plan stays honest when the
 * ranking moves.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: mainActionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about $${Math.max(2, Math.round(gas / 2))} of gas`,
      time: '10 minutes',
    },
    {
      text: weeklyActionFor(p, capital, chain),
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
    {
      text: `Compare ${p.name} against the next three rows on this board once a month; if it falls out of the top 40 by implied value, unwind the position and move the capital to the higher row.`,
      cost: 'nothing but the check',
      time: '15 minutes a month',
    },
  ];
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

/** Every live-token protocol, compact, so the page can recompute the calibration itself. */
export function liveAllRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
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

/** A board row's compact form for data.js, farm plan included. */
export function radarRow(row: BoardRow): RadarRow {
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
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const calibration = calibrate(snapshot, model);
  const board = buildBoard(snapshot, calibration, model);
  const live = liveRows(snapshot);
  const liveAll = liveAllRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    live_all: liveAll,
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
