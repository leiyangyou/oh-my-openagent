#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/leiyang/Workspace/personal/oh-my-openagent-wt/feature-modelmap-background"
EVIDENCE="$ROOT/.omo/evidence/20260818-modelmap-background/live"
HOST_DB="$HOME/.local/share/opencode/opencode.db"
CODEX_CONFIG="$HOME/.codex/config.toml"
FAKE_PORT=48331
SERVER_PORT=48332
FAKE_PID=""
SERVER_PID=""
RUN_PID=""
QA_ROOT=""

cleanup() {
  if [ -n "$RUN_PID" ]; then kill "$RUN_PID" 2>/dev/null || true; wait "$RUN_PID" 2>/dev/null || true; fi
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; fi
  if [ -n "$FAKE_PID" ]; then kill "$FAKE_PID" 2>/dev/null || true; wait "$FAKE_PID" 2>/dev/null || true; fi
  if [ -n "$QA_ROOT" ]; then rm -rf "$QA_ROOT"; fi
}
trap cleanup EXIT

mkdir -p "$EVIDENCE"
rm -f "$EVIDENCE"/*.json "$EVIDENCE"/*.jsonl "$EVIDENCE"/*.txt "$EVIDENCE"/*.log

HOST_COUNT_BEFORE="$(sqlite3 "$HOST_DB" 'SELECT count(*) FROM session;')"
CODEX_SHA_BEFORE="$(shasum -a 256 "$CODEX_CONFIG" | cut -d ' ' -f 1)"
QA_ROOT="$(mktemp -d -t modelmap-background.XXXXXX)"
PROJECT="$QA_ROOT/home/project"
mkdir -p "$PROJECT/.omo" "$QA_ROOT/config/opencode" "$QA_ROOT/data" "$QA_ROOT/cache" "$QA_ROOT/state" "$QA_ROOT/home"

cat > "$QA_ROOT/config/opencode/opencode.jsonc" <<JSON
{
  "plugin": ["file://$ROOT/packages/omo-opencode/src/index.ts"],
  "model": "openai/parent-base",
  "provider": {
    "openai": {
      "options": { "apiKey": "fake", "baseURL": "http://127.0.0.1:$FAKE_PORT/v1" },
      "models": {
        "parent-base": { "tool_call": true, "limit": { "context": 200000, "output": 8192 } },
        "mapped-old": { "tool_call": true, "limit": { "context": 200000, "output": 8192 } },
        "mapped-new": { "tool_call": true, "limit": { "context": 200000, "output": 8192 } },
        "fallback-old": { "tool_call": true, "limit": { "context": 200000, "output": 8192 } }
      }
    }
  },
  "permission": { "task": "allow" }
}
JSON

cat > "$PROJECT/.omo/omo.jsonc" <<JSON
{
  "model_presets": {
    "old": { "categories": { "quick": "openai/mapped-old" } },
    "new": { "categories": { "quick": "openai/mapped-new" } }
  },
  "model_preset": "old",
  "[opencode]": {
    "categories": {
      "quick": {
        "model": "openai/parent-base",
        "fallback_models": ["openai/fallback-old"]
      }
    },
    "background_task": { "providerConcurrency": { "openai": 1 } },
    "disabled_hooks": ["auto-update-checker"]
  }
}
JSON

export HOME="$QA_ROOT/home"
export XDG_CONFIG_HOME="$QA_ROOT/config"
export XDG_DATA_HOME="$QA_ROOT/data"
export XDG_CACHE_HOME="$QA_ROOT/cache"
export XDG_STATE_HOME="$QA_ROOT/state"
export OPENCODE_DISABLE_AUTOUPDATE=1
export OPENCODE_DISABLE_MODELS_FETCH=1
export OMO_DISABLE_PROCESS_CLEANUP=1
export OMO_DISABLE_POSTHOG=1

FAKE_OPENAI_PORT="$FAKE_PORT" FAKE_LLM_LOG="$EVIDENCE/provider-requests.jsonl" \
  node "$ROOT/.omo/evidence/20260818-modelmap-background/background-admission-fake-openai.mjs" \
  > "$EVIDENCE/fake-provider.log" 2>&1 &
FAKE_PID=$!

opencode serve --port "$SERVER_PORT" --hostname 127.0.0.1 --print-logs --log-level INFO \
  > "$EVIDENCE/opencode-server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 100); do
  if curl -fsS "http://127.0.0.1:$FAKE_PORT/health" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$SERVER_PORT/global/health" >/dev/null 2>&1; then break; fi
  sleep 0.1
done
curl -fsS "http://127.0.0.1:$SERVER_PORT/global/health" > "$EVIDENCE/opencode-health.json"

PARENT_JSON="$(curl -fsS -X POST -H 'content-type: application/json' --data '{"title":"background admission parent"}' "http://127.0.0.1:$SERVER_PORT/session?directory=$PROJECT")"
PARENT_ID="$(printf '%s' "$PARENT_JSON" | jq -r '.id')"
printf '%s\n' "$PARENT_JSON" > "$EVIDENCE/parent-session.json"

opencode run --attach "http://127.0.0.1:$SERVER_PORT" --dir "$PROJECT" --format json \
  --session "$PARENT_ID" --model openai/parent-base "BGQA_PARENT" \
  > "$EVIDENCE/parent-run.jsonl" 2>&1 &
RUN_PID=$!

for _ in $(seq 1 300); do
  STATE="$(curl -fsS "http://127.0.0.1:$FAKE_PORT/state")"
  if [ "$(printf '%s' "$STATE" | jq -r '.firstActive and .secondIssued')" = true ]; then break; fi
  sleep 0.1
done
STATE_BEFORE="$(curl -fsS "http://127.0.0.1:$FAKE_PORT/state")"
printf '%s\n' "$STATE_BEFORE" > "$EVIDENCE/state-before-switch.json"
jq -e '.firstActive and .secondIssued and (.released | not)' "$EVIDENCE/state-before-switch.json" >/dev/null

COMMAND_JSON="$(curl -fsS -X POST -H 'content-type: application/json' --data '{"title":"background admission command"}' "http://127.0.0.1:$SERVER_PORT/session?directory=$PROJECT")"
COMMAND_ID="$(printf '%s' "$COMMAND_JSON" | jq -r '.id')"
curl -fsS -X POST -H 'content-type: application/json' \
  --data '{"command":"modelmap","arguments":"use new","agent":"Sisyphus - ultraworker","model":"openai/parent-base"}' \
  "http://127.0.0.1:$SERVER_PORT/session/$COMMAND_ID/command?directory=$PROJECT" \
  > "$EVIDENCE/modelmap-switch-response.json"
curl -fsS "http://127.0.0.1:$SERVER_PORT/session/$COMMAND_ID/message?directory=$PROJECT" \
  > "$EVIDENCE/modelmap-command-messages.json"
jq '[.[] | .parts[] | select(.synthetic == true) | .text | fromjson | select(.action == "use")]' \
  "$EVIDENCE/modelmap-command-messages.json" > "$EVIDENCE/modelmap-switch-result.json"
jq -e 'length == 1 and .[0].name == "new" and .[0].scope == "workspace"' "$EVIDENCE/modelmap-switch-result.json" >/dev/null

curl -fsS -X POST "http://127.0.0.1:$FAKE_PORT/release-first" > "$EVIDENCE/release-first.txt"
for _ in $(seq 1 600); do
  if ! kill -0 "$RUN_PID" 2>/dev/null; then break; fi
  sleep 0.1
done
if kill -0 "$RUN_PID" 2>/dev/null; then
  printf 'parent run timed out\n' >&2
  exit 1
fi
wait "$RUN_PID"
RUN_PID=""

for _ in $(seq 1 300); do
  if jq -e -s '
    ([.[] | select(.model == "mapped-new" and (.input | contains("BGQA_SECOND_CHILD")))] | length) >= 1 and
    ([.[] | select(.model == "fallback-old" and (.input | contains("BGQA_FIRST_CHILD")))] | length) >= 1
  ' "$EVIDENCE/provider-requests.jsonl" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

jq -s '[.[] | select(.type == "tool_use") | {tool:.part.tool,metadata:.part.state.metadata}]' \
  "$EVIDENCE/parent-run.jsonl" > "$EVIDENCE/tool-metadata.json"
jq -s '[.[] | {call,model,prompt:(if (.input | contains("BGQA_FIRST_CHILD")) then "first" elif (.input | contains("BGQA_SECOND_CHILD")) then "second" else "other" end)}]' \
  "$EVIDENCE/provider-requests.jsonl" > "$EVIDENCE/provider-observations.json"

jq -e '[.[] | select(.model == "mapped-old" and .prompt == "first")] | length >= 1' "$EVIDENCE/provider-observations.json" >/dev/null
jq -e '[.[] | select(.model == "mapped-new" and .prompt == "second")] | length == 1' "$EVIDENCE/provider-observations.json" >/dev/null
jq -e '[.[] | select(.model == "mapped-old" and .prompt == "second")] | length == 0' "$EVIDENCE/provider-observations.json" >/dev/null
jq -e '[.[] | select(.model == "fallback-old" and .prompt == "first")] | length >= 1' "$EVIDENCE/provider-observations.json" >/dev/null
jq -e '
  [.[] | select(.tool == "task") | .metadata.modelMap] as $routes |
  ($routes | length) == 2 and
  $routes[0].source == "model-map" and $routes[0].presetName == "old" and
  $routes[1].source == "model-map" and $routes[1].presetName == "new" and
  $routes[1].revision > $routes[0].revision
' "$EVIDENCE/tool-metadata.json" >/dev/null

ISOLATED_COUNT="$(sqlite3 "$QA_ROOT/data/opencode/opencode.db" 'SELECT count(*) FROM session;')"
HOST_COUNT_AFTER="$(sqlite3 "$HOST_DB" 'SELECT count(*) FROM session;')"
CODEX_SHA_AFTER="$(shasum -a 256 "$CODEX_CONFIG" | cut -d ' ' -f 1)"

jq -n \
  --argjson hostBefore "$HOST_COUNT_BEFORE" \
  --argjson hostAfter "$HOST_COUNT_AFTER" \
  --argjson isolatedSessions "$ISOLATED_COUNT" \
  --arg codexBefore "$CODEX_SHA_BEFORE" \
  --arg codexAfter "$CODEX_SHA_AFTER" \
  '{hostBefore:$hostBefore,hostAfter:$hostAfter,hostCountsEqual:($hostBefore==$hostAfter),isolatedSessions:$isolatedSessions,codexBefore:$codexBefore,codexAfter:$codexAfter,codexEqual:($codexBefore==$codexAfter)}' \
  > "$EVIDENCE/isolation-verdict.json"
jq -e '.hostCountsEqual and .codexEqual and .isolatedSessions >= 4' "$EVIDENCE/isolation-verdict.json" >/dev/null

jq -n \
  --arg active "mapped-old" \
  --arg queued "mapped-new" \
  --arg fallback "fallback-old" \
  --slurpfile routes "$EVIDENCE/tool-metadata.json" \
  --slurpfile isolation "$EVIDENCE/isolation-verdict.json" \
  '{activeRoute:$active,queuedRoute:$queued,pinnedFallback:$fallback,structuredToolMetadata:$routes[0],isolation:$isolation[0],result:"pass"}' \
  > "$EVIDENCE/qa-verdict.json"

kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true
SERVER_PID=""
kill "$FAKE_PID" 2>/dev/null || true
wait "$FAKE_PID" 2>/dev/null || true
FAKE_PID=""
rm -f "$EVIDENCE/provider-requests.jsonl"
rm -rf "$QA_ROOT"
QA_ROOT=""

trap - EXIT
printf 'PASS live background admission QA: active=mapped-old queued=mapped-new fallback=fallback-old\n'
