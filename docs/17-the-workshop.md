# The Workshop — three engines on one bench

*Manager M-000027 · `lab-hub-manager/engines.js`*

## Why

The house pays for three coding subscriptions — Claude, ChatGPT (Codex) and
Gemini — and the server was only using one of them. All three ship a headless
CLI, so all three can work on `lab-main-01` directly instead of being things
Tao types into on a laptop.

The second reason matters more. Two days of autonomous building produced a
library of thirty orange themes. That is what one model in a loop does: it
converges on its own taste and then polishes it forever. Three different model
families disagree with each other, and disagreement is the cheapest quality
control available. `review()` exists specifically to exploit that.

## The engines

| Engine | Vendor | Binary | Used for |
|---|---|---|---|
| Claude | Anthropic | `/home/tao/.local/bin/claude` | architecture, long reasoning, writing |
| Codex | OpenAI | `/usr/bin/codex` | precise edits, refactors, tests |
| Gemini | Google | `/usr/bin/gemini` | very large context, cross-file sweeps |

Roles route to engines with fallback, so nothing breaks when one is signed out:

```
architect → claude, gemini, codex      coder    → codex, claude, gemini
reviewer  → gemini, codex, claude      sweeper  → gemini, claude, codex
```

## The three ways to ask

- **`ask`** — one engine, one answer. Routed by role unless you name one.
- **`panel`** — every signed-in engine answers the same question. Use it when
  you want to see the spread, not a consensus.
- **`review`** — one engine drafts, the others critique, the author revises
  with the critique in hand. Slowest and by far the best output.

## The guardrails

These are in code, not convention. A rule a caller has to remember is a rule
that gets forgotten at 2am.

**The data boundary.** These engines are third-party services. Code leaves the
house; the household does not. Eight named patterns are refused *before*
dispatch — alarm and gate codes, passwords, API keys, SA ID numbers, card
numbers, SA phone numbers, rand amounts, and any mention of the house registry
tables. The refusal names the rule it tripped, because a silent "no" teaches
nobody anything:

```
refused: the prompt contains what looks like a South African phone number.
Engines are third-party services — house data does not leave the LAN.
Describe the shape of the data instead of the data itself.
```

This is the one design decision worth defending. The house registry is the most
sensitive thing we hold, and the whole point of self-hosting is that it stays
on the LAN. An engine with a helpful-sounding reason to see the bills is still
an upload to someone else's servers.

**The sandbox.** Engines write only inside `/srv/lab/workspace/lab-platform`, a
clone of the repo. The live manager at `/srv/lab/manager` is not a scratch pad.
Read-only is the default posture; `workspace-write` is the most any job gets.
We never pass `--yolo`, `--dangerously-bypass-approvals-and-sandbox`, or any
equivalent — those flags exist for externally sandboxed CI, not a family server.

**Reachability.** `/api/engines` is on the SENSITIVE list, so it is LAN-only and
returns 403 through the tunnel without an admin key. These endpoints spawn real
coding agents on the box; they do not belong on the open internet.

**The record.** Every dispatch writes an `engine.ask` audit row — engine, role,
duration, outcome, brief, and whether it had write access.

**Concurrency.** Two jobs at a time. The G50 is a laptop with 8GB of RAM.

## Signing in

Both new CLIs need a human to authenticate once. Claude is already signed in.

**Codex** supports device-code auth, so no tunnel is needed:

```bash
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115 'codex login --device-auth'
```

It prints a URL and a one-time code that expires in 15 minutes. Open the URL on
any device, enter the code, done. The session writes `~/.codex/auth.json` and
survives reboots.

**Gemini** cannot use the subscription — see *Gemini is currently unavailable*
below. The OAuth path completes and is then refused by Google. It needs an API
key instead, placed on the server by Tao himself:

```bash
ssh -i ~/.ssh/lab_ed25519 tao@192.168.1.115
```

then, inside that session, with the key from aistudio.google.com/apikey:

```bash
mkdir -p ~/.gemini && nano ~/.gemini/.env     # GEMINI_API_KEY=your-key-here
chmod 600 ~/.gemini/.env
```

For the record of why it is done that way: an API key is a credential, so it
goes from Tao to the server directly. It is not pasted into chat, and Claude
never handles the value.

Admin → The Workshop shows which engines are ready and prints the exact command
for any that are not.

## API

| Method | Route | Does |
|---|---|---|
| GET | `/api/engines` | engine status, workspace path, boundary rules |
| POST | `/api/engines/ask` | `{prompt, engine?, role?, write?, timeout?}` |
| POST | `/api/engines/panel` | `{prompt}` — all engines answer |
| POST | `/api/engines/review` | `{task, engine?}` — draft, critique, revise |
| GET | `/api/engines/jobs` | recent jobs |
| GET | `/api/engines/jobs/:id` | one job with full output |
| GET | `/api/engines/workspace` | clone branch, HEAD, uncommitted changes |

Failure codes are meaningful: `422` boundary refusal, `429` busy, `503` no
engine signed in, `403` sandbox violation.

## What this unlocks

The builders currently call Claude directly through `askClaude`. Pointing them
at `engines.review()` instead means every generated widget, page and skin gets
drafted by one model and marked by two others before it can publish. That is
the structural fix for the orange problem — not a better prompt, a better
process.

## Still to do

- Route `builders.js` and `devteam.js` through the engine layer.
- A promotion path: engine works in the clone, produces a branch, admin reviews
  the diff in the portal, and only then does it deploy.
- Per-engine quota awareness so a run does not silently burn a month's limit.

---

## Field notes from getting it running

Four things bit us. All four are recorded because they will bite again.

**Codex blocks on an open stdin pipe.** Spawned with a default stdin pipe it
prints `Reading additional input from stdin...` and waits forever, so every job
looked like a timeout. `stdio: ['ignore','pipe','pipe']` fixes it. Jobs went
from 5+ minutes to 16 seconds.

**`codex login status` writes to stderr, not stdout.** Reading only stdout made
a signed-in Codex look signed out.

**Ubuntu 24.04 blocks unprivileged user namespaces** via
`kernel.apparmor_restrict_unprivileged_userns=1`, so Codex's bubblewrap sandbox
cannot start and any shell command it tries fails with `Operation not
permitted`. Two mitigations, neither of which touches the kernel setting:
`sandbox_workspace_write.network_access=true` skips the network-namespace step
that fails first, and the Manager now attaches file contents itself rather than
letting the engine shell out to read them. Filesystem confinement — the part
that actually protects this server — is retained.

**Credential files on disk prove nothing.** Gemini's OAuth completed and wrote a
valid `oauth_creds.json`, and the service then refused the account anyway. An
engine is now only `ok` once it has actually answered, and a failing job marks
it dead again with the reason.

## Gemini is currently unavailable

Google has withdrawn Gemini Code Assist for individual accounts on this CLI:

> This client is no longer supported for Gemini Code Assist for individuals.
> To continue using Gemini, please migrate to the Antigravity suite of products.

Antigravity is a desktop IDE, so it cannot run headless on the server. The
remaining official path is a `GEMINI_API_KEY` from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey), placed in
`~/.gemini/.env` on the server as `GEMINI_API_KEY=...`. That is a separate
Google product from the Gemini subscription — the subscription does not carry
over to it. The engine layer already detects this and prints the instruction.

## Proof it works

Asked Codex to read `presence.js` cold, it found a real defect in 16 seconds:
stale neighbour-table entries can keep someone marked home with `certain`
confidence after they have left.

Then `review()` was asked for the smallest correct fix. Codex proposed requiring
`REACHABLE` in the ARP filter. Claude rejected it with two specific objections —
ICMP does not give the kernel upper-layer confirmation, so present devices read
as `DELAY`/`PROBE` and would all be marked away; and MAC-only assets that are
never pinged would regress permanently — and proposed keeping the ping result,
which the code currently throws away, as the confirmation instead.

That is the whole argument for this module in one exchange. A single engine
would have shipped the first fix.
