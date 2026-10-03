# Subject Core · Living Cycle

*English summary. The full, authoritative documentation is in Russian: [README.md](README.md).*

A strategy browser game about bringing an intention into form, built on the Architectonics of the GDEYA project and the logic of Tensor Architectonics (TzAr). The repository also hosts **Platform 2.0** — the single entry point to the whole ecosystem.

## Products

| Product | Status | Open |
|---|---|---|
| Platform 2.0 — registry of 22 ecosystem entities and their links | stable | https://lacinnik.github.io/Game-GDEYA/platform/ |
| Subject Core · Living Cycle — the game | not stated | https://lacinnik.github.io/Game-GDEYA/ |
| MODULE 1.0 — executable `49 Az × 24 Buki × 7 Transmissions` contour | stable | https://lacinnik.github.io/Game-GDEYA/labs/module/ |
| VoidOCR 1.0 — local four-step distinction protocol with JSON export | stable | https://lacinnik.github.io/Game-GDEYA/labs/voidocr/ |
| Meta Core · integration 0.1 — local evidence hand-off from VoidOCR | candidate | https://lacinnik.github.io/Game-GDEYA/labs/meta-core/ |
| SEP-7×7 0.1 — 7 core-preservation laws × 7 life contexts | not stated | https://lacinnik.github.io/Game-GDEYA/labs/core-separation/ |

Machine-readable statuses: [`ecosystem.status.json`](ecosystem.status.json).

## The game

The player carries a living intention through four plates — **Resource → Power → Relations → Result** — without giving the core away to the field gradient. Each turn has four beats: observation, configuration (geometry and point type), formula (`Az × Buka → Transmission`) and field response.

- 96 cards: 4 plates × 6 processes × 4 phases; a quick 4-node cycle and a full 24-node canonical cycle.
- 5 geometries, 4 point types, 49 Az, 24 Buki and 7 Transmissions.
- Metrics `α`, `IY`, `Cₘ`, `Q`, `T`; scores are simulated, while `Q` stays unobserved.
- Skellu voice guide (speech output and dictation), touch-first layout for iPhone, JSON export of completed nodes.

## Development

Requires Node.js 22.13+.

```bash
npm ci
npm run dev       # local dev server
npm test          # automated checks
npm run lint
npm run build     # static site in dist-public/, deployed to GitHub Pages
```

Files copied from sibling repositories are pinned in `vendor.lock.json`; see `npm run vendor:check`, `vendor:drift` and `vendor:update`.

## Ecosystem

Related repositories: [architectonica-az-buki](https://github.com/Lacinnik/architectonica-az-buki) (source corpus and cores), [-tensor-architectonics](https://github.com/Lacinnik/-tensor-architectonics) (TzAr scientific canon), [reason-](https://github.com/Lacinnik/reason-) (REZON lab).

## License

[MIT](LICENSE).
