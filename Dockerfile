FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM php:8.3-fpm-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends nginx supervisor libpq-dev libzip-dev libicu-dev libonig-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libfontconfig1 ca-certificates unzip git \
    && docker-php-ext-configure gd --with-jpeg --with-freetype \
    && docker-php-ext-install pdo_pgsql pdo_mysql zip intl mbstring gd pcntl opcache \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
WORKDIR /var/www/html
COPY . .
COPY --from=frontend /app/public/build ./public/build
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/.office-runtime ./.office-runtime
RUN mkdir -p storage/app/private storage/framework/cache/data storage/framework/cache/locks storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache \
    && printf 'upload_max_filesize=20M\npost_max_size=21M\nmax_execution_time=150\nmemory_limit=512M\n' > /usr/local/etc/php/conf.d/provaai.ini
COPY deploy/nginx.conf /etc/nginx/sites-available/default
COPY deploy/supervisord.conf /etc/supervisor/conf.d/provaai.conf
EXPOSE 8080
CMD ["sh", "deploy/start.sh"]
