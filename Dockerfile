# syntax=docker/dockerfile:1

FROM nginx:1.31.3-alpine-slim@sha256:45b82ed5f285b90d63df07ba70430fdd8f25624b416617d9e6dc93412b2006dc

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

EXPOSE 80
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
