# Contributing

Thanks for your interest! The simulator is complete at version 1.0.0: it was built in six steps, each one a tagged release (see the [build log](README.md#build-log)). Fixes, clearer explanations and better tests are welcome.

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
