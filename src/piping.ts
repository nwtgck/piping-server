import * as http from "http";
import * as http2 from "http2";
import * as log4js from "log4js";
import * as multiparty from "multiparty";
import * as stream from "stream";

import * as resources from "./resources";
import {VERSION} from "./version";
import {NAME_TO_RESERVED_PATH, RESERVED_PATHS} from "./reserved-paths";
import * as utils from "./utils";

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
  readonly reqRes: ReqRes,
  readonly unsubscribeCloseListener: () => void
};

type UnestablishedPipe = {
  sender?: ReqResAndUnsubscribe;
  readonly receivers: ReqResAndUnsubscribe[];
  readonly nReceivers: number;
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

export const noScriptPathQueryParameterName = "path";

export class Server {

  /** Get the number of receivers
   * @param {URL} reqUrl
   * @returns {number}
   */
  private static getNReceivers(reqUrl: URL): number {
    return parseInt(reqUrl.searchParams.get('n') ?? "1", 10)
  }
  private readonly pathToEstablished: Set<string> = new Set();
  private readonly pathToUnestablishedPipe: Map<string, UnestablishedPipe> = new Map();

  /**
   *
   * @param params
   */
  constructor(readonly params: {
    readonly logger?: log4js.Logger
  } = {}) { }

  public generateHandler(useHttps: boolean): Handler {
    return (req: HttpReq, res: HttpRes) => {
      const reqUrl = new URL(req.url ?? "", "a:///");
      // Get path name
      const reqPath = reqUrl.pathname;
      this.params.logger?.info(`${req.method} ${req.url}`);

      switch (req.method) {
        case "POST":
        case "PUT":
          if (RESERVED_PATHS.includes(reqPath)) {
            res.writeHead(400, {
              "Access-Control-Allow-Origin": "*"
            });
            res.end(`[ERROR] Cannot send to the reserved path '${reqPath}'. (e.g. '/mypath123')\n`);
            return;
          }
          // Notify that Content-Range is not supported
          // In the future, resumable upload using Content-Range might be supported
          // ref: https://github.com/httpwg/http-core/pull/653
          if (req.headers["content-range"] !== undefined) {
            res.writeHead(400, {
              "Access-Control-Allow-Origin": "*"
            });
            res.end(`[ERROR] Content-Range is not supported for now in ${req.method}\n`);
            return;
          }
          // Handle a sender
          this.handleSender(req, res, reqUrl);
          break;
        case "GET":
          switch (reqPath) {
            case NAME_TO_RESERVED_PATH.index:
              res.writeHead(200, {
                "Content-Length": Buffer.byteLength(resources.indexPage),
                "Content-Type": "text/html"
              });
              res.end(resources.indexPage);
              break;
            case NAME_TO_RESERVED_PATH.noscript: {
              const path = reqUrl.searchParams.get(noScriptPathQueryParameterName);
              const html = resources.noScriptHtml(path ?? "");
              res.writeHead(200, {
                "Content-Length": Buffer.byteLength(html),
                "Content-Type": "text/html"
              });
              res.end(html);
              break;
            }
            case NAME_TO_RESERVED_PATH.version:
              const versionPage: string = VERSION + "\n";
              res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Content-Length": Buffer.byteLength(versionPage),
                "Content-Type": "text/plain"
              });
              res.end(versionPage);
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

              const helpPage: string = resources.generateHelpPage(url);
              res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Content-Length": Buffer.byteLength(helpPage),
                "Content-Type": "text/plain"
              });
              res.end(helpPage);
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
              this.handleReceiver(req, res, reqUrl);
              break;
          }
          break;
        case "OPTIONS":
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Content-Disposition, X-Piping",
            "Access-Control-Max-Age": 86400,
            "Content-Length": 0
          });
          res.end();
          break;
        default:
          res.writeHead(405, {
            "Access-Control-Allow-Origin": "*",
            "Allow": "GET, HEAD, POST, PUT, OPTIONS",
          });
          res.end(`[ERROR] Unsupported method: ${req.method}.\n`);
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
    // Add to established
    this.pathToEstablished.add(path);
    // Delete unestablished pipe
    this.pathToUnestablishedPipe.delete(path);

    const {sender, receivers} = pipe;

    // Emit message to sender
    sender.res.write(`[INFO] Start sending to ${pipe.receivers.length} receiver(s)!\n`);

    this.params.logger?.info(`Sending: path='${path}', receivers=${pipe.receivers.length}`);

    const isMultipart: boolean = (sender.req.headers["content-type"] ?? "").includes("multipart/form-data");

    const part: multiparty.Part | undefined =
      isMultipart ?
        await new Promise((resolve, reject) => {
          const form = new multiparty.Form();
          form.once("part", (p: multiparty.Part) => {
            resolve(p);
          });
          form.on("error", () => {
            this.params.logger?.info(`sender-multipart on-error: '${path}'`);
          });
          // TODO: Not use any
          form.parse(sender.req as any);
        }) :
        undefined;

    const senderData: stream.Readable =
      part === undefined ? sender.req : part;

    let abortedCount: number = 0;
    let endCount: number = 0;
    for (const receiver of receivers) {
      // Close receiver
      const abortedListener = (): void => {
        abortedCount++;
        sender.res.write("[INFO] A receiver aborted.\n");
        senderData.unpipe(passThrough);
        // If aborted-count is # of receivers
        if (abortedCount === receivers.length) {
          sender.res.end("[INFO] All receiver(s) was/were aborted halfway.\n");
          // Delete from established
          this.removeEstablished(path);
          // Close sender
          sender.req.destroy();
        }
      };
      // End
      const endListener = (): void => {
        endCount++;
        // If end-count is # of receivers
        if (endCount === receivers.length) {
          sender.res.end("[INFO] All receiver(s) was/were received successfully.\n");
          // Delete from established
          this.removeEstablished(path);
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
      const parseHeaders = utils.parseHeaders(sender.req.rawHeaders);
      const xPiping: string[] = parseHeaders.get("x-piping") ?? [];

      // Write headers to a receiver
      receiver.res.writeHead(200, {
        ...(contentLength === undefined ? {} : {"Content-Length": contentLength}),
        ...(contentType === undefined ? {} : {"Content-Type": contentType}),
        ...(contentDisposition === undefined ? {} : {"Content-Disposition": contentDisposition}),
        "X-Piping": xPiping,
        "Access-Control-Allow-Origin": "*",
        ...(xPiping.length === 0 ? {} : {"Access-Control-Expose-Headers": "X-Piping"}),
        "X-Robots-Tag": "none",
      });

      const passThrough = new stream.PassThrough();
      senderData.pipe(passThrough);
      // TODO: Not use any
      passThrough.pipe(receiver.res as any);
      receiver.req.on("end", () => {
        this.params.logger?.info(`receiver on-end: '${path}'`);
        endListener();
      });
      receiver.req.on("close", () => {
        this.params.logger?.info(`receiver on-close: '${path}'`);
      });
      receiver.req.on("aborted", () => {
        this.params.logger?.info(`receiver on-aborted: '${path}'`);
        abortedListener();
      });
      receiver.req.on("error", (err) => {
        this.params.logger?.info(`receiver on-error: '${path}'`);
        abortedListener();
      });
    }

    senderData.on("close", () => {
      this.params.logger?.info(`sender on-close: '${path}'`);
    });

    senderData.on("aborted", () => {
      for (const receiver of receivers) {
        // Close a receiver
        if (receiver.res.connection !== undefined && receiver.res.connection !== null) {
          receiver.res.connection.destroy();
        }
      }
      this.params.logger?.info(`sender on-aborted: '${path}'`);
    });

    senderData.on("end", () => {
      sender.res.write("[INFO] Sent successfully!\n");
      this.params.logger?.info(`sender on-end: '${path}'`);
    });

    senderData.on("error", (error) => {
      sender.res.end("[ERROR] Failed to send.\n");
      // Delete from established
      this.removeEstablished(path);
      this.params.logger?.info(`sender on-error: '${path}'`);
    });
  }

  // Delete from established
  private removeEstablished(path: string): void {
    this.pathToEstablished.delete(path);
    this.params.logger?.info(`established '${path}' removed`);
  }

  /**
   * Handle a sender
   * @param {HttpReq} req
   * @param {HttpRes} res
   * @param {URL} reqUrl
   */
  private handleSender(req: HttpReq, res: HttpRes, reqUrl: URL): void {
    const reqPath = reqUrl.pathname;
    // Get the number of receivers
    const nReceivers = Server.getNReceivers(reqUrl);
    if (Number.isNaN(nReceivers)) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Invalid "n" query parameter\n`);
      return;
    }
    // If the number of receivers is invalid
    if (nReceivers <= 0) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] n should > 0, but n = ${nReceivers}.\n`);
      return;
    }
    if (this.pathToEstablished.has(reqPath)) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Connection on '${reqPath}' has been established already.\n`);
      return;
    }
    // Get unestablished pipe
    const unestablishedPipe = this.pathToUnestablishedPipe.get(reqPath);
    // If the path connection is not connecting
    if (unestablishedPipe === undefined) {
      // Add headers
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*"
      });
      // Send waiting message
      res.write(`[INFO] Waiting for ${nReceivers} receiver(s)...\n`);
      // Create a sender
      const sender = this.createSenderOrReceiver("sender", req, res, reqPath);
      // Register new unestablished pipe
      this.pathToUnestablishedPipe.set(reqPath, {
        sender: sender,
        receivers: [],
        nReceivers: nReceivers
      });
      return;
    }
    // If a sender has been connected already
    if (unestablishedPipe.sender !== undefined) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Another sender has been connected on '${reqPath}'.\n`);
      return;
    }
    // If the number of receivers is not the same size as connecting pipe's one
    if (nReceivers !== unestablishedPipe.nReceivers) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] The number of receivers should be ${unestablishedPipe.nReceivers} but ${nReceivers}.\n`);
      return;
    }
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
  }

  /**
   * Handle a receiver
   * @param {HttpReq} req
   * @param {HttpRes} res
   * @param {URL} reqUrl
   */
  private handleReceiver(req: HttpReq, res: HttpRes, reqUrl: URL): void {
    const reqPath = reqUrl.pathname;
    // If the receiver requests Service Worker registration
    // (from: https://speakerdeck.com/masatokinugawa/pwa-study-sw?slide=32)"
    if (req.headers["service-worker"] === "script") {
      // Reject Service Worker registration
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Service Worker registration is rejected.\n`);
      return;
    }
    // Get the number of receivers
    const nReceivers = Server.getNReceivers(reqUrl);
    if (Number.isNaN(nReceivers)) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Invalid query parameter "n"\n`);
      return;
    }
    // If the number of receivers is invalid
    if (nReceivers <= 0) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] n should > 0, but n = ${nReceivers}.\n`);
      return;
    }
    // The connection has been established already
    if (this.pathToEstablished.has(reqPath)) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] Connection on '${reqPath}' has been established already.\n`);
      return;
    }
    // Get unestablishedPipe
    const unestablishedPipe = this.pathToUnestablishedPipe.get(reqPath);
    // If the path connection is not connecting
    if (unestablishedPipe === undefined) {
      // Create a receiver
      /* tslint:disable:no-shadowed-variable */
      const receiver = this.createSenderOrReceiver("receiver", req, res, reqPath);
      // Set a receiver
      this.pathToUnestablishedPipe.set(reqPath, {
        receivers: [receiver],
        nReceivers: nReceivers
      });
      return;
    }
    // If the number of receivers is not the same size as connecting pipe's one
    if (nReceivers !== unestablishedPipe.nReceivers) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end(`[ERROR] The number of receivers should be ${unestablishedPipe.nReceivers} but ${nReceivers}.\n`);
      return;
    }
    // If more receivers can not connect
    if (unestablishedPipe.receivers.length === unestablishedPipe.nReceivers) {
      res.writeHead(400, {
        "Access-Control-Allow-Origin": "*"
      });
      res.end("[ERROR] The number of receivers has reached limits.\n");
      return;
    }

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
    const receiverReqRes: ReqRes = { req: req, res: res };
    // Define on-close handler
    const closeListener = () => {
      // Get unestablished pipe
      const unestablishedPipe = this.pathToUnestablishedPipe.get(reqPath);
      // If the pipe is registered
      if (unestablishedPipe !== undefined) {
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
            this.pathToUnestablishedPipe.delete(reqPath);
            this.params.logger?.info(`unestablished '${reqPath}' removed`);
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
