import * as piping from "./piping";

// Create a piping server
const pipingServer = new piping.Server();

// Listen on the port
// TODO: Hard code
pipingServer.server.listen(3000);
