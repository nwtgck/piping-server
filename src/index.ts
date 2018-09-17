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

interface IncompletePipe {
  sender?: ReqRes;
  receivers: ReqRes[];
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

// const pathToPipe: {[path: string]: Pipe} = {};
const pathToIncompletePipe: {[path: string]: IncompletePipe} = {};

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse)=>{
  // Get path name
  const path: string =
    opt(optMap(url.parse, opt(req.url)).pathname)
      // Remove last "/"
      .replace(/\/$/, "");
  console.log(path);

  switch (req.method) {
    case "POST":
      // TODO: Check key "path" existence
      pathToIncompletePipe[path] = {
        sender: {req: req, res: res},
        receivers: []
      };
      break;
    case "GET":
      // Get a sender
      // TODO: Check key "path" existence
      const {sender} = pathToIncompletePipe[path];
      if (sender !== undefined) {

        sender.req.on("data", (chunk)=>{
          res.write(chunk);
        });

        sender.req.on("end", ()=>{
          console.log("on-end!");

          // Close the sender
          sender.res.shouldKeepAlive = false;
          sender.res.end("Sending Successful!\n");

          // Close a reciever
          res.end();
        });
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
