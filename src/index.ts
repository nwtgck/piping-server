import * as http from "http";
import * as url from "url";

type ReqRes = {
  req: http.IncomingMessage,
  res: http.ServerResponse
}

interface Pipe {
  sender: ReqRes;
  receivers: ReqRes[];
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

/**
 * Type which has optional property
 */
type OptionalProperty<T> = {
  [K in keyof T]: T[K] | undefined;
};

/**
 * Optional property
 * @param obj
 */
function opt<T>(obj: T | null | undefined): OptionalProperty<T> {
  return obj || ({} as OptionalProperty<T>);
}

/**
 * Mapping for optional
 * @param f
 * @param obj
 */
function optMap<T, S>(f: (p: T) => S, obj: T | null | undefined): OptionalProperty<S> {
  if (obj === null || obj === undefined) {
    return {} as OptionalProperty<S>;
  } else {
    return f(obj);
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

  function closeReceivers(): void {
    for(let receiver of receivers) {
      receiver.res.end();
    }
  }

  // Set connected as true
  pathToConnected[path] = true;
  // Delete unconnected pipe
  delete pathToUnconnectedPipe[path];

  const {sender, receivers} = pipe;
  sender.req.on("data", (chunk)=>{
    console.log("on-data!");

    // Write to receivers
    for(let receiver of receivers) {
      receiver.res.write(chunk);
    }
  });

  sender.req.on("end", ()=>{
    console.log("on-end!");

    // Close the sender
    sender.res.shouldKeepAlive = false;
    sender.res.end("Sending Successful!\n");

    // Close receivers
    closeReceivers();

    // Delete from connected
    delete pathToConnected[path];
  });

  sender.req.on("error", (err)=>{
    console.error(`Error: ${err}`);

    // Close receivers
    closeReceivers();

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
      // The number receivers
      const nReceivers: number = 1; // TODO: Hard code (this field will be fill by query-parameter such as &n=2)
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
