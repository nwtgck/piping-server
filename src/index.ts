#!/usr/bin/env node
// (from: https://qiita.com/takayukioda/items/a149bc2907ef77121229)

import * as fs from "fs";
import * as http from "http";
import * as http2 from "http2";
import * as log4js from "log4js";
import * as yargs from "yargs";

import * as piping from "./piping";

// Create option parser
const parser = yargs
  .option("http-port", {
    describe: "Port of HTTP server",
    default: 8080
  })
  .option("enable-https", {
    describe: "Enable HTTPS",
    default: false
  })
  .option("https-port", {
    describe: "Port of HTTPS server",
    type: "number"
  })
  .option("key-path", {
    describe: "Private key path",
    type: "string"
  })
  .option("crt-path", {
    describe: "Certification path",
    type: "string"
  })
  .option("enable-log", {
    describe: "Enable logging",
    type: "boolean",
    default: true
  });

// Parse arguments
const args = parser.parse(process.argv);
const httpPort: number = args["http-port"];
const enableHttps: boolean = args["enable-https"];
const httpsPort: number | undefined = args["https-port"];
const serverKeyPath: string | undefined = args["key-path"];
const serverCrtPath: string | undefined = args["crt-path"];
const enableLog: boolean = args["enable-log"];

// Create a logger
const logger = log4js.getLogger();
logger.level = "info";

// Create a piping server
const pipingServer = new piping.Server(enableLog, logger);

http.createServer(pipingServer.generateHandler(false))
  .listen(httpPort, () => {
    logger.info(`Listen HTTP on ${httpPort}...`);
  });

if (enableHttps && httpsPort !== undefined) {
  if (serverKeyPath === undefined || serverCrtPath === undefined) {
    logger.error("Error: --key-path and --crt-path should be specified");
  } else {
    http2.createSecureServer(
      {
        key: fs.readFileSync(serverKeyPath),
        cert: fs.readFileSync(serverCrtPath)
      },
      pipingServer.generateHandler(true)
    ).listen(httpsPort, () => {
      logger.info(`Listen HTTPS on ${httpsPort}...`);
    });
  }
}
