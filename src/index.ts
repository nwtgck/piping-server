import * as http from "http";
import * as url from "url";
import * as stream from "stream";
import {ParsedUrlQuery} from "querystring";

import {opt, optMap, tryOpt} from "./utils";

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

const pathToConnected: {[path: string]: boolean} = {};
const pathToUnconnectedPipe: {[path: string]: UnconnectedPipe} = {};

/**
 * Start data transfer
 *
 * @param path
 * @param pipe
 */
function runPipe(path: string, pipe: Pipe): void {

  // Set connected as true
  pathToConnected[path] = true;
  // Delete unconnected pipe
  delete pathToUnconnectedPipe[path];

  const {sender, receivers} = pipe;

  let closeCount: number = 0;
  for(let receiver of receivers) {
    // Close receiver
    const closeReceiver = (): void => {
      closeCount += 1;
      sender.req.unpipe(passThrough);
      // If close-count is # of receivers
      if(closeCount === receivers.length) {
        sender.res.end("All receivers are closed halfway\n");
        delete pathToConnected[path];
      }
    };

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
    delete pathToConnected[path];
  });

  sender.req.on("error", (error)=>{
    sender.res.end("Sending Failed\n");
    // Delete from connected
    delete pathToConnected[path];
  });
}

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse)=>{
  // Get path name
  const path: string =
    opt(optMap(url.parse, opt(req.url)).pathname)
      // Remove last "/"
      .replace(/\/$/, "");
  console.log(path);

  switch (req.method) {
    case "POST":
      // Get query parameter
      const query = opt(optMap(url.parse, req.url, true).query);
      // The number receivers
      const nReceivers: number = tryOpt(()=>parseInt((query as ParsedUrlQuery)['n'] as string) ) || 1;
      // if the path have been used
      if (path in pathToConnected) {
        res.writeHead(400);
        res.end(`Error: Connection on '${path}' has been established already\n`);
      } else {
        console.log(pathToUnconnectedPipe);
        // If the path connection is connecting
        if (path in pathToUnconnectedPipe) {
          // Get unconnected pipe
          const unconnectedPipe: UnconnectedPipe = pathToUnconnectedPipe[path];
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
              runPipe(path, pipe)
            }
          } else {
            res.writeHead(400);
            res.end(`Error: Other sender has been registered on '${path}'\n`);
          }
        } else {
          // Send waiting message
          res.write(`Waiting for ${nReceivers} receivers...\n`);

          // Register new unconnected pipe
          pathToUnconnectedPipe[path] = {
            sender: {req: req, res: res},
            receivers: [],
            nReceivers: nReceivers
          }
        }
      }
      break;
    case "GET":

      // If connection has been established
      if (path in pathToConnected) {
        res.writeHead(400);
        res.end(`Error: Connection on '${path}' has been established already\n`);
      } else {
        if (path in pathToUnconnectedPipe) {
          // Get unconnectedPipe
          const unconnectedPipe: UnconnectedPipe = pathToUnconnectedPipe[path];
          if (unconnectedPipe.nReceivers === undefined || unconnectedPipe.receivers.length < unconnectedPipe.nReceivers) {
            unconnectedPipe.receivers.push({req: req, res: res});
            // Get pipeOpt if connected
            const pipe: Pipe | undefined =
              getPipeIfConnected(unconnectedPipe);

            if (pipe !== undefined) {
              // Emit message to sender
              res.write("Start sending!\n");
              // Start data transfer
              runPipe(path, pipe)
            }
          } else {
            res.writeHead(400);
            res.end("Error: The number connection has reached limits\n");
          }
        } else {
          // Set a receiver
          pathToUnconnectedPipe[path] = {
            receivers: [{req: req, res: res}]
          }
        }
      }
      break;
    default:
      console.error(`Unsupported method: ${req.method}`);
      // TODO: Error to the user
      break;
  }
});

// TODO: Hard code
server.listen(3000);
