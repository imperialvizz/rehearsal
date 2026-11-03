# Run Rehearsal on your machine

This page takes you from a fresh clone to a running Rehearsal: the console and the docs open in your browser, a
practice world built from an application you pick, and a starter agent evaluated on it. Two scripts do the work.

## Quick reference

| What | Where |
|---|---|
| Console (sign in here) | http://localhost:7800 |
| Docs site | http://localhost:7801, after `cd docs && pnpm dev` (see [Open the docs site](#open-the-docs-site)). The console's **Docs** link and http://localhost:7800/docs go there |
| API reference | http://localhost:7800/api/docs |
| Settings and model keys | `.env` in the repository folder (git ignores it) |
| This machine's CLI sign-in | `~/.config/rehearsal/config.json`, written by `scripts/setup.sh` |
| Database | PostgreSQL in Docker on 127.0.0.1:5433; its address is `REHEARSAL_DATABASE_URL` in `.env` |
| Application sources and world files | `var/` |
| What is happening right now | the terminals running `rehearsal serve` and `rehearsal worker` |

| Step | Command | Time |
|---|---|---|
| 1. Get the code | `git clone https://github.com/imperialvizz/rehearsal.git` | 1 minute |
| 2. Set up | `bash scripts/setup.sh you@example.com` | 5 to 10 minutes, once |
| 3. Add your model key | edit `.env` | 1 minute |
| 4. Start Rehearsal | `rehearsal serve` and `rehearsal worker` | seconds |
| 5. Open the docs | `cd docs && pnpm install && pnpm dev` | 2 minutes, once |
| 6. Build a world and evaluate an agent | `bash scripts/run-world.sh vikunja` | 1 to 3 hours for the first build |

## What you need

| What | Why | Check |
|---|---|---|
| Docker, running | the local database and the sandboxes that worlds run in | `docker info` |
| Python 3.11, 3.12 or 3.13 | the server, the worker and the CLI | `python3 --version` |
| Node 22 or newer, and pnpm | builds the console once, and runs the docs site | `node --version`, `pnpm --version` (install: `npm install -g pnpm`) |
| git | gets the code and the applications that worlds are built from | `git --version` |
| A Meta Model API key | every model role runs on Meta's Muse models by default | get one at [dev.meta.ai](https://dev.meta.ai) |
| Free memory | each sandbox uses 0.3 to 1.5 GB; one build and one run at once can use up to 8 sandboxes | on a small machine, set `REHEARSAL_BUILD_PARALLEL=1` and `REHEARSAL_RUN_PARALLEL=1` in `.env` |

`MODEL_API_KEY` is the only model key: every role runs on Meta's Muse models. Optional, also in `.env`:
`TAVILY_API_KEY` (researches how people use an application, and looks up its error messages, while a world builds).

**Operating system.** Linux and macOS work as below. On Windows, the tested way is **WSL 2**: install Ubuntu from
the Microsoft Store, install Docker in it (or turn on Docker Desktop's WSL integration), and run every command in the
Ubuntu terminal. Git Bash on Windows also runs the setup, the server, the worker and the console; see
[On Windows](#on-windows).

Use a machine that does not run other important containers: the worker starts and stops containers with your
Docker.

## 1. Get the code

```bash
git clone https://github.com/imperialvizz/rehearsal.git
cd rehearsal
```

## 2. Set up

```bash
bash scripts/setup.sh you@example.com
```

Use your own email: it becomes your console login, and the script asks you for a password of 10 or more characters.
The script:

1. checks for Python and a running Docker;
2. creates a Python environment in `.venv` and installs Rehearsal into it;
3. creates `.env` from `.env.example`, with a new random session secret;
4. builds the console once (`web/`, with pnpm);
5. starts PostgreSQL in Docker on 127.0.0.1:5433 and creates its tables (`rehearsal up`);
6. creates your workspace and an admin API key, and saves the key for this machine in
   `~/.config/rehearsal/config.json`. The key is never printed;
7. creates your console login.

You can run it again at any time: each step is skipped when it is already done. Without the email, it does
everything except step 7. To add another login later, or to change a password:

```bash
.venv/bin/rehearsal users add someone@example.com --project PROJECT_ID
```

`PROJECT_ID` is the `Workspace project` line the script prints.

## 3. Add your model key

Open `.env` in an editor and set:

```bash
MODEL_API_KEY=your-meta-model-api-key
```

`.env` stays on your machine: git ignores it. Never put a key in any other file of the repository.

## 4. Start Rehearsal

Open two terminals in the repository folder. In each, turn on the Python environment first:

```bash
source .venv/bin/activate
```

On Git Bash for Windows, the folder is `.venv/Scripts` instead of `.venv/bin`.

In the first terminal, start the API and the console:

```bash
rehearsal serve
```

In the second terminal, start a worker. Nothing is built or evaluated while no worker runs:

```bash
rehearsal worker
```

Open http://localhost:7800 and sign in with the email and password from step 2. To check the terminal side, run
`rehearsal whoami` in a third terminal.

## 5. Open the docs site

The documentation is a site in `docs/`. Run it next to the console, in its own terminal:

```bash
cd docs
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:7801. The first page you open takes a few seconds to compile; the rest are quick. The
console's **Docs** link and http://localhost:7800/docs send you there, because `.env` has
`REHEARSAL_DOCS_URL=http://localhost:7801`. Without the docs site running, set `REHEARSAL_DOCS_URL=` (empty) and
`/docs` opens the API reference instead. `pnpm dev -p 3002` runs the site on another port; then change
`REHEARSAL_DOCS_URL` to match and restart `rehearsal serve`.

The **Ask AI** box in the docs answers from the pages, using the same `MODEL_API_KEY`.

## 6. Build a world and evaluate an agent

Pick an application from the table, then, in a third terminal:

```bash
bash scripts/run-world.sh vikunja
```

| Name | What it is | Containers | Notes |
|---|---|---|---|
| `vikunja` | Task and project management | 1 | The lightest; the script's default |
| `gitea` | Code hosting and issue tracking | 1 | |
| `kanboard` | Kanban boards and team tasks | 1 | SQLite inside the container |
| `memos` | Notes and knowledge sharing | 1 | SQLite inside the container |
| `mealie` | Recipes and meal planning | 1 | SQLite inside the container |
| `redmine` | Project management and issue tracking | 1 | SQLite inside the container |
| `listmonk` | Newsletters and mailing lists | 2 | With PostgreSQL |
| `espocrm` | CRM: leads, contacts, opportunities | 2 | With MariaDB |
| `snipe-it` | IT asset management | 2 | With MariaDB |
| `mattermost` | Team chat | 2 | With PostgreSQL |
| `odoo` | ERP and CRM: sales, invoicing | 2 | With PostgreSQL |
| `easyappointments` | Appointment booking | 2 | Held out: kept for measuring the compiler on an application it was not tuned on |
| `chatwoot` | Customer support desk | 3 | With PostgreSQL and Redis |
| `wordpress` | Websites and content | 3 | With MariaDB and WP-CLI |
| `saleor` | Online commerce | 3 | With PostgreSQL and Redis; the heaviest |

`redmine`, `kanboard`, `memos`, `mealie`, `listmonk`, `espocrm` and `snipe-it` joined the catalog on 3 November
2026; no world has been built from them yet. Every application is pinned to one source commit and one image
digest, in `rehearsal/py/rehearsal/assets/catalog.yaml`. They all appear on the console's **Applications** page.

The script loads the catalog, asks before it spends anything, then:

1. builds a practice world from the application: 1 to 3 hours, and it spends model budget on your key. Muse Wonder
   writes the hardest parts and Muse Spark the rest. Follow it on the console's **Applications** page, or in this
   terminal;
2. creates a starter agent profile;
3. evaluates the agent on the world's dev jobs and prints the score.

A world that is already built is reused, so a second run goes straight to the evaluation.

The same steps by hand:

```bash
rehearsal apps import-catalog
rehearsal apps list
rehearsal build APP_ID --watch
rehearsal worlds list
rehearsal profiles create support-agent
rehearsal eval WV_ID --profile PROFILE_ID --split dev --watch
rehearsal runs episode EPISODE_ID
```

`APP_ID`, `WV_ID`, `PROFILE_ID` and `EPISODE_ID` are the ids the commands before print. Next, let Rehearsal write and
prove an agent for the world (`rehearsal factory WV_ID --name support-agent --watch`), or fix yours in rounds
(`rehearsal autofix PROFILE_ID RUN_ID --rounds 3 --watch`).

## Stop and start again

- **Stop:** press Ctrl+C in the `serve`, `worker` and docs terminals. The database keeps running in Docker; stop it
  with `docker stop rehearsal-postgres-1`.
- **Start again** (also after a restart of your computer): start Docker, then run `bash scripts/setup.sh` (it starts
  the database and skips everything else), then steps 4 and 5.
- **Start from zero:** this deletes every world, run and account. Run
  `docker rm -f rehearsal-postgres-1 && docker volume rm rehearsal_rehearsal-pg`, delete the `var` folder, then run
  step 2 again.

## On Windows

- **Long paths.** World builds fetch deep source trees, and Windows stops at 260 characters. Either run
  `git config --global core.longpaths true` once, or turn long paths on for the worker only:

  ```bash
  GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.longpaths GIT_CONFIG_VALUE_0=true rehearsal worker
  ```

- **Console build.** `scripts/setup.sh` builds the console with `rm` and `cp`, so run it from Git Bash or WSL, not
  PowerShell or cmd.
- **Port 3000.** Many tools take port 3000; the docs site uses 7801 so it does not collide with them.

## Use it from Muse Code

Muse Code is Meta's coding agent. After the setup above, add the Rehearsal plugin to it:

```bash
bash scripts/install-muse-code.sh
```

It installs the Rehearsal skill and adds this clone's MCP server to `~/.config/muse/settings.json`, using your saved
sign-in. Start a new session and ask: "Show my Rehearsal workspace status." The steps by hand: http://localhost:7801/ai-assistants/muse-code.
Claude Code, Codex and other assistants: see [agent-plugin/README.md](agent-plugin/README.md).

## When something goes wrong

| You see | Fix |
|---|---|
| `Docker is installed but not running` | Start Docker Desktop, or `sudo service docker start` in WSL, and run the script again. |
| `install Python 3.11, 3.12 or 3.13` | Install one of those versions: Rehearsal is tested on them. |
| `'rm' is not recognized` while the console builds | You are in PowerShell or cmd. Run the script from Git Bash or WSL. |
| `no server at http://localhost:7800` | Start `rehearsal serve` and `rehearsal worker` (step 4). |
| `put MODEL_API_KEY ... in .env` | Add your key (step 3), then restart `rehearsal worker` so it reads it. |
| A build that stays queued | No worker runs. Start `rehearsal worker`. |
| `Filename too long` during a build | Turn on long paths ([On Windows](#on-windows)), or run Rehearsal inside WSL 2. |
| The console's **Docs** link does not load | The docs site is not running. Start it (step 5). |
| `Another next dev server is already running` | A docs site is already running from this folder; open the address it prints, or stop it first. |
| Sign-in errors after you deleted the database | Run `bash scripts/setup.sh you@example.com` again: it makes a new workspace and key. |
| The containers stop by themselves in WSL | WSL stops when no terminal is open in it. Keep one Ubuntu terminal open. |

More fixes: http://localhost:7801/self-hosting/troubleshooting, or
[docs/content/self-hosting/troubleshooting.mdx](docs/content/self-hosting/troubleshooting.mdx).
Every setting in `.env`: http://localhost:7801/reference/configuration.
