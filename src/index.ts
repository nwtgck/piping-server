#!/usr/bin/env node
// (from: https://qiita.com/takayukioda/items/a149bc2907ef77121229)

import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as yargs from "yargs";

import * as piping from "./piping";

// Create option parser
const parser = yargs
  .option("http-port", {
    describe: 'Port of HTTP server',
    default: 8080
  })
  .option("enable-https", {
    describe: 'Enable HTTPS',
    default: false
  })
  .option("https-port", {
    describe: 'Port of HTTPS server',
  })
  .option("key-path", {
    describe: 'Private key path',
  })
  .option("crt-path", {
    describe: 'Certification path',
  })
  .option("enable-log", {
    describe: 'Enable logging',
    type: 'boolean',
    default: true
  });

// Parse arguments
const args = parser.parse(process.argv);
const httpPort: number = args['http-port'];
const enableHttps: boolean = args['enable-https'];
const httpsPort: number | undefined = args['https-port'] as number | undefined;
const serverKeyPath: string | undefined = args['key-path'] as string | undefined;
const serverCrtPath: string | undefined = args['crt-path'] as string | undefined;
const enableLog: boolean = args['enable-log'];

// Create a piping server
const pipingServer = new piping.Server(enableLog);

http.createServer(pipingServer.handler)
  .listen(httpPort, ()=>{
    console.log(`Listen HTTP on ${httpPort}...`);
  });

if (enableHttps && httpsPort !== undefined) {
  if (serverKeyPath === undefined || serverCrtPath === undefined) {
    console.error("Error: --key-path and --crt-path should be specified");
  } else {
    https.createServer(
      {
        key: fs.readFileSync(serverKeyPath),
        cert: fs.readFileSync(serverCrtPath)
      },
      pipingServer.handler
    ).listen(httpsPort, ()=>{
      console.log(`Listen HTTPS on ${httpsPort}...`);
    });
  }
}