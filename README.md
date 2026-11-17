# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Crisyehetharia/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Crisyehetharia/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: **40 watchlist protocols, ranked by implied value** — plus an
early radar of every pre-token protocol below the watchlist floor, and the live-token protocols
set aside with their market caps shown.

Entry for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on make.fun.

## What it does

`main.ts` (Node 22, standard library only) reads the sealed snapshot at
`/input/snapshot.json` and writes to `/output`:

- `board.json` — the ranked board: **226 rows**, every one of the 40 watchlist slugs
  covered, plus 186 early pre-token protocols below the $50M floor.
- `data.js` — the dashboard's whole dataset, so the page needs no network.
- `dashboard/` — a static page: sortable, filterable board, per-protocol detail view
  (model inputs + farm plan), and the calibration table the model computed.
- `screenshots/` — the board, a detail view, and a filtered view.
- `dossier.json` — written last with the vendored `buildDossier` library.

The program is deterministic: same snapshot in, same bytes out, every run. No network,
no clock, no randomness.

## The model ("radar-2")

```
implied = round( tvl_usd × multiple(category)
                 × (1 + clamp(change_7d, -60, 120) / 100 × 0.5)
                 × (0.6 + min(age_days, 1095) / 1095 × 0.4) )
```

- **multiple(category)** — the median market-cap-per-TVL of the live-token protocols in
  the same category, read from this snapshot (a category with fewer than 3 live
  protocols uses the overall median of ×0.241); clamped to ×0.05–×1.00.
- **growth** — the protocol's seven-day TVL change, clamped to −60…+120%.
- **maturity** — how long it has run with no token (age since first listing, unknown
  age = 365 days), from ×0.6 for a new protocol to ×1.0 after three years.
- **Early radar** — every rankable pre-token protocol below the watchlist floor
  (wrapped/staked products and CEXes excluded).
- **Live-token protocols** are set aside with their market caps shown — they are facts,
  not a model.

Every row carries a **7-step farm plan** (fresh wallet, main action for its category,
second action, weekly action, hold period, safe claim, farm log), each step with a cost
and a time. The dashboard recomputes each row's implied value from the snapshot figures,
so the page's code and the board's data are visibly the same arithmetic.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Then open `out/dashboard/index.html` (it reads `out/data.js`).

## Verify

```sh
# determinism: two runs, same bytes
mkdir -p out1 out2
MAKEFUN_OUTPUT_DIR=out1 node main.ts --input <kit>/input/snapshot.json
MAKEFUN_OUTPUT_DIR=out2 node main.ts --input <kit>/input/snapshot.json
diff -r out1 out2
```

## License

MIT. See [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=kefgqpce&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
