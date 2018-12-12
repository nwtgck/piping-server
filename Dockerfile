FROM node:10.14.2-alpine

LABEL maintainer="Ryo Ota <nwtgck@gmail.com>"

COPY . /app

# Move to /app
WORKDIR /app

# Install requirements, build and remove devDependencies
# (from: https://stackoverflow.com/a/25571391/2885946)
RUN npm install && \
    npm run build && \
    npm prune --production

# Run entry (Run the server)
ENTRYPOINT ["node", "dist/src/index.js"]
