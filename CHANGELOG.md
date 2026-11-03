# Changelog

Every release of `rehearsal-kit` has a section here. The package build workflow warns when the version has no
section, so write it before building. CI builds and checks the packages but never uploads them.

## 0.1.4

- Test any agent by its URL: an agent profile can name your own agent's OpenAI-compatible endpoint instead of a model
  (`rehearsal profiles create --endpoint URL [--endpoint-model NAME] [--endpoint-key-env VAR]`, the console's "My own
  agent runs at a URL" option, and `endpoint_url` / `endpoint_model` on the MCP `create_agent` tool). Each turn sends
  the conversation and the offered tools to that endpoint, and Rehearsal pays nothing for those calls. The key is
  stored sealed, and private or internal addresses are refused unless the server sets
  `REHEARSAL_ALLOW_PRIVATE_AGENT_URLS`.
- Incidents become tests: describe something an agent got wrong in production and Rehearsal writes a validated job
  that puts an agent in the same spot, then adds it to the world's dev split (`rehearsal worlds incident WV_ID --file
  incident.txt`, `rh.worlds.report_incident` / `rh.worlds.reportIncident`, `POST /v1/world-versions/{id}/incidents`,
  and an Incidents tab on the world page).
- Ready-made worlds: a server can share one project's published worlds with every workspace
  (`REHEARSAL_LIBRARY_PROJECT`), listed by `rehearsal worlds library`, `rh.worlds.library` and `GET /v1/library`, and
  shown on the Applications page.
- Builds that do not burn money: tools are checked one at a time, a step that keeps getting the same rejection pauses
  itself, and the build page shows what each step cost and why a build is stuck. A worker that is stopped mid-build
  hands the job back, and the build resumes from its checkpoint without losing an attempt.
- Tavily now also helps while a build runs: setup notes from the application's own docs before the runtime is
  planned, docs search for the builder and the seeder, and a web lookup for an application error that keeps coming
  back. Rehearsal's own validation messages are never searched.
- Builds survive more real applications: a build goes back to the runtime when the app does not serve its own API or
  a one-shot command started a server, back to seeding when tool examples find no records, seed steps can post forms
  and run queries, and a setup step must name one of the world's services. Built-in tools listed in `contact_tools`
  are dropped instead of rejected.
- Customer replies are checkable: what the agent sends the customer becomes a row of the effects journal (provider
  `customer`, operation `reply`), so a job's checks can read it. When no job passes validation, the build writes the
  jobs again once from the same plan, with a fresh round for the money guard.
- A provider without a key no longer makes a model chain wait out another provider's rate limit.
- CI no longer uploads packages: the publish workflow lost its PyPI and npm upload jobs and its release trigger. A
  manual run builds and checks both packages, and keeps the files as workflow artifacts.
- The library names no model vendor and no default model. A project chooses each role's chain in the
  `REHEARSAL_MODEL_*` settings (a role left empty uses the compiler's chain), adds providers beyond the built-in ones
  in `REHEARSAL_PROVIDERS` (address, the setting that holds the key, and an optional `tool_choice`), and prices them
  in `pricing.yaml`. Provider `baseten` is added; `nebius` and `nvidia` are removed.
- This repository's `.env.example` runs every role on Meta's Muse models through the Meta Model API
  (`MODEL_API_KEY`): Muse Wonder 1.0 for the hardest compiler roles and the fix loop, Muse Spark 1.3 for tool work and
  for the agent under test (one model per run), and Muse Spark's Contributor tier for the simulated customer, with
  Standard behind it. `pricing.yaml` holds the Meta Model API prices.
- A chain entry ends in `#minimal`, `#low`, `#medium`, `#high`, `#xhigh` or `#max`, sent as `reasoning_effort`.
  `#think` and `#nothink` are removed.
- The Agent Factory's `agent.py` runs on the server's agent model, at that model's own API address (`MODEL_API_KEY`).
- `rehearsal train` says that fine-tuning is not built yet; `--base-model` has no default.
- The clients and the CI action default to the server on this machine, `http://localhost:7800`.
- In a clone, the server serves the console from `web/out`; `pnpm --dir web package` bundles it into the Python
  package for a release.
- `scripts/setup.sh` and `scripts/run-world.sh` set up Rehearsal on one machine and build a world;
  `scripts/install-muse-code.sh` adds the Rehearsal plugin to Muse Code, from the bundle in
  `agent-plugin/providers/muse-code/`.
- Seven more applications in the catalog.
- Docker and git output is read as UTF-8, and the CLI no longer stops on a character the Windows code page cannot
  print.

## 0.1.3

- `rehearsal-kit` is now also an npm package: the TypeScript SDK, the `rehearsal` CLI and the MCP server, with the
  same commands, tools and saved sign-in as the Python ones (`npm install rehearsal-kit`). Both packages are released
  together under one version; the server stays Python.
- Fix-my-agent loop (`rehearsal autofix`, `rh.profiles.autofix`, the MCP `fix_agent` tool): each round proposes a new
  agent version from failed train and dev episodes, rehearses it, and keeps it only if it verifies more episodes
  without a larger share of rule violations or false completions; the best version is then proven against the
  original on held-out jobs.
- Agent Factory (`rehearsal factory`, `rh.worlds.make_agent`): drafts an agent for a published world, hardens it with
  the fix loop, proves it on held-out jobs and packages a runnable agent with a proof report.
- CI checks: `rehearsal gate` passes or fails an agent change next to a baseline, and the GitHub Action
  (`uses: MitudruDutta/rehearsal@main`) runs it on pull requests.
- Why episodes failed: named causes per agent, most common first (`rehearsal runs failures`, `rh.runs.failures`,
  `GET /v1/runs/{id}/failures`), on the run page, in the MCP results and in the gate's report.
- Web research (`TAVILY_API_KEY`): a build studies how real people use the application and bases its jobs on what it
  finds, citing the pages. Without a key, or when the research cannot finish, jobs are planned from the source alone.
- Every role runs on NVIDIA Nemotron through Nebius Token Factory by default, routed by role
  (`REHEARSAL_MODEL_REASONER` is new); a chain entry can end in `#think` or `#nothink`. Builds, runs and fix loops
  show model usage by role.
- Builds survive more real applications: bounded API descriptions and source reads, a repair loop that keeps the
  runtime that got furthest across restarts, host-check refusals repaired with the real host names, and long JSON
  from a model repaired when an object in a list is left without its closing `}`.
- The `telemetry` extra and third-party tracing are removed; secrets are masked in one place.
- In the repository, the Python package moved to `rehearsal/py` and the npm package is in `rehearsal/ts`. From a
  checkout, install with `pip install -e './rehearsal/py[server,dev]'`.

## 0.1.2

- `rehearsal login` signs in through the browser: the terminal shows a code, you approve it in the console, and the
  terminal receives a "Build and evaluate" key. The key is created when the terminal collects it and is never stored
  readable. `--with-key` still pastes a key, for servers and CI.
- `rehearsal whoami` shows the server, workspace, key and where the sign-in comes from.
- `rehearsal --help` groups commands by task and describes every one; a mistyped command suggests the closest one.

## 0.1.1

- `rehearsal login` saves the server URL and an API key (readable by your user only); the CLI, the Python SDK and
  the MCP server use it when `REHEARSAL_API_KEY` and `REHEARSAL_URL` are not set. `rehearsal logout` removes it.
- The MCP server starts without a key and tells the assistant to ask for `rehearsal login`, instead of failing to
  connect.
- Agent plugin (`agent-plugin/`) for Claude Code, Codex, Cursor, Antigravity CLI and other agents: the Rehearsal skill plus the MCP
  server, started with `uvx` from PyPI.
- A write key can list what it changes; held-out jobs and verdicts still need the evaluator scope, which the
  console's "Build and evaluate" keys now carry.
- Database pool size is configurable (`REHEARSAL_DB_POOL_SIZE`, `REHEARSAL_DB_MAX_OVERFLOW`), for managed
  databases with a connection limit.
- Releases run the full test suite against PostgreSQL, refuse a version that is not higher than PyPI's, and start
  the built MCP server before uploading.

## 0.1.0

- First release: SDK, CLI, MCP server and agent skill; the server (`rehearsal-kit[server]`) with the World Compiler,
  workers, console, plans and Dodo Payments billing.
