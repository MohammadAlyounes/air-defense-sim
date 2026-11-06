# Contributing

Thanks for your interest! This project is being built in public, one step at a time (see the [roadmap](README.md#roadmap)).

## Run it

```bash
npm install
npm run dev
```

## Before you open a pull request

```bash
npm run check      # lint, type-check, unit tests and format check
npm run test:e2e   # browser tests
```

## Guidelines

- **Keep `src/sim` pure.** No UI imports, browser APIs, `Math.random()` or wall-clock time. The linter enforces this.
- **Explain the physics.** New models come with a concept card (see [docs/concepts](docs/concepts/README.md)) and unit tests against known values.
- **Stay generic and safe.** Fictional equipment, round-number parameters, procedural terrain. Read [SAFETY.md](SAFETY.md); contributions that break these rules will not be merged.
- **Small, focused commits** written in the imperative mood.
