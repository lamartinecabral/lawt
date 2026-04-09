# OpenAI-Protocol Compatible Provider Integration Plan

## Objective

Replace the current stub provider with a production-ready provider integration compatible with the OpenAI Chat Completions API (supporting OpenAI, Ollama, LocalAI, etc.). This is configured primarily through environment variables with required `baseURL` and `apiKey` values.

Status note: this document captures the integration plan and baseline assumptions used during implementation.

## Baseline at Plan Time

- `src/provider.ts` exports `localProviderAdapter`, which returns a hardcoded response.
- `src/cli.ts` always selects the stub adapter via `const provider = localProviderAdapter`.
- `src/config.ts` and `src/schemas.ts` do not yet model provider credentials or endpoint configuration.
- The repository does not currently describe `.env` provider setup in user-facing docs.

## Target State

1. The CLI uses an OpenAI-compatible provider adapter for `run`, `plan`, and `chat` flows.
2. Provider settings are loaded from environment variables, including `.env` files.
3. `baseURL` and `apiKey` are required and validated when model-backed commands run.
4. Secrets are never logged or persisted in plaintext.
5. Existing command behavior and JSON/text output formats remain stable.
6. Reasoning effort can be configured via environment variable.

## Environment Variable Contract

Required:

- `OPENAI_BASE_URL`
  - Example: `https://api.openai.com` or `https://api.openai.com/v1`
  - Must be a valid absolute URL.
- `OPENAI_API_KEY`
  - Example: `sk-...`

Recommended optional:

- `OPENAI_MODEL`
  - Example: `gpt-4o-mini`
  - Default proposal: `gpt-4o-mini`.
- `OPENAI_TIMEOUT_MS`
  - Example: `60000`
  - Default proposal: `60000`.
- `OPENAI_REQUESTS_PER_MINUTE`
  - Example: `15`
  - Default proposal: `15`.
- `OPENAI_REASONING_EFFORT`
  - Example: `medium`
  - Allowed values: `default`, `none`, `low`, `medium`, `high`.
  - Default proposal: `medium`.

### `.env` Example

```dotenv
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=60000
OPENAI_REQUESTS_PER_MINUTE=15
OPENAI_REASONING_EFFORT=medium
```

## Design Decisions

- Use `dotenv` to load `.env` early in startup.
- Keep the `ProviderAdapter` contract from `src/types.ts` unchanged.
- Implement the OpenAI-compatible adapter against the Chat Completions API shape to support standard OpenAI-compatible backends.
- Map adapter output to existing `ModelResponse` (`text`, optional `metadata`) so orchestrator and CLI behavior remain unchanged.

## Implementation Plan

### Phase 1: Configuration and Validation

Scope:

- Add `dotenv` dependency.
- Load environment variables before config resolution.
- Extend config schema to include provider runtime settings.
- Validate required values (`OPENAI_BASE_URL`, `OPENAI_API_KEY`).

Files:

- `package.json`
  - Add `dotenv` (and optionally `openai` SDK if chosen).
- `src/config.ts`
  - Load `.env` and map env vars into runtime config.
  - Enforce clear startup errors when required env vars are missing.
- `src/schemas.ts`
  - Add provider config validation schema (`baseUrl`, `apiKey`, optional model/timeout/requestsPerMinute/reasoningEffort).
- `src/types.ts`
  - Add provider configuration fields to `CliConfig` (or nested provider config object).

Exit criteria:

- Running any command without required env vars fails fast with actionable error messages.
- Running with valid env vars resolves a typed provider config.

### Phase 2: Provider Adapter Implementation

Scope:

- Replace or supplement `localProviderAdapter` with an OpenAI-compatible adapter.
- Implement request execution using either:
  - Official `openai` SDK configured with `baseURL` and `apiKey`, or
  - Built-in `fetch` with explicit HTTP request/response handling.

Behavior:

- Input mapping:
  - `ModelRequest.prompt` becomes user content in chat completion request.
  - `RunContext` metadata can be included in system/user messages as needed.
  - If configured, `OPENAI_REASONING_EFFORT` is passed through to the provider request when supported by the selected model/backend.
- Output mapping:
  - First assistant message text maps to `ModelResponse.text`.
  - Raw metadata (model, usage, finish reason) maps to `ModelResponse.metadata`.
- Error handling:
  - Normalize network and API errors into concise, user-safe error messages.
  - Never include `OPENAI_API_KEY` in thrown/logged messages.

Files:

- `src/provider.ts` (or split into `src/provider/openai-compatible.ts` plus an index module).

Exit criteria:

- `provider.execute(...)` performs a real API call and returns structured `ModelResponse`.
- Failure modes are deterministic and redact credentials.

### Phase 3: CLI Wiring and Adapter Selection

Scope:

- Update CLI runtime to choose the new provider adapter instead of the stub.
- Keep command flow behavior unchanged for `run`, `plan`, and `chat`.

Files:

- `src/cli.ts`
  - Replace hardcoded `localProviderAdapter` selection.
  - Pass validated provider config into adapter creation.

Exit criteria:

- `agent run`, `agent plan`, and `agent chat` invoke the OpenAI-compatible provider.
- No changes required to command signatures for MVP.

### Phase 4: Security, Logging, and Persistence Hardening

Scope:

- Redact sensitive env-derived values in logs.
- Ensure run artifacts and persisted metadata do not store raw API keys.

Files:

- `src/logger.ts`
  - Add or verify key redaction behavior for `apiKey`-like fields.
- `src/memory.ts`
  - Verify persistence excludes secret material.

Exit criteria:

- Logs and persisted run artifacts remain secret-safe under failure and success paths.

### Phase 5: Test Coverage

Scope:

- Add/extend tests for config parsing, provider behavior, and CLI integration.

Tests to add:

- Unit:
  - `src/config.ts` env resolution and validation behavior.
  - reasoning effort env validation (`default|none|low|medium|high`) and defaulting behavior.
  - provider response mapping and error mapping.
- Integration:
  - command execution path with mocked provider transport.
  - provider request includes reasoning effort when configured.
  - startup failure when required env vars are absent.

Files:

- `tests/cli.test.ts`
- `tests/integration.test.ts`
- new provider/config-specific test files as needed.

Exit criteria:

- Existing tests continue to pass.
- New tests validate env-driven config and adapter behavior.

### Phase 6: Documentation and Developer Experience

Scope:

- Document `.env` setup and provider behavior.
- Add `.env.example` to make onboarding deterministic.

Files:

- `README.md`
  - Add provider setup section and command examples.
- `.env.example`
  - Include `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and optional vars, including `OPENAI_REASONING_EFFORT`.
- `docs/release.md`
  - Add release checklist item for secret-safe logging verification.

Exit criteria:

- New contributors can configure and run provider integration without code changes.

## Rollout Strategy

1. Implement behind a temporary fallback path to stub provider during development.
2. Run full check suite (`npm run check`) with provider integration tests.
3. Remove fallback to stub provider once OpenAI-compatible adapter is validated.

## Risks and Mitigations

- Risk: OpenAI-compatible backends vary slightly in response payloads.
  - Mitigation: tolerate minor response-shape differences and fail with clear parse errors.
- Risk: Secrets leaked in logs during exception paths.
  - Mitigation: enforce redaction in logger and add regression tests for secret masking.
- Risk: Network instability leads to brittle user experience.
  - Mitigation: add timeout config, classify retryable failures, and report actionable messages.

## Acceptance Checklist

- [ ] Stub provider is no longer used in normal command flow.
- [ ] Provider config is loaded from `.env` and environment variables.
- [ ] `OPENAI_BASE_URL` and `OPENAI_API_KEY` are required and validated.
- [ ] `agent run`, `agent plan`, and `agent chat` use the integrated provider.
- [ ] Reasoning effort can be configured using `OPENAI_REASONING_EFFORT`.
- [ ] API keys are redacted from logs and not persisted in artifacts.
- [ ] Tests cover success and failure scenarios for config and provider calls.
- [ ] README includes setup instructions and a working `.env` example.
