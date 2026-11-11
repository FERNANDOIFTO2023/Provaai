#!/bin/bash
# Executado pelo timer da VM. O Compose e o arquivo de ambiente pertencem a esta instalação.
set -euo pipefail
cd "${PROVAAI_CHECKOUT:-/opt/provaai}"
exec 9>/run/lock/provaai-release.lock
flock -n 9 || exit 0
branch=${PROVAAI_BRANCH:-main}
git check-ref-format --branch "$branch" >/dev/null
git fetch --quiet origin "refs/heads/$branch"
revision=$(git rev-parse FETCH_HEAD)
git cat-file -e "$revision:deploy/release.sh" 2>/dev/null || exit 0
compose=(docker compose --env-file .env.production)
container=$("${compose[@]}" ps -aq app)
previous_image=$(docker inspect --format '{{.Image}}' "$container")
image_repo=${PROVAAI_IMAGE_REPO:-provaai-app}
image="$image_repo:$revision"
running_image=$(docker inspect --format '{{.Config.Image}}' "$container")
if [[ "$running_image" == "$image" ]]; then exit 0; fi

# Apenas o resultado do workflow de push da branch escolhida habilita uma publicação.
conclusion=$(curl -fsS --max-time 20 --get 'https://api.github.com/repos/FERNANDOIFTO2023/Provaai/actions/workflows/validate.yml/runs' \
  --data-urlencode "branch=$branch" --data-urlencode "head_sha=$revision" \
  --data-urlencode 'event=push' --data-urlencode 'per_page=1' |
  python3 -c 'import json,sys; runs=json.load(sys.stdin)["workflow_runs"]; print(runs[0]["conclusion"] if runs else "pending")')
if [[ "$conclusion" != success ]]; then echo "Aguardando CI para $revision ($conclusion)."; exit 0; fi

git diff --quiet && git diff --cached --quiet || { echo 'Checkout com alterações locais.' >&2; exit 1; }
previous_revision=$(git rev-parse HEAD)
export PROVAAI_IMAGE="$image"
switched=0
restore() {
  git checkout --quiet --detach "$previous_revision"
  if (( switched )); then
    docker tag "$previous_image" "$image_repo:rollback"
    PROVAAI_IMAGE="$image_repo:rollback" "${compose[@]}" up -d --no-build --no-deps app
  fi
}
trap restore ERR
set -E
git checkout --quiet --detach "$revision"
"${compose[@]}" build app
"${compose[@]}" run --rm --no-deps --user www-data app sh -ec 'test -r public/index.php && php artisan route:list --path=up >/dev/null'
"${compose[@]}" run --rm --no-deps app php artisan migrate --force
switched=1
"${compose[@]}" up -d --no-deps --no-build app
local_origin=${PROVAAI_LOCAL_ORIGIN:-http://127.0.0.1:8080}
curl --retry 15 --retry-delay 2 --retry-all-errors --max-time 8 -fsS "$local_origin/up" -o /dev/null
curl -fsS --max-time 8 "$local_origin/api/config" |
  python3 -c 'import json,sys; sys.exit(json.load(sys.stdin).get("backend") != "laravel")'
trap - ERR
echo "Versão $revision em execução."
# Mantenha as duas últimas imagens de release para caber no disco da VM.
while IFS= read -r tag; do
  if [[ "${tag#*:}" =~ ^[a-f0-9]{40}$ && "$tag" != "$image" && "$tag" != "$running_image" ]]; then
    docker image rm "$tag"
  fi
done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "$image_repo")
