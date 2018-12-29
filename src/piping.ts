import * as http from "http";
import * as url from "url";
import * as stream from "stream";
import {ParsedUrlQuery} from "querystring";
import 'core-js'; // NOTE: For use Object.values() under node 6 (lib: ["es2017"] is not enough)
import * as pkginfo from "pkginfo";
import * as Busboy from "busboy";

import {opt, optMap, tryOpt} from "./utils";
import * as path from "path";

// Set module.exports.version
pkginfo(module, 'version');

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

/**
 * Return a if a is number otherwise return b
 * @param a
 * @param b
 */
function nanOrElse<T>(a: number, b: number): number {
  if(isNaN(a)) {
    return b;
  } else {
    return a;
  }
}

// Name to reserved path
const NAME_TO_RESERVED_PATH = {
  index: "/",
  version: "/version"
};

// All reserved paths
const RESERVED_PATHS: string[] =
  Object.values(NAME_TO_RESERVED_PATH);

export class Server {
  readonly pathToConnected: {[path: string]: boolean} = {};
  readonly pathToUnconnectedPipe: {[path: string]: UnconnectedPipe} = {};

  // TODO: Write this html content as .html file
  static readonly indexPage: string = `
    <html>
    <head>
      <title>Piping</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        h3 {
          margin-top: 2em;
          margin-bottom: 0.5em;
        }
      </style>
    </head>
    <body>
      <h1>Piping</h1>
      Streaming file sending/receiving
      <form method="POST" id="file_form" enctype="multipart/form-data">
        <h3>Step 1: Choose a file</h3>
        <input type="file" name="input_file"><br>
        <h3>Step 2: Write your secret path</h3>
        (e.g. "abcd1234", "mysecret.png?n=3")<br>                  
        <input id="secret_path" placeholder="Secret path" size="50"><br>
        <h3>Step 3: Click the submit button</h3>
        <input type="submit">
      </form>
      <hr>
      Command-line usage: <a href="https://github.com/nwtgck/piping-server#readme">https://github.com/nwtgck/piping-server#readme</a><br>
      <script>
        var fileForm = document.getElementById("file_form");
        var secretPathInput = document.getElementById("secret_path");
        secretPathInput.onkeyup = function(){
          fileForm.action = "/" + secretPathInput.value;
        };
      </script>
    </body>
    </html>
    `;

  /**
   *
   * @param enableLog Enable logging
   */
  constructor(readonly enableLog: boolean){
  }

  /**
   * Start data transfer
   *
   * @param path
   * @param pipe
   */
  async runPipe(path: string, pipe: Pipe): Promise<void> {

    // Set connected as true
    this.pathToConnected[path] = true;
    // Delete unconnected pipe
    delete this.pathToUnconnectedPipe[path];

    const {sender, receivers} = pipe;

    const isMultipart: boolean = (sender.req.headers["content-type"] || "").includes("multipart/form-data");
    const senderData: NodeJS.ReadableStream = await (
        isMultipart ?
        await new Promise<NodeJS.ReadableStream>((resolve=>{
          const busboy = new Busboy({headers: sender.req.headers});
          busboy.on('file', (fieldname, file, encoding, mimetype)=>{
            resolve(file);
          });
          sender.req.pipe(busboy);
        })) :
        Promise.resolve(sender.req)
    );

    let closeCount: number = 0;
    for(const receiver of receivers) {
      // Close receiver
      const closeReceiver = (): void => {
        closeCount += 1;
        senderData.unpipe(passThrough);
        // If close-count is # of receivers
        if(closeCount === receivers.length) {
          sender.res.end("[INFO] All receivers are closed halfway\n");
          delete this.pathToConnected[path];
        }
      };

      // TODO: Should add header when isMutipart
      if(!isMultipart){
        receiver.res.writeHead(200, {
          // Add Content-Length if it exists
          ...(
            sender.req.headers["content-length"] === undefined ?
            {}: {"Content-Length": sender.req.headers["content-length"]}
          )
        });
      }

      const passThrough = new stream.PassThrough();
      senderData.pipe(passThrough);
      passThrough.pipe(receiver.res);
      receiver.req.on("close", ()=>{
        if (this.enableLog) console.log("on-close");
        closeReceiver();
      });
      receiver.req.on("error", (err)=>{
        if (this.enableLog) console.log("on-error");
        closeReceiver();
      });
    }

    senderData.on("end", ()=>{
      sender.res.end("[INFO] Sending Successful!\n");
      // Delete from connected
      delete this.pathToConnected[path];
    });

    senderData.on("error", (error)=>{
      sender.res.end("[ERROR] Sending Failed.\n");
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
    if (this.enableLog) console.log(req.method, reqPath);

    switch (req.method) {
      case "POST":
      case "PUT":
        if(RESERVED_PATHS.includes(reqPath)) {
          res.writeHead(400);
          res.end(`[ERROR] Cannot send to a reserved path '${reqPath}'. (e.g. '/mypath123')\n`);
        } else {
          // Get query parameter
          const query = opt(optMap(url.parse, req.url, true).query);
          // The number receivers
          const nReceivers: number = nanOrElse(parseInt((query as ParsedUrlQuery)['n'] as string), 1);
          // if the path have been used
          if (nReceivers <= 0) {
            res.writeHead(400);
            res.end(`[ERROR] n should > 0, but n = ${nReceivers}\n`);
          } else if (reqPath in this.pathToConnected) {
            res.writeHead(400);
            res.end(`[ERROR] Connection on '${reqPath}' has been established already\n`);
          } else {
            // Handle a sender
            this.handleSender(req, res, reqPath, nReceivers);
          }
        }
        break;
      case "GET":
        switch (reqPath) {
          case NAME_TO_RESERVED_PATH.index:
            res.end(Server.indexPage);
            break;
          case NAME_TO_RESERVED_PATH.version:
            // (from: https://stackoverflow.com/a/22339262/2885946)
            res.end(module.exports.version+"\n");
            break;
          default:
            // Handle a receiver
            this.handleReceiver(req, res, reqPath);
            break;
        }
        break;
      default:
        res.end(`Error: Unsupported method: ${req.method}\n`);
        break;
    }
  };

  /**
   * Handle a sender
   * @param {"http".IncomingMessage} req
   * @param {"http".ServerResponse} res
   * @param {string} reqPath
   * @param {number} nReceivers
   */
  private handleSender(req: http.IncomingMessage, res: http.ServerResponse, reqPath: string, nReceivers: number): void {
    if (this.enableLog) console.log(this.pathToUnconnectedPipe);
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
        res.write(`[INFO] Waiting for ${nReceivers} receivers...\n`);
        // Send the number of receivers information
        res.write(`[INFO] ${unconnectedPipe.receivers.length} receivers have been connected.\n`);
        if (droppedReceivers.length > 0) {
          // Send the number of dropped receivers
          res.write(`[INFO] ${droppedReceivers.length} receivers have been dropped because of connection limits.\n`);
        }

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
        res.end(`[ERROR] Other sender has been registered on '${reqPath}'\n`);
      }
    } else {
      // Send waiting message
      res.write(`[INFO] Waiting for ${nReceivers} receivers...\n`);

      // Register new unconnected pipe
      this.pathToUnconnectedPipe[reqPath] = {
        sender: {req: req, res: res},
        receivers: [],
        nReceivers: nReceivers
      };
    }
  }

  /**
   * Handle a receiver
   * @param {"http".IncomingMessage} req
   * @param {"http".ServerResponse} res
   * @param {string} reqPath
   */
  private handleReceiver(req: http.IncomingMessage, res: http.ServerResponse, reqPath: string): void {
    // If connection has been established
    if (reqPath in this.pathToConnected) {
      res.writeHead(400);
      res.end(`Error: Connection on '${reqPath}' has been established already\n`);
    } else {
      if (reqPath in this.pathToUnconnectedPipe) {
        // Get unconnectedPipe
        const unconnectedPipe: UnconnectedPipe = this.pathToUnconnectedPipe[reqPath];
        if (unconnectedPipe.nReceivers === undefined || unconnectedPipe.receivers.length < unconnectedPipe.nReceivers) {
          // Append new receiver
          unconnectedPipe.receivers.push({req: req, res: res});

          if(unconnectedPipe.sender !== undefined) {
            // Send connection message to the sender
            unconnectedPipe.sender.res.write("[INFO] A receiver is connected.\n");
          }

          // Get pipeOpt if connected
          const pipe: Pipe | undefined =
            getPipeIfConnected(unconnectedPipe);

          if (pipe !== undefined) {
            // Emit message to sender
            pipe.sender.res.write(`[INFO] Start sending with ${pipe.receivers.length} receivers!\n`);
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
}
