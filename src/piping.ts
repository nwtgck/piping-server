import * as http from "http";
import * as http2 from "http2";
import * as log4js from "log4js";
import * as multiparty from "multiparty";
import {ParsedUrlQuery} from "querystring";
import * as stream from "stream";
import * as url from "url";

import {OptionalProperty, optMap} from "./utils";
import {VERSION} from "./version";

type HttpReq = http.IncomingMessage | http2.Http2ServerRequest;
type HttpRes = http.ServerResponse | http2.Http2ServerResponse;

type ReqRes = {
  readonly req: HttpReq,
  readonly res: HttpRes
};

type Pipe = {
  readonly sender: ReqRes;
  readonly receivers: ReadonlyArray<ReqRes>;
};

type ReqResAndUnsubscribe = {
  reqRes: ReqRes,
  unsubscribeCloseListener: () => void
};

type UnestablishedPipe = {
  sender?: ReqResAndUnsubscribe;
  receivers: ReqResAndUnsubscribe[];
  nReceivers: number;
};

type Handler = (req: HttpReq, res: HttpRes) => void;

/**
 * Convert unestablished pipe to pipe if it is established
 * @param p
 */
function getPipeIfEstablished(p: UnestablishedPipe): Pipe | undefined {
  if (p.sender !== undefined && p.receivers.length === p.nReceivers) {
    return {
      sender: p.sender.reqRes,
      receivers: p.receivers.map((r) => {
        // Unsubscribe on-close handlers
        // NOTE: this operation has side-effect
        r.unsubscribeCloseListener();
        return r.reqRes;
      })
    };
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
  if (isNaN(a)) {
    return b;
  } else {
    return a;
  }
}

// Name to reserved path
const NAME_TO_RESERVED_PATH = {
  index: "/",
  version: "/version",
  help: "/help",
  faviconIco: "/favicon.ico",
  robotsTxt: "/robots.txt"
};

const indexPage: string =
`<!DOCTYPE html>
<html lang="en">
<head>
  <title>Piping Server</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    h1 {
      display: inline;
    }
    h3 {
      margin-top: 2em;
      margin-bottom: 0.5em;
    }
  </style>
</head>
<body>
<h1>Piping Server</h1>
<span>${VERSION}</span>

<p>Streaming Data Transfer Server over HTTP/HTTPS</p>
<h3>Step 1: Choose a file or text</h3>

<input type="checkbox" id="text_mode" onchange="toggleInputMode()">: <b>Text mode</b><br><br>

<input type="file" id="file_input">
<textarea id="text_input" placeholder="Input text" cols="30" rows="10"></textarea>
<br>

<h3>Step 2: Write your secret path</h3>
(e.g. "abcd1234", "mysecret.png")<br>
<input id="secret_path" placeholder="Secret path" size="50"><br>
<h3>Step 3: Click the send button</h3>
<button onclick="send()">Send</button><br>
<progress id="progress_bar" value="0" max="100" style="display: none"></progress><br>
<div id="message"></div>
<hr>
Piping UI for Web: <a href="https://piping-ui.org">https://piping-ui.org</a><br>
Command-line usage:
<a href="https://github.com/nwtgck/piping-server#readme">
  https://github.com/nwtgck/piping-server#readme
</a><br>
<script>
  // Toggle input mode: file or text
  var toggleInputMode = (function () {
    var activeInput      = window.file_input;
    var deactivatedInput = window.text_input;
    // Set inputs' functionality and visibility
    function setInputs() {
      activeInput.removeAttribute("disabled");
      activeInput.style.removeProperty("display");
      deactivatedInput.setAttribute("disabled", "");
      deactivatedInput.style.display = "none";
    }
    setInputs();
    // Body of toggleInputMode
    function toggle() {
      // Swap inputs
      var tmpInput     = activeInput;
      activeInput      = deactivatedInput;
      deactivatedInput = tmpInput;
      setInputs();
    }
    return toggle;
  })();
  function setMessage(msg) {
    window.message.innerText = msg;
  }
  function setProgress(loaded, total) {
    var progress = (total === 0) ? 0 : loaded / total * 100;
    window.progress_bar.value = progress;
    setMessage(loaded + "B (" + progress.toFixed(2) + "%)");
  }
  function hideProgress() {
    window.progress_bar.style.display = "none";
  }
  function send() {
    // Select body (text or file)
    var body = window.text_mode.checked ? window.text_input.value : window.file_input.files[0];
    // Send
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/" + window.secret_path.value, true);
    // If file has no type
    if (!window.text_mode.checked && body.type === "") {
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
    }
    // Update progress bar
    xhr.upload.onprogress = function (e) {
      setProgress(e.loaded, e.total);
    };
    xhr.upload.onload = function (e) {
      // Send finished
      if (xhr.status === 200) {
        setProgress(e.loaded, e.total);
      }
    };
    xhr.onload = function () {
      // Status code error
      if (xhr.status !== 200) {
        setMessage(xhr.responseText);
        hideProgress();
      }
    };
    xhr.onerror = function () {
      setMessage("Upload error");
      hideProgress();
    };
    xhr.send(body);
    // Show progress bar
    window.progress_bar.style.removeProperty("display");
  }
</script>
</body>
</html>
`;

/**
 * Generate help page
 * @param {string} url
 * @returns {string}
 */
// tslint:disable-next-line:no-shadowed-variable
function generateHelpPage(url: string): string {
  return (
`Help for Piping Server ${VERSION}
(Repository: https://github.com/nwtgck/piping-server)

======= Get  =======
curl ${url}/mypath

======= Send =======
# Send a file
curl -T myfile ${url}/mypath

# Send a text
echo 'hello!' | curl -T - ${url}/mypath

# Send a directory (zip)
zip -q -r - ./mydir | curl -T - ${url}/mypath

# Send a directory (tar.gz)
tar zfcp - ./mydir | curl -T - ${url}/mypath

# Encryption
## Send
cat myfile | openssl aes-256-cbc | curl -T - ${url}/mypath
## Get
curl ${url}/mypath | openssl aes-256-cbc -d
`);
}

// All reserved paths
const RESERVED_PATHS: string[] =
  Object.values(NAME_TO_RESERVED_PATH);

export class Server {

  /** Get the number of receivers
   * @param {string | undefined} reqUrl
   * @returns {number}
   */
  private static getNReceivers(reqUrl: string | undefined): number {
    // Get query parameter
    const query: ParsedUrlQuery | undefined =
      // tslint:disable-next-line:max-line-length
      // NOTE: Return type casting is safe because function parse(urlStr: string, parseQueryString: true, slashesDenoteHost?: boolean): UrlWithParsedQuery;
      (optMap(url.parse, reqUrl, true) as OptionalProperty<url.UrlWithParsedQuery>)
      .query;
    // The number receivers
    // NOTE: parseInt(undefined, 10) is NaN
    const nReceivers: number = nanOrElse(parseInt((query?.n as string ?? "1"), 10), 1);
    return nReceivers;
  }
  private readonly pathToEstablished: {[path: string]: boolean} = {};
  private readonly pathToUnestablishedPipe: {[path: string]: UnestablishedPipe} = {};

  /**
   *
   * @param logger
   */
  constructor(readonly logger: log4js.Logger) {
  }

  public generateHandler(useHttps: boolean): Handler {
    return (req: HttpReq, res: HttpRes) => {
      // Get path name
      const reqPath: string =
          url.resolve(
            "/",
            optMap(url.parse, req.url).pathname?.
              // Remove last "/"
              replace(/\/$/, "") ?? ""
          );
      this.logger.info(`${req.method} ${req.url}`);

      switch (req.method) {
        case "POST":
        case "PUT":
          if (RESERVED_PATHS.includes(reqPath)) {
            res.writeHead(400, {
              "Access-Control-Allow-Origin": "*"
            });
            res.end(`[ERROR] Cannot send to the reserved path '${reqPath}'. (e.g. '/mypath123')\n` as any);
          } else {
            // Handle a sender
            this.handleSender(req, res, reqPath);
          }
          break;
        case "GET":
          switch (reqPath) {
            case NAME_TO_RESERVED_PATH.index:
              res.writeHead(200, {
                "Content-Length": Buffer.byteLength(indexPage),
                "Content-Type": "text/html"
              });
              res.end(indexPage as any);
              break;
            case NAME_TO_RESERVED_PATH.version:
              const versionPage: string = VERSION + "\n";
              res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Content-Length": Buffer.byteLength(versionPage),
                "Content-Type": "text/plain"
              });
              res.end(versionPage as any);
              break;
            case NAME_TO_RESERVED_PATH.help:
              // x-forwarded-proto is https or not
              const xForwardedProtoIsHttps: boolean = (() => {
                const proto = req.headers["x-forwarded-proto"];
                // NOTE: includes() is for supporting Glitch
                return proto !== undefined && proto.includes("https");
              })();
              const scheme: string = (useHttps || xForwardedProtoIsHttps) ? "https" : "http";
              // NOTE: req.headers.host contains port number
              const hostname: string = req.headers.host ?? "hostname";
              // tslint:disable-next-line:no-shadowed-variable
              const url = `${scheme}://${hostname}`;

              const helpPage: string = generateHelpPage(url);
              res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Content-Length": Buffer.byteLength(helpPage),
                "Content-Type": "text/plain"
              });
              res.end(helpPage as any);
              break;
            case NAME_TO_RESERVED_PATH.faviconIco:
              // (from: https://stackoverflow.com/a/35408810/2885946)
              res.writeHead(204);
              res.end();
              break;
            case NAME_TO_RESERVED_PATH.robotsTxt:
              res.writeHead(404);
              res.end();
              break;
            default:
              // Handle a receiver
              this.handleReceiver(req, res, reqPath);
              break;
          }
          break;
        case "OPTIONS":
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Content-Disposition",
            "Access-Control-Max-Age": 86400,
            "Content-Length": 0
          });
          res.end();
          break;
        default:
          res.end(`[ERROR] Unsupported method: ${req.method}.\n` as any);
          break;
      }
    };
  }

  /**
   * Start data transfer
   *
   * @param path
   * @param pipe
   */
  // tslint:disable-next-line:no-shadowed-variable
  private async runPipe(path: string, pipe: Pipe): Promise<void> {
    // Set established as true
    this.pathToEstablished[path] = true;
    // Delete unestablished pipe
    delete this.pathToUnestablishedPipe[path];

    const {sender, receivers} = pipe;

    // Emit message to sender
    sender.res.write(`[INFO] Start sending to ${pipe.receivers.length} receiver(s)!\n`);

    this.logger.info(`Sending: path='${path}', receivers=${pipe.receivers.length}`);

    const isMultipart: boolean = (sender.req.headers["content-type"] ?? "").includes("multipart/form-data");

    const part: multiparty.Part | undefined =
      isMultipart ?
        await new Promise((resolve, reject) => {
          const form = new multiparty.Form();
          form.once("part", (p: multiparty.Part) => {
            resolve(p);
          });
          form.on("error", () => {
            this.logger.info(`sender-multipart on-error: '${path}'`);
          });
          // TODO: Not use any
          form.parse(sender.req as any);
        }) :
        undefined;

    const senderData: stream.Readable =
      part === undefined ? sender.req : part;

    let closeCount: number = 0;
    for (const receiver of receivers) {
      // Close receiver
      const closeReceiver = (): void => {
        closeCount += 1;
        senderData.unpipe(passThrough);
        // If close-count is # of receivers
        if (closeCount === receivers.length) {
          sender.res.end("[INFO] All receiver(s) was/were closed halfway.\n" as any);
          delete this.pathToEstablished[path];
          // Close sender
          sender.req.destroy();
        }
      };

      // Decide Content-Length
      const contentLength: string | number | undefined = part === undefined ?
        sender.req.headers["content-length"] : part.byteCount;
      // Get Content-Type from part or HTTP header.
      const contentType: string | undefined = (() => {
        const type: string | undefined = (part === undefined ?
          sender.req.headers["content-type"] : part.headers["content-type"]);
        if (type === undefined) {
          return undefined;
        }
        const matched = type.match(/^\s*([^;]*)(\s*;?.*)$/);
        // If invalid Content-Type
        if (matched === null) {
          return undefined;
        } else {
          // Extract MIME type and parameters
          const mimeType: string = matched[1];
          const params: string = matched[2];
          // If it is text/html, it should replace it with text/plain not to render in browser.
          // It is the same as GitHub Raw (https://raw.githubusercontent.com).
          // "text/plain" can be consider a superordinate concept of "text/html"
          return mimeType === "text/html" ? "text/plain" + params : type;
        }
      })();
      const contentDisposition: string | undefined = part === undefined ?
        sender.req.headers["content-disposition"] : part.headers["content-disposition"];

      // Write headers to a receiver
      receiver.res.writeHead(200, {
        ...(contentLength === undefined ? {} : {"Content-Length": contentLength}),
        ...(contentType === undefined ? {} : {"Content-Type": contentType}),
        ...(contentDisposition === undefined ? {} : {"Content-Disposition": contentDisposition}),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Type",
        "X-Content-Type-Options": "nosniff"
      });

      const passThrough = new stream.PassThrough();
      senderData.pipe(passThrough);
      // TODO: Not use any
      passThrough.pipe(receiver.res as any);
      receiver.req.on("end", () => {
        this.logger.info(`receiver on-end: '${path}'`);
      });
      receiver.req.on("close", () => {
        this.logger.info(`receiver on-close: '${path}'`);
        closeReceiver();
      });
      receiver.req.on("error", (err) => {
        this.logger.info(`receiver on-error: '${path}'`);
        closeReceiver();
      });
    }

    senderData.on("close", () => {
      for (const receiver of receivers) {
        // Close a receiver
        if (receiver.res.connection !== undefined) {
          receiver.res.connection.destroy();
        }
      }
      this.logger.info(`sender on-close: '${path}'`);
    });

    senderData.on("end", () => {
      sender.res.end("[INFO] Sent successfully!\n" as any);
      // Delete from established
      delete this.pathToEstablished[path];
      this.logger.info(`sender on-end: '${path}'`);
    });

    senderData.on("error", (error) => {
      sender.res.end("[ERROR] Failed to send.\n" as any);
      // Delete from established
      delete this.pathToEstablished[path];
      this.logger.info(`sender on-error: '${path}'`);
    });
  }

  /**
   * Handle a sender
   * @param {HttpReq} req
   * @param {HttpRes} res
   * @param {string} reqPath
   */
  private handleSender(req: HttpReq, res: HttpRes, reqPath: string): void {
    // Get the number of receivers
    const nReceivers = Server.getNReceivers(req.url);
    // If the number of receivers is invalid
    if (nReceivers <= 0) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] n should > 0, but n = ${nReceivers}.\n` as any);
    } else if (reqPath in this.pathToEstablished) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Connection on '${reqPath}' has been established already.\n` as any);
    } else {
      // If the path connection is connecting
      if (reqPath in this.pathToUnestablishedPipe) {
        // Get unestablished pipe
        const unestablishedPipe: UnestablishedPipe = this.pathToUnestablishedPipe[reqPath];
        // If a sender have not been registered yet
        if (unestablishedPipe.sender === undefined) {
          // If the number of receivers is the same size as connecting pipe's one
          if (nReceivers === unestablishedPipe.nReceivers) {
            // Register the sender
            unestablishedPipe.sender = this.createSenderOrReceiver("sender", req, res, reqPath);
            // Add headers
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*"
            });
            // Send waiting message
            res.write(`[INFO] Waiting for ${nReceivers} receiver(s)...\n`);
            // Send the number of receivers information
            res.write(`[INFO] ${unestablishedPipe.receivers.length} receiver(s) has/have been connected.\n`);
            // Get pipeOpt if established
            const pipe: Pipe | undefined =
              getPipeIfEstablished(unestablishedPipe);

            if (pipe !== undefined) {
              // Start data transfer
              this.runPipe(reqPath, pipe);
            }
          } else {
            res.writeHead(400, {
              "Access-Control-Allow-Origin": "*"
            });
            res.end(
              `[ERROR] The number of receivers should be ${unestablishedPipe.nReceivers} but ${nReceivers}.\n` as any
            );
          }
        } else {
          res.writeHead(400, {
            "Access-Control-Allow-Origin": "*"
          });
          res.end(`[ERROR] Another sender has been connected on '${reqPath}'.\n` as any);
        }
      } else {
        // Add headers
        res.writeHead(200, {
          "Access-Control-Allow-Origin": "*"
        });
        // Send waiting message
        res.write(`[INFO] Waiting for ${nReceivers} receiver(s)...\n`);
        // Create a sender
        const sender = this.createSenderOrReceiver("sender", req, res, reqPath);
        // Register new unestablished pipe
        this.pathToUnestablishedPipe[reqPath] = {
          sender: sender,
          receivers: [],
          nReceivers: nReceivers
        };
      }
    }
  }

  /**
   * Handle a receiver
   * @param {HttpReq} req
   * @param {HttpReqs} res
   * @param {string} reqPath
   */
  private handleReceiver(req: HttpReq, res: HttpRes, reqPath: string): void {
    // If the receiver requests Service Worker registration
    // (from: https://speakerdeck.com/masatokinugawa/pwa-study-sw?slide=32)"
    if (req.headers["service-worker"] === "script") {
      // Reject Service Worker registration
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Service Worker registration is rejected.\n` as any);
      return;
    }
    // Get the number of receivers
    const nReceivers = Server.getNReceivers(req.url);
    // If the number of receivers is invalid
    if (nReceivers <= 0) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] n should > 0, but n = ${nReceivers}.\n` as any);
    } else if (reqPath in this.pathToEstablished) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Connection on '${reqPath}' has been established already.\n` as any);
    } else {
      // If the path connection is connecting
      if (reqPath in this.pathToUnestablishedPipe) {
        // Get unestablishedPipe
        const unestablishedPipe: UnestablishedPipe = this.pathToUnestablishedPipe[reqPath];
        // If the number of receivers is the same size as connecting pipe's one
        if (nReceivers === unestablishedPipe.nReceivers) {
          // If more receivers can connect
          if (unestablishedPipe.receivers.length < unestablishedPipe.nReceivers) {
            // Create a receiver
            const receiver = this.createSenderOrReceiver("receiver", req, res, reqPath);
            // Append new receiver
            unestablishedPipe.receivers.push(receiver);

            if (unestablishedPipe.sender !== undefined) {
              // Send connection message to the sender
              unestablishedPipe.sender.reqRes.res.write("[INFO] A receiver was connected.\n");
            }

            // Get pipeOpt if established
            const pipe: Pipe | undefined =
              getPipeIfEstablished(unestablishedPipe);

            if (pipe !== undefined) {
              // Start data transfer
              this.runPipe(reqPath, pipe);
            }
          } else {
            res.writeHead(400, {
              "Access-Control-Allow-Origin": "*"
            });
            res.end("[ERROR] The number of receivers has reached limits.\n" as any);
          }
        } else {
          res.writeHead(400, {
            "Access-Control-Allow-Origin": "*"
          });
          res.end(
            `[ERROR] The number of receivers should be ${unestablishedPipe.nReceivers} but ${nReceivers}.\n` as any
          );
        }
      } else {
        // Create a receiver
        const receiver = this.createSenderOrReceiver("receiver", req, res, reqPath);
        // Set a receiver
        this.pathToUnestablishedPipe[reqPath] = {
          receivers: [receiver],
          nReceivers: nReceivers
        };
      }
    }
  }

  /**
   * Create a sender or receiver
   *
   * Main purpose of this method is creating sender/receiver which unregisters unestablished pipe before establish
   *
   * @param removerType
   * @param req
   * @param res
   * @param reqPath
   */
  private createSenderOrReceiver(
    removerType: "sender" | "receiver",
    req: HttpReq,
    res: HttpRes,
    reqPath: string
  ): ReqResAndUnsubscribe {
    // Create receiver req&res
    const receiverReqRes: ReqRes = {req: req, res: res};
    // Define on-close handler
    const closeListener = () => {
      // If reqPath is registered
      if (reqPath in this.pathToUnestablishedPipe) {
        // Get unestablished pipe
        const unestablishedPipe = this.pathToUnestablishedPipe[reqPath];
        // Get sender/receiver remover
        const remover =
          removerType === "sender" ?
            (): boolean => {
              // If sender is defined
              if (unestablishedPipe.sender !== undefined) {
                // Remove sender
                unestablishedPipe.sender = undefined;
                return true;
              }
              return false;
            } :
            (): boolean => {
              // Get receivers
              const receivers = unestablishedPipe.receivers;
              // Find receiver's index
              const idx = receivers.findIndex((r) => r.reqRes === receiverReqRes);
              // If receiver is found
              if (idx !== -1) {
                // Delete the receiver from the receivers
                receivers.splice(idx, 1);
                return true;
              }
              return false;
            };
        // Remove a sender or receiver
        const removed: boolean = remover();
        // If removed
        if (removed) {
          // If unestablished pipe has no sender and no receivers
          if (unestablishedPipe.receivers.length === 0 && unestablishedPipe.sender === undefined) {
            // Remove unestablished pipe
            delete this.pathToUnestablishedPipe[reqPath];
            this.logger.info(`'${reqPath}' removed`);
          }
        }
      }
    };
    // Disconnect if it close
    req.once("close", closeListener);
    // Unsubscribe "close"
    const unsubscribeCloseListener = () => {
      req.removeListener("close", closeListener);
    };
    return {
      reqRes: receiverReqRes,
      unsubscribeCloseListener: unsubscribeCloseListener
    };
  }
}
