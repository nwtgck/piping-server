import * as piping  from '../src/piping';
import * as assert from 'power-assert';
import * as http from "http";
import thenRequest from "then-request";

describe('piping.Server', () => {
  it('should allow a sender and a receiver to connect in this order', async () => {

    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await new Promise<void>((resolve)=>{
      pipingServer.listen(pipingPort, resolve);
    });

    // Send data
    // (NOTE: Should use `await`)
    thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.equal(data.body, "this is a content");

    // Close the piping server
    await new Promise<void>((resolve)=>{
      pipingServer.close(resolve);
    });
  });
});
