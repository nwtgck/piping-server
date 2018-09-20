import * as piping  from '../src/piping';
import * as assert from 'power-assert';
import * as http from "http";
import thenRequest from "then-request";

/**
 * Listen on the specify port
 * @param server
 * @param port
 */
function listenPromise(server: http.Server, port: number): Promise<void> {
  return new Promise<void>((resolve)=>{
    server.listen(port, resolve);
  });
}

/**
 * Close the server
 * @param server
 */
function closePromise(server: http.Server): Promise<void> {
  return new Promise<void>((resolve)=>{
    server.close(resolve);
  });
}

describe('piping.Server', () => {
  it('should allow a sender and a receiver to connect in this order', async () => {

    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

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
    await closePromise(pipingServer);
  });

  it('should allow a receiver and a sender to connect in this order', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await reqPromise;

    // Body should be the sent data
    assert.equal(data.body, "this is a content");

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should allow a sender and multi receivers to connect in this order', async () => {

    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Send data
    // (NOTE: Should use `await`)
    thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Get data
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid`);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.equal(data1.body, "this is a content");
    assert.equal(data2.body, "this is a content");
    assert.equal(data3.body, "this is a content");

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should allow multi receivers and a sender to connect in this order', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Get request promise
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid`);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.equal(data1.body, "this is a content");
    assert.equal(data2.body, "this is a content");
    assert.equal(data3.body, "this is a content");

    // Close the piping server
    await closePromise(pipingServer);
  });
});
