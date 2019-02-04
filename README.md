# piping-server
[![npm](https://img.shields.io/npm/v/piping-server.svg)](https://www.npmjs.com/package/piping-server) [![CodeFactor](https://www.codefactor.io/repository/github/nwtgck/piping-server/badge)](https://www.codefactor.io/repository/github/nwtgck/piping-server) [![CircleCI](https://circleci.com/gh/nwtgck/piping-server.svg?style=shield)](https://circleci.com/gh/nwtgck/piping-server) 
[![Docker Automated build](https://img.shields.io/docker/automated/nwtgck/piping-server.svg)](https://hub.docker.com/r/nwtgck/piping-server/)
 [![](https://images.microbadger.com/badges/image/nwtgck/piping-server.svg)](https://microbadger.com/images/nwtgck/piping-server "Get your own image badge on microbadger.com") [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=nwtgck/piping-server)](https://dependabot.com)
 
 [![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

Streaming Data Transfer Server over HTTP/HTTPS

![piping server transfer](demo_images/piping-server.gif)

## Design Philosophy

Piping server is designed to realize the following three ideas. 

1. Account-free
1. Install-free
1. Engineer friendly

Usually, when you want to send data to someone, you need to have an account in the common service among you and his/her.
In addition, the service may require you to install specific software to share the data.


Piping server is designed to solve the problems above.
Piping server allows you to use without any account and frees you from additional software installation because the server is available with Web browsers, `curl` and `wget` commands, which are widely pre-installed in Unix-like OS.
Because of HTTP/HTTPS, users can send data across different devices such as Windows, macOS, Unix, Linux, iOS, Android and any device which uses HTTP. 
Furthermore, pipe in Unix-like OS allows you to send data in a more efficient and secure way.

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

## Engineer Friendly Help

You can get help and version only with `curl`!

```bash
curl piping.ml/help
```

```bash
curl piping.ml/version
```

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

