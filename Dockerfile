# syntax=docker/dockerfile:1

FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS source

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN git log -1 --format=%cI -- content/blogroll/feeds.opml > .blogroll-updated \
    && rm -rf .git

FROM node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

ARG TARGETARCH
ARG HUGO_VERSION=0.164.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl jq nginx \
    && case "$TARGETARCH" in \
        amd64) hugo_sha256=d9c8b17285ea4ec004d9f814273ea910f2051ce02c284993fd1f91ba455ae50d ;; \
        arm64) hugo_sha256=948ee5f0ed30175f31937d592d63a2712f0761a69f1cbe812f780eb918a08b8e ;; \
        *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && curl -fsSL \
        "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_linux-${TARGETARCH}.tar.gz" \
        -o /tmp/hugo.tar.gz \
    && echo "$hugo_sha256  /tmp/hugo.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo \
    && rm -f /tmp/hugo.tar.gz \
    && rm -rf /var/lib/apt/lists/* /var/www/html \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=source /app /app
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

ENV HUGO_ENVIRONMENT=production \
    HUGO_CACHEDIR=/var/lib/site/hugo \
    SEQUOIA_RUNTIME_DIR=/var/lib/site/sequoia

RUN chmod +x scripts/build.sh scripts/publish-sequoia.sh scripts/docker-entrypoint.sh \
    && mkdir -p /var/lib/site /app/public

EXPOSE 80
STOPSIGNAL SIGQUIT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10m --retries=3 \
    CMD curl -fsS http://127.0.0.1/ >/dev/null || exit 1

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
