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

// Sleep
// (from: https://qiita.com/yuba/items/2b17f9ac188e5138319c)
export function sleep(ms: number): Promise<any> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


describe('piping.Server', () => {
  it('should return index page', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Get response
    const res1 = await thenRequest("GET", `${pipingUrl}`);
    const res2 = await thenRequest("GET", `${pipingUrl}/`);

    // Body should be index page
    assert.equal(res1.getBody("UTF-8").includes("Piping server is running"), true);
    assert.equal(res2.getBody("UTF-8").includes("Piping server is running"), true);

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should return version page', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Get response
    const res = await thenRequest("GET", `${pipingUrl}/version`);

    // Body should be index page
    // (from: https://stackoverflow.com/a/22339262/2885946)
    assert.equal(res.getBody("UTF-8"), process.env.npm_package_version+"\n");

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should not allow user to send the registered paths', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Send data to ""
    const req1 = await thenRequest("POST", `${pipingUrl}`, {
      body: "this is a content"
    });
    // Should be failed
    assert.equal(req1.statusCode, 400);

    // Send data to "/"
    const req2 = await thenRequest("POST", `${pipingUrl}/`, {
      body: "this is a content"
    });
    // Should be failed
    assert.equal(req2.statusCode, 400);

    // Send data to "/version"
    const req3 = await thenRequest("POST", `${pipingUrl}/`, {
      body: "this is a content"
    });
    // Should be failed
    assert.equal(req3.statusCode, 400);

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should allow a sender and a receiver to connect in this order', async () => {

    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.equal(data.getBody("UTF-8"), "this is a content");

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
    assert.equal(data.getBody("UTF-8"), "this is a content");

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
    // (NOTE: Should NOT use `await` because of blocking GET requests)
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
    assert.equal(data1.getBody("UTF-8"), "this is a content");
    assert.equal(data2.getBody("UTF-8"), "this is a content");
    assert.equal(data3.getBody("UTF-8"), "this is a content");

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should not allow a sender and multi receivers to connect in this order if the number of receivers is over', async () => {

    const pipingPort   = 9988;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Create send request
    const sendReq = http.request( {
      host: "localhost",
      port: pipingPort,
      method: "POST",
      path: `/mydataid?n=2`
    });
    // Send content-length
    sendReq.setHeader("Content-Length", "this is a content".length);
    // Send chunk of data
    sendReq.write("this is");

    // Get request promises
    // (NOTE: Each sleep is to ensure the order of requests)
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);
    await sleep(10);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid`);
    await sleep(10);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid`);
    await sleep(10);

    // End send data
    sendReq.end(" a content");

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.equal(data1.getBody("UTF-8"), "this is a content");
    assert.equal(data2.getBody("UTF-8"), "this is a content");

    // Should be bad request
    assert.equal(data3.statusCode, 400);

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
    thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.equal(data1.getBody("UTF-8"), "this is a content");
    assert.equal(data2.getBody("UTF-8"), "this is a content");
    assert.equal(data3.getBody("UTF-8"), "this is a content");

    // Close the piping server
    await closePromise(pipingServer);
  });

  it('should allow multi receivers and a sender to connect in this order if the number of receivers is over', async () => {
    const pipingPort   = 8787;
    const pipingServer = http.createServer(new piping.Server().handler);
    const pipingUrl    = `http://localhost:${pipingPort}`;

    // Listen on the port
    await listenPromise(pipingServer, pipingPort);

    // Get request promises
    // (NOTE: Each sleep is to ensure the order of requests)
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?tag=first`);
    await sleep(10);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?tag=second`);
    await sleep(10);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?tag=third`);
    await sleep(10);

    // Send data
    thenRequest("POST", `${pipingUrl}/mydataid?n=2`, {
      body: "this is a content"
    });

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.equal(data1.getBody("UTF-8"), "this is a content");
    assert.equal(data2.getBody("UTF-8"), "this is a content");

    // Should be bad request
    assert.equal(data3.statusCode, 400);

    // Close the piping server
    await closePromise(pipingServer);
  });
});
