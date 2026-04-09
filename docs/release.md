# Release Readiness

This document describes packaging, release automation, and documentation expectations for the minicode CLI agent.

## Release checklist

1. Run `npm run check`.
   - Ensures lint, tests, and build pass before publishing.
2. Verify `dist/index.js` is generated correctly.
3. Confirm the CLI entrypoint works via `npm start` or `node dist/index.js`.
4. Ensure `README.md` reflects the latest command surface and release usage.
5. Confirm recorded run storage is accessible in `.minicode/runstore.sqlite`.

## Packaging

The package is configured to publish the built CLI under the `agent` bin entrypoint.

- `main`: `dist/index.js`
- `bin.agent`: `dist/index.js`
- `type`: `commonjs`

### Recommended packaging flow

```bash
npm install
npm run check
npm run release
```

## Release automation

The `release` script performs the following steps:

- runs `npm run check`
- bumps the package version with `npm version patch`

Add repo-specific release automation later if you want signed tags, changelog generation, or GitHub Actions publishing.

## Documentation readiness

Ensure these documents are kept up to date:

- `README.md` — user-facing setup, usage, and status
- `docs/specification.md` — architecture and acceptance criteria
- `docs/implementation-plan.md` — phased roadmap and progress tracking
- `docs/release.md` — packaging and release guidance

## Troubleshooting

- If `npm publish` fails because the package version is already published, bump the version manually or use `npm version prerelease`.
- If `dist` is missing, run `npm run build` before publishing.
- If tests fail, open the failing test and verify the command flow from `src/cli.ts`.
