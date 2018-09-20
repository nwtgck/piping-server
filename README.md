# piping-server
[![npm](https://img.shields.io/npm/v/piping-server.svg)](https://www.npmjs.com/package/piping-server)
 [![Build Status](https://travis-ci.com/nwtgck/piping-server.svg?branch=develop)](https://travis-ci.com/nwtgck/piping-server) 
[![Docker Automated build](https://img.shields.io/docker/automated/nwtgck/piping-server.svg)](https://hub.docker.com/r/nwtgck/piping-server/)
 [![](https://images.microbadger.com/badges/image/nwtgck/piping-server.svg)](https://microbadger.com/images/nwtgck/piping-server "Get your own image badge on microbadger.com") [![Greenkeeper badge](https://badges.greenkeeper.io/nwtgck/piping-server.svg)](https://greenkeeper.io/)

HTTP Piping Data Transfer Server

![piping server transfer](demo_images/piping-server.gif)

## Transfer example

Suppose a Piping server is running on <https://piping.glitch.me>. You can send "hello.txt" to a single receiver.

```bash
# Send
cat hello.txt | curl -X POST https://piping.glitch.me/mysecret --data-binary @-

# Get
curl https://piping.glitch.me/mysecret > myhello.txt 
```

## Multiple Transfer

Piping server supports multiple receiver. The following moving image is an example. Use query parameter "?n=3" to allow 3 receivers for example.

![Piping server multiple transfer](demo_images/piping-server-multi-transfer.gif)

## Run a server on Docker

Run a Piping server on <http://localhost:8181> by the following command.

```bash
docker run -it -p 8181:8080 nwtgck/piping-server
```
