# syntax=docker/dockerfile:1.7

FROM ghcr.io/gohugoio/hugo:v0.164.0 AS build

USER root
RUN apk add --no-cache curl jq

WORKDIR /site
COPY . .

RUN --mount=type=secret,id=LASTFM_API_KEY \
    ./scripts/fetch-lastfm.sh \
    && hugo --minify --cleanDestinationDir

FROM nginx:1.29-alpine-slim

COPY --from=build /site/public /usr/share/nginx/html

EXPOSE 80
