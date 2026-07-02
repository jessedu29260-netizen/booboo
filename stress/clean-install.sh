#!/usr/bin/env bash
# Clean-install dress rehearsal — the LAUNCH_CHECKLIST "clean machine" gate, runnable on demand.
#
#   ./stress/clean-install.sh                 → publish to throwaway Verdaccio, consume in clean container
#   REGISTRY=https://registry.npmjs.org ./stress/clean-install.sh --no-publish
#                                             → Stage B: same consumer journey vs the REAL registry
#
# Host needs: docker, pnpm (repo already built). Never touches the real npm unless you point it there.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: stop mangling container-side /paths in docker args

NET=booboo-stress
REG_NAME=booboo-registry
REGISTRY_INTERNAL="${REGISTRY:-http://$REG_NAME:4873}"
PUBLISH=1
[ "${1:-}" = "--no-publish" ] && PUBLISH=0

cleanup() {
  docker rm -f $REG_NAME booboo-consumer >/dev/null 2>&1 || true
  docker network rm $NET >/dev/null 2>&1 || true
  if [ -n "${NPMRC_TMP:-}" ]; then rm -f "$NPMRC_TMP"; fi
}
trap cleanup EXIT

if [ "$PUBLISH" = "1" ]; then
  echo "── registry: throwaway Verdaccio"
  cleanup
  docker network create $NET >/dev/null
  docker run -d --name $REG_NAME --network $NET -p 4873:4873 \
    -v "$(pwd)/stress/verdaccio.yaml:/verdaccio/conf/config.yaml:ro" verdaccio/verdaccio:6 >/dev/null
  for i in $(seq 1 30); do curl -sf http://localhost:4873/-/ping >/dev/null 2>&1 && break; sleep 1; done
  curl -sf http://localhost:4873/-/ping >/dev/null || { echo "✗ Verdaccio never came up"; exit 1; }

  echo "── publish: 6 packages via pnpm (converts workspace:* — NEVER npm publish here)"
  NPMRC_TMP=$(mktemp)
  printf '//localhost:4873/:_authToken=stress-dummy\nregistry=http://localhost:4873\n' > "$NPMRC_TMP"
  for pkg in @booboo-brain/spec @booboo-brain/build @booboo-brain/serve @booboo-brain/viewer @booboo-brain/cli create-booboo; do
    env "NPM_CONFIG_USERCONFIG=$NPMRC_TMP" "npm_config_//localhost:4873/:_authToken=stress-dummy" \
      pnpm --filter "$pkg" publish --registry http://localhost:4873 --no-git-checks --force >/dev/null \
      && echo "  ✓ $pkg" || { echo "  ✗ publish failed: $pkg"; exit 1; }
  done
else
  echo "── skipping publish; consuming from $REGISTRY_INTERNAL"
  docker network create $NET >/dev/null 2>&1 || true
fi

echo "── consumer: clean node:20 container (has never seen this repo)"
docker run --rm --name booboo-consumer --network $NET \
  -e REGISTRY="$REGISTRY_INTERNAL" \
  -v "$(pwd)/stress/consumer.sh:/consumer.sh:ro" \
  node:20-bookworm bash /consumer.sh
