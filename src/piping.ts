import * as http from "http";
import * as url from "url";
import * as stream from "stream";
import {ParsedUrlQuery} from "querystring";
import 'core-js'; // NOTE: For use Object.values() under node 6 (lib: ["es2017"] is not enough)

import {opt, optMap, tryOpt} from "./utils";
import * as path from "path";

type ReqRes = {
  readonly req: http.IncomingMessage,
  readonly res: http.ServerResponse
}

interface Pipe {
  readonly sender: ReqRes;
  readonly receivers: ReqRes[];
}

interface UnconnectedPipe {
  sender?: ReqRes;
  receivers: ReqRes[];
  nReceivers?: number;
}

/**
 * Convert unconnected pipe to pipe if it is connected
 * @param p
 */
function getPipeIfConnected(p: UnconnectedPipe): Pipe | undefined {
  if(p.sender !== undefined && p.nReceivers !== undefined && p.receivers.length === p.nReceivers) {
    return {
      sender: p.sender,
      receivers: p.receivers,
    }
  } else {
    return undefined;
  }
}

// Name to registered path
const NAME_TO_REGISTERED_PATH = {
  index: "/",
  version: "/version"
};

// All registered paths
const REGISTERED_PATHS: string[] =
  Object.values(NAME_TO_REGISTERED_PATH);

export class Server {
  readonly pathToConnected: {[path: string]: boolean} = {};
  readonly pathToUnconnectedPipe: {[path: string]: UnconnectedPipe} = {};

  /**
   * Start data transfer
   *
   * @param path
   * @param pipe
   */
  runPipe(path: string, pipe: Pipe): void {

    // Set connected as true
    this.pathToConnected[path] = true;
    // Delete unconnected pipe
    delete this.pathToUnconnectedPipe[path];

    const {sender, receivers} = pipe;

    let closeCount: number = 0;
    for(const receiver of receivers) {
      // Close receiver
      const closeReceiver = (): void => {
        closeCount += 1;
        sender.req.unpipe(passThrough);
        // If close-count is # of receivers
        if(closeCount === receivers.length) {
          sender.res.end("All receivers are closed halfway\n");
          delete this.pathToConnected[path];
        }
      };

      receiver.res.writeHead(200, {
        // Add Content-Length if it exists
        ...(
          sender.req.headers["content-length"] === undefined ?
          {}: {"Content-Length": sender.req.headers["content-length"]}
        )
      });

      const passThrough = new stream.PassThrough();
      sender.req.pipe(passThrough);
      passThrough.pipe(receiver.res);
      receiver.req.on("close", ()=>{
        console.log("on-close");
        closeReceiver();
      });
      receiver.req.on("error", (err)=>{
        console.log("on-error");
        closeReceiver();
      });
    }

    sender.req.on("end", ()=>{
      sender.res.end("Sending Successful!\n");
      // Delete from connected
      delete this.pathToConnected[path];
    });

    sender.req.on("error", (error)=>{
      sender.res.end("Sending Failed\n");
      // Delete from connected
      delete this.pathToConnected[path];
    });
  }

  readonly handler = (req: http.IncomingMessage, res: http.ServerResponse)=>{
    // Get path name
    const reqPath: string =
      path.resolve(
        "/",
        opt(optMap(url.parse, opt(req.url)).pathname)
          // Remove last "/"
          .replace(/\/$/, "")
      );
    console.log(req.method, reqPath);

    switch (req.method) {
      case "POST":
      case "PUT":
        if(REGISTERED_PATHS.includes(reqPath)) {
          res.writeHead(400);
          res.end(`Error: Cannot send to a registered path '${reqPath}'. (e.g. '/mypath123')\n`);
        } else {
          // Get query parameter
          const query = opt(optMap(url.parse, req.url, true).query);
          // The number receivers
          const nReceivers: number = tryOpt(()=>parseInt((query as ParsedUrlQuery)['n'] as string) ) || 1;
          // if the path have been used
          if (reqPath in this.pathToConnected) {
            res.writeHead(400);
            res.end(`Error: Connection on '${reqPath}' has been established already\n`);
          } else {
            console.log(this.pathToUnconnectedPipe);
            // If the path connection is connecting
            if (reqPath in this.pathToUnconnectedPipe) {
              // Get unconnected pipe
              const unconnectedPipe: UnconnectedPipe = this.pathToUnconnectedPipe[reqPath];
              // If a sender have not been registered yet
              if (unconnectedPipe.sender === undefined) {
                // Register the sender
                unconnectedPipe.sender = {req: req, res: res};
                // Set the number of receivers
                unconnectedPipe.nReceivers = nReceivers;

                // Get dropped receivers
                // (NOTE: receivers can be empty array)
                // (these receivers will be cancel to receive)
                const droppedReceivers: ReqRes[] =
                  unconnectedPipe
                    .receivers
                    .slice(nReceivers, unconnectedPipe.receivers.length);

                // (NOTE: receivers can be empty array)
                for(let droppedReceiver of droppedReceivers) {
                  // Close dropped receiver
                  droppedReceiver.res.writeHead(400);
                  droppedReceiver.res.end("Error: The number connection has reached limits\n");
                }

                // Drop receivers if need
                unconnectedPipe.receivers =
                  unconnectedPipe
                    .receivers
                    .slice(0, nReceivers);

                // Send waiting message
                res.write(`Waiting for ${nReceivers} receivers...\n`);

                // Get pipeOpt if connected
                const pipe: Pipe | undefined =
                  getPipeIfConnected(unconnectedPipe);

                if (pipe !== undefined) {
                  // Emit message to sender
                  res.write("Start sending!\n");
                  // Start data transfer
                  this.runPipe(reqPath, pipe)
                }
              } else {
                res.writeHead(400);
                res.end(`Error: Other sender has been registered on '${reqPath}'\n`);
              }
            } else {
              // Send waiting message
              res.write(`Waiting for ${nReceivers} receivers...\n`);

              // Register new unconnected pipe
              this.pathToUnconnectedPipe[reqPath] = {
                sender: {req: req, res: res},
                receivers: [],
                nReceivers: nReceivers
              };
            }
          }
        }
        break;
      case "GET":
        // request path is in registered paths
        if(REGISTERED_PATHS.includes(reqPath)) {
          switch (reqPath) {
            case NAME_TO_REGISTERED_PATH.index:
              res.end(
                "<html>" +
                  "Piping server is running!\n<br>" +
                  "Usage: <a href='https://github.com/nwtgck/piping-server#readme'>" +
                    "https://github.com/nwtgck/piping-server#readme" +
                  "</a>" +
                "</html>"
              );
              break;
            case NAME_TO_REGISTERED_PATH.version:
              // (from: https://stackoverflow.com/a/22339262/2885946)
              res.end(process.env.npm_package_version+"\n");
              break;
            default:
              console.error("Unexpected error", "reqPath:", reqPath);
              break;
          }
        } else {
          // If connection has been established
          if (reqPath in this.pathToConnected) {
            res.writeHead(400);
            res.end(`Error: Connection on '${reqPath}' has been established already\n`);
          } else {
            if (reqPath in this.pathToUnconnectedPipe) {
              // Get unconnectedPipe
              const unconnectedPipe: UnconnectedPipe = this.pathToUnconnectedPipe[reqPath];
              if (unconnectedPipe.nReceivers === undefined || unconnectedPipe.receivers.length < unconnectedPipe.nReceivers) {
                unconnectedPipe.receivers.push({req: req, res: res});
                // Get pipeOpt if connected
                const pipe: Pipe | undefined =
                  getPipeIfConnected(unconnectedPipe);

                if (pipe !== undefined) {
                  // Emit message to sender
                  pipe.sender.res.write("Start sending!\n");
                  // Start data transfer
                  this.runPipe(reqPath, pipe)
                }
              } else {
                res.writeHead(400);
                res.end("Error: The number connection has reached limits\n");
              }
            } else {
              // Set a receiver
              this.pathToUnconnectedPipe[reqPath] = {
                receivers: [{req: req, res: res}]
              }
            }
          }
        }
        break;
      default:
        res.end(`Error: Unsupported method: ${req.method}\n`);
        break;
    }
  };
}
