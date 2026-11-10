#!/bin/sh
set -eu

# O volume montado pelo host tem permissões próprias após o build.
install -d -m 0700 -o www-data -g www-data /var/www/html/storage/app/private
if [ -n "${APP_URL:-}" ]; then
    export ASSET_URL="${ASSET_URL:-$APP_URL}"
fi
exec supervisord -n -c /etc/supervisor/supervisord.conf
