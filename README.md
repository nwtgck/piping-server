# piping-server
[![npm](https://img.shields.io/npm/v/piping-server.svg)](https://www.npmjs.com/package/piping-server)
 [![Build Status](https://travis-ci.com/nwtgck/piping-server.svg?branch=develop)](https://travis-ci.com/nwtgck/piping-server) [![CircleCI](https://circleci.com/gh/nwtgck/piping-server.svg?style=shield)](https://circleci.com/gh/nwtgck/piping-server) 
[![Docker Automated build](https://img.shields.io/docker/automated/nwtgck/piping-server.svg)](https://hub.docker.com/r/nwtgck/piping-server/)
 [![](https://images.microbadger.com/badges/image/nwtgck/piping-server.svg)](https://microbadger.com/images/nwtgck/piping-server "Get your own image badge on microbadger.com") [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=nwtgck/piping-server)](https://dependabot.com)
 
 [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

HTTP Piping Data Transfer Server

![piping server transfer](demo_images/piping-server.gif)

## Transfer example

Suppose a Piping server is running on <https://piping.glitch.me>. You can send "hello.txt" to a receiver.

```bash
# Send
cat hello.txt | curl -T - https://piping.glitch.me/mysecret
```

```bash
# Get
curl https://piping.glitch.me/mysecret > myhello.txt 
```

## Multiple Transfer

Piping server supports multiple receiver. The following moving image is an example. Use query parameter "?n=3" to allow 3 receivers for example.

![Piping server multiple transfer](demo_images/piping-server-multi-transfer.gif)

## Run server

### Heroku deployment

Click the botton below to deploy a Piping server to Heroku.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)


### Run server on localhost

```bash
# Install
npm install -g piping-server
# Run a server
piping-server
```
Then, a Piping server is running on <http://localhost:8080>.

### Command-line Options

Here is available command-line options by `piping-server --help`.

```
Options:
  --help          Show help                                            [boolean]
  --version       Show version number                                  [boolean]
  --http-port     Port of HTTP server                            [default: 8080]
  --enable-https  Enable HTTPS                                  [default: false]
  --https-port    Port of HTTPS server                                  [number]
  --key-path      Private key path                                      [string]
  --crt-path      Certification path                                    [string]
  --enable-log    Enable logging                       [boolean] [default: true]
```

### Run on Docker

Run a Piping server on <http://localhost:8181> by the following command.

```bash
docker run -it -p 8181:8080 nwtgck/piping-server
```

You can also specify options like the following.

```bash
docker run -it -p 8181:80 nwtgck/piping-server --http-port=80
```

