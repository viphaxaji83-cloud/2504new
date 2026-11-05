#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

command -v docker >/dev/null 2>&1 || { echo 'Docker is not installed. Contact the server administrator.'; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'curl is not installed. Contact the server administrator.'; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
for file in Dockerfile compose.yaml package.json package-lock.json server/start.mjs dist/index.html; do
  test -f "$file" || { echo "Missing release file: $file"; exit 1; }
done
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  echo 'Created .env for http://172.17.254.145:6065. Existing .env files are never replaced.'
fi
docker compose config --quiet

# Keep the existing Compose project name and volume. Back up a running Node installation before rebuilding.
backup_dir="../app_2504-backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
stamp="$(date +%Y%m%d-%H%M%S)"
if [ -n "$(docker compose ps --status running -q web)" ]; then
  if docker compose exec -T web node --version >/dev/null 2>&1; then
    backup_path="$(docker compose exec -T web node server/backup.mjs)"
    case "$backup_path" in /tmp/mgtu-backup-*.sqlite) ;; *) echo 'Unexpected backup path. Deployment stopped.'; exit 1 ;; esac
    docker compose cp "web:$backup_path" "$backup_dir/site-$stamp.sqlite"
    chmod 600 "$backup_dir/site-$stamp.sqlite"
    echo "Database backup: $backup_dir/site-$stamp.sqlite"
  elif docker compose exec -T web nginx -v >/dev/null 2>&1; then
    echo 'Existing container is the old static Nginx site. No application SQLite backup was made.'
  else
    echo 'Cannot identify or back up the existing container. Deployment stopped.'
    exit 1
  fi
fi

docker compose up -d --build
docker compose ps
# Check inside the container, so custom public addresses/bind IPs do not break this check.
docker compose exec -T web node --input-type=module -e "for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:8080/healthz',{signal:AbortSignal.timeout(2000)});if(r.ok){console.log(await r.text());process.exit(0)}}catch{}await new Promise(resolve=>setTimeout(resolve,1000))}console.error('Health check failed. Run: docker compose logs --tail=100 web');process.exit(1)"
echo 'Deployment complete. Open http://172.17.254.145:6065/ (or the address in APP_ORIGIN).'
echo 'First installation only: docker compose exec web node server/create-admin.mjs admin'
echo 'If administrator accounts already exist, keep using them; do not reset them on every update.'
