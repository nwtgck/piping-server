FROM node:14.17.6-alpine

LABEL maintainer="Ryo Ota <nwtgck@nwtgck.org>"

RUN apk add --no-cache tini

COPY . /app

# Move to /app
WORKDIR /app

# Install requirements, build and remove devDependencies
# (from: https://stackoverflow.com/a/25571391/2885946)
RUN npm ci && \
    npm run build && \
    npm prune --production && \
    npm cache clean --force && \
    # Remove files for reproducible build
    rm /root/.npm/anonymous-cli-metrics.json /root/.config/configstore/update-notifier-npm.json

# Run a server
ENTRYPOINT [ "tini", "--", "node", "dist/src/index.js" ]
