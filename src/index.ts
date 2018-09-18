import * as http from "http";
import * as https from "https";
import * as fs from "fs";

import * as piping from "./piping";

// TODO: Hard code
const serverKeyPath: string = "./ssl_certs/server.key";
const serverCrtPath: string = "./ssl_certs/server.crt";

// Create a piping server
const pipingServer = new piping.Server();

http.createServer(pipingServer.handler)
  .listen(3000); // TODO: Hard code

https.createServer(
  {
    key: fs.readFileSync(serverKeyPath),
    cert: fs.readFileSync(serverCrtPath)
  },
  pipingServer.handler
).listen(4443); // TODO: Hard code

