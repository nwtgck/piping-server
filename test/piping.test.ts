import * as getPort from "get-port";
import * as http from "http";
import * as http2 from "http2";
import * as log4js from "log4js";
import * as assert from "power-assert";
import * as request from "request";
import thenRequest from "then-request";
import * as piping from "../src/piping";
import {VERSION} from "../src/version";

/**
 * Listen on the specify port
 * @param server
 * @param port
 */
function listenPromise(server: http.Server | http2.Http2Server, port: number): Promise<void> {
  return new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
}

/**
 * Close the server
 * @param server
 */
function closePromise(server: http.Server | http2.Http2Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

// Sleep
// (from: https://qiita.com/yuba/items/2b17f9ac188e5138319c)
export function sleep(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Create a logger
const logger = log4js.getLogger();

describe("piping.Server", () => {
  let pipingServer: http.Server;
  let pipingPort: number;
  let pipingUrl: string;

  beforeEach(async () => {
    // Get available port
    pipingPort = await getPort();
    // Define Piping URL
    pipingUrl = `http://localhost:${pipingPort}`;
    // Create a Piping server
    pipingServer = http.createServer(new piping.Server({logger}).generateHandler(false));
    // Listen on the port
    await listenPromise(pipingServer, pipingPort);
  });

  afterEach(async () => {
    // Close the piping server
    await closePromise(pipingServer);
  });

  context("In reserved path", () => {
    it("should return index page", async () => {
      // Get response
      const res1 = await thenRequest("GET", `${pipingUrl}`);
      const res2 = await thenRequest("GET", `${pipingUrl}/`);

      // Body should be index page
      assert.strictEqual(res1.getBody("UTF-8").includes("Piping"), true);
      assert.strictEqual(res2.getBody("UTF-8").includes("Piping"), true);

      // Should have "Content-Length"
      assert.strictEqual(res1.headers["content-length"], Buffer.byteLength(res1.getBody("UTF-8")).toString());
      assert.strictEqual(res2.headers["content-length"], Buffer.byteLength(res2.getBody("UTF-8")).toString());

      // Should have "Content-Type"
      assert.strictEqual(res1.headers["content-type"], "text/html");
      assert.strictEqual(res2.headers["content-type"], "text/html");
    });

    it("should return noscript Web UI", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/noscript?path=mypath`);

      // Body should be index page
      assert.strictEqual(res.getBody("UTF-8").includes("action=\"mypath\""), true);

      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], Buffer.byteLength(res.getBody("UTF-8")).toString());

      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/html");
    });

    it("should return version page", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/version`);

      // Body should be index page
      // (from: https://stackoverflow.com/a/22339262/2885946)
      assert.strictEqual(res.getBody("UTF-8"), VERSION + "\n");

      // Allow cross-origin
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], Buffer.byteLength(res.getBody("UTF-8")).toString());
      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/plain");
    });

    it("should return help page", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/help`);

      // Allow cross-origin
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], Buffer.byteLength(res.getBody("UTF-8")).toString());
      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/plain");

      // Status should be OK
      assert.strictEqual(res.statusCode, 200);
    });

    it("should return no favicon", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/favicon.ico`);

      // Status should be No Content
      assert.strictEqual(res.statusCode, 204);
    });

    it("should return no robots.txt", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/robots.txt`);

      // Status should not be found
      assert.strictEqual(res.statusCode, 404);
    });

    it("should not allow user to send the reserved paths", async () => {
      const reservedPaths = ["", "/", "/noscript", "/version", "/help", "/favicon.ico", "/robots.txt"];

      for (const reservedPath of reservedPaths) {
        // Send data to ""
        const req = await thenRequest("POST", `${pipingUrl}${reservedPath}`, {
          body: "this is a content"
        });
        // Should be failed
        assert.strictEqual(req.statusCode, 400);
        assert.strictEqual(req.headers["access-control-allow-origin"], "*");
      }
    });
  });

  it("should support Preflight request", async () => {
    const res = await thenRequest("OPTIONS", `${pipingUrl}/mydataid`);

    assert.strictEqual(res.statusCode, 200);

    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(headers["access-control-allow-methods"], "GET, HEAD, POST, PUT, OPTIONS");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, Content-Disposition");
    assert.strictEqual(headers["access-control-max-age"], "86400");
    assert.strictEqual(headers["content-length"], "0");
  });

  it("should reject Service Worker registration request", async () => {
    const res = await thenRequest("GET", `${pipingUrl}/mysw.js`, {
      headers: {
        "Service-Worker": "script"
      }
    });

    assert.strictEqual(res.statusCode, 400);
    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
  });

  it("should reject POST and PUT with Content-Range", async () => {
    const option = {
      body: "hello",
      headers: { "Content-Range": "bytes 2-6/100" },
    };
    const postRes = await thenRequest("POST", `${pipingUrl}/mydataid`, option);
    assert.strictEqual(postRes.statusCode, 400);
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");

    const putRes = await thenRequest("PUT", `${pipingUrl}/mydataid`, option);
    assert.strictEqual(putRes.statusCode, 400);
    assert.strictEqual(putRes.headers["access-control-allow-origin"], "*");
  });

  it("should handle connection (receiver O, sender: O)", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await reqPromise;

    // Body should be the sent data
    assert.strictEqual(data.getBody("UTF-8"), "this is a content");
    // Content-length should be returned
    assert.strictEqual(data.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data.headers["content-type"], undefined);
    assert.strictEqual(data.headers["x-robots-tag"], "none");
  });

  it("should handle connection over HTTP/2 (receiver O, sender: O)", async () => {
    // Get available port
    const http2PipingPort = await getPort();
    // Define Piping URL
    const http2PipingUrl = `http://localhost:${http2PipingPort}`;

    // Create a Piping server on HTTP/2
    const http2PipingServer = http2.createServer(new piping.Server({logger}).generateHandler(false));
    const sessions: http2.Http2Session[] = [];
    http2PipingServer.on("session", (session) => sessions.push(session));
    await listenPromise(http2PipingServer, http2PipingPort);

    // Get request
    const getReq = http2.connect(`${http2PipingUrl}`)
      .request({
        [http2.constants.HTTP2_HEADER_SCHEME]: "http",
        [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_GET,
        [http2.constants.HTTP2_HEADER_PATH]: `/mydataid`
      });

    await sleep(10);

    // Post data
    const bodyBuffer = Buffer.from("this is a content");
    // (base: https://stackoverflow.com/a/48705842/2885946)
    const postReq = http2.connect(`${http2PipingUrl}`)
      .request({
        [http2.constants.HTTP2_HEADER_SCHEME]: "http",
        [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_POST,
        [http2.constants.HTTP2_HEADER_PATH]: `/mydataid`,
        "Content-Length": bodyBuffer.length
      });
    postReq.write(bodyBuffer);
    postReq.end();

    // Get data
    const getBody: Buffer = await new Promise((resolve) => {
      const chunks: Buffer[] = [];
      getReq.on("data", (data) => chunks.push(data));
      getReq.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // // Body should be the sent data
    assert.strictEqual(getBody.toString(), bodyBuffer.toString());

    // (from: https://github.com/nodejs/node/issues/18176#issuecomment-358482149)
    for (const session of sessions) {
      session.destroy();
    }
    await closePromise(http2PipingServer);
  });

  it("should pass sender's Content-Type to receivers' one", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      headers: {
        "content-type": "text/plain"
      },
      body: "this is a content"
    });

    // Get data
    const data = await reqPromise;

    // Content-Type should be returned
    assert.strictEqual(data.headers["content-type"], "text/plain");
  });

  it("should replace 'Content-Type: text/html' with 'text/plain'", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      headers: {
        "content-type": "text/html"
      },
      body: "<h1>this is a content</h1>"
    });

    // Get data
    const data = await reqPromise;

    // Content-Tyoe should be 'text/plain'
    assert.strictEqual(data.headers["content-type"], "text/plain");
  });

  it("should replace 'Content-Type: text/html; charset=utf-8' with 'text/plain; charset=utf-8'", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      headers: {
        "content-type": "text/html; charset=utf-8"
      },
      body: "<h1>this is a content</h1>"
    });

    // Get data
    const data = await reqPromise;

    // Content-Tyoe should be 'text/plain'
    assert.strictEqual(data.headers["content-type"], "text/plain; charset=utf-8");
  });

  it("should pass sender's Content-Disposition to receivers' one", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    await thenRequest("POST", `${pipingUrl}/mydataid`, {
      headers: {
        "content-disposition": "attachment; filename=\"myfile.txt\""
      },
      body: "this is a content"
    });

    // Get data
    const data = await reqPromise;

    // Content-Disposition should be returned
    assert.strictEqual(data.headers["content-disposition"], "attachment; filename=\"myfile.txt\"");
  });

  it("should have Access-Control-Allow-Origin/Access-Control-Expose-Headers headers in GET/POST response", async () => {
    // Get request promise
    const reqPromise = thenRequest("GET", `${pipingUrl}/mydataid`);

    await sleep(10);

    // Send data
    const postRes = await thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Headers of POST response should have Access-Control-Allow-Origin
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");

    // Get data
    const data = await reqPromise;

    // Headers of GET response should have Access-Control-Allow-Origin
    assert.strictEqual(data.headers["access-control-allow-origin"], "*");
    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(data.headers["access-control-expose-headers"], "Content-Length, Content-Type");
  });

  it("should have Access-Control-Allow-Origin/Access-Control-Expose-Headers headers in POST/GET response", async () => {
    // Send data
    const postResPromise = thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    await sleep(10);

    // Get request promise
    const getRes = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Headers of GET response should have Access-Control-Allow-Origin
    assert.strictEqual(getRes.headers["access-control-allow-origin"], "*");
    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(getRes.headers["access-control-expose-headers"], "Content-Length, Content-Type");

    // Get response
    const postRes = await postResPromise;

    // Headers of POST response should have Access-Control-Allow-Origin
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");
  });

  it("should handle connection (sender: O, receiver: O)", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.strictEqual(data.getBody("UTF-8"), "this is a content");
    // Content-length should be returned
    assert.strictEqual(data.headers["content-length"], "this is a content".length.toString());
  });

  it("should be sent chunked data", async () => {
    // Create a send request
    const sendReq = http.request({
      host: "localhost",
      port: pipingPort,
      method: "POST",
      path: `/mydataid`
    });

    // Send chunked data
    sendReq.write("this is");
    sendReq.end(" a content");

    // Get data
    const data = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.strictEqual(data.getBody("UTF-8"), "this is a content");
  });

  it("should be sent by PUT method", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    thenRequest("PUT", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Get data
    const data = await thenRequest("GET", `${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.strictEqual(data.getBody("UTF-8"), "this is a content");
    // Content-length should be returned
    assert.strictEqual(data.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=3: O, receiver?n=3: O, receiver?n=3: O, sender?n=3: O)", async () => {
    // Get request promise
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Send data
    thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual(data1.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data2.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data3.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data3.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (sender?n=3: O, receiver?n=3: O, receiver?n=3: O, receiver?n=3: O)", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking GET requests)
    thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Get data
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual(data1.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data2.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data3.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data3.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=3: O, sender?n=3: O, receiver?n=3: O, receiver?n=3: O)", async () => {

    // Get data
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Send data
    // (NOTE: Should NOT use `await` because of blocking GET requests)
    thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Get data
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual(data1.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data2.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(data3.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data3.headers["content-length"], "this is a content".length.toString());
  });

  it("should handle multi receiver connection (receiver?n=2: O, sender?n=1: X: because too less n)", async () => {
    // Get data
    const getReq1 = request.get( {
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    // Send data
    const sendData = await thenRequest("POST", `${pipingUrl}/mydataid?n=1`, {
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendData.statusCode, 400);
    assert.strictEqual(sendData.headers["access-control-allow-origin"], "*");

    // Quit get request
    getReq1.abort();
  });

  it("should handle multi receiver connection (receiver?n=2: O, sender?n=3: X: because too much n)", async () => {
    // Get data
    const getReq1 = request.get( {
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    // Send data
    const sendData = await thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendData.statusCode, 400);
    assert.strictEqual(sendData.headers["access-control-allow-origin"], "*");

    // Quit get request
    getReq1.abort();
  });

  it("should handle multi receiver connection (sender?n=2: O, receiver?n=1: X: because too less n)", async () => {
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
    sendReq.end("this is a content");

    await sleep(10);

    // Get data
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=1`);

    // Await data
    const data1 = await dataPromise1;

    // Should be rejected
    assert.strictEqual(data1.statusCode, 400);
    assert.strictEqual(data1.headers["access-control-allow-origin"], "*");

    // Quit send request
    sendReq.abort();
  });

  it("should handle multi receiver connection (sender?n=2: O, receiver?n=3: X: because too much n)", async () => {
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
    sendReq.end("this is a content");

    await sleep(10);

    // Get data
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Await data
    const data1 = await dataPromise1;

    // Should be rejected
    assert.strictEqual(data1.statusCode, 400);
    assert.strictEqual(data1.headers["access-control-allow-origin"], "*");

    // Quit send request
    sendReq.abort();
  });

  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, receiver?n=2: X)", async () => {
    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    const getReq2 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    const getReqPromise3: Promise<request.Response> = new Promise((resolve) =>
      request.get({
        url: `${pipingUrl}/mydataid?n=2`
      }, (err, response, body) => {
        resolve(response);
      })
    );
    // Should be rejected
    assert.strictEqual((await getReqPromise3).statusCode, 400);
    assert.strictEqual((await getReqPromise3).headers["access-control-allow-origin"], "*");
    // Quit get requests
    getReq1.abort();
    getReq2.abort();
  });

  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, receiver?n=3: X)", async () => {
    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    const getReq2 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    const getReqPromise3: Promise<request.Response> = new Promise((resolve) =>
      request.get({
        url: `${pipingUrl}/mydataid?n=3`
      }, (err, response, body) => {
        resolve(response);
      })
    );
    // Should be rejected
    assert.strictEqual((await getReqPromise3).statusCode, 400);
    assert.strictEqual((await getReqPromise3).headers["access-control-allow-origin"], "*");
    // Quit get requests
    getReq1.abort();
    getReq2.abort();
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, sender?n=1: X: because too less)", async () => {
    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    const getReq2 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    // Send data
    const sendData = await thenRequest("POST", `${pipingUrl}/mydataid?n=1`, {
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendData.statusCode, 400);
    assert.strictEqual(sendData.headers["access-control-allow-origin"], "*");

    // Quit get requests
    getReq1.abort();
    getReq2.abort();
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, sender?n=3: X: because too much)", async () => {
    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    const getReq2 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    // Send data
    const sendData = await thenRequest("POST", `${pipingUrl}/mydataid?n=3`, {
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendData.statusCode, 400);
    assert.strictEqual(sendData.headers["access-control-allow-origin"], "*");

    // Quit get requests
    getReq1.abort();
    getReq2.abort();
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (sender?n=2: O, receiver?n=2 O, receiver?n=3: X: because too much)", async () => {
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
    sendReq.end("this is a content");

    await sleep(10);

    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    await sleep(10);
    const data2 = await thenRequest("GET", `${pipingUrl}/mydataid?n=3`);

    // Should be rejected
    assert.strictEqual(data2.statusCode, 400);
    assert.strictEqual(data2.headers["access-control-allow-origin"], "*");

    // Quit get request
    getReq1.abort();
    // Quit send request
    sendReq.abort();
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (sender?n=2: O, receiver?n=2 O, receiver?n=1: X: because too less)", async () => {
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
    sendReq.end("this is a content");

    await sleep(10);

    // Get data
    const getReq1 = request.get({
      url: `${pipingUrl}/mydataid?n=2`
    });
    await sleep(10);
    const data2 = await thenRequest("GET", `${pipingUrl}/mydataid?n=1`);

    // Should be rejected
    assert.strictEqual(data2.statusCode, 400);
    assert.strictEqual(data2.headers["access-control-allow-origin"], "*");

    // Quit get request
    getReq1.abort();
    // Quit send request
    sendReq.abort();
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (sender?n=2: O, receiver?n=2: O, receiver?n=2: O, receiver?n=2: X) to ensure gradual sending", async () => {
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
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=2`);
    await sleep(10);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?n=2`);
    await sleep(10);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?n=2`);
    await sleep(10);

    // End send data
    sendReq.end(" a content");

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.strictEqual(data1.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data2.getBody("UTF-8"), "this is a content");

    // Should be bad request
    assert.strictEqual(data3.statusCode, 400);
    assert.strictEqual(data3.headers["access-control-allow-origin"], "*");
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, receiver?n=2: X, sender?n=2: O)", async () => {
    // Get request promises
    // (NOTE: Each sleep is to ensure the order of requests)
    const dataPromise1 = thenRequest("GET", `${pipingUrl}/mydataid?n=2&tag=first`);
    await sleep(10);
    const dataPromise2 = thenRequest("GET", `${pipingUrl}/mydataid?n=2&tag=second`);
    await sleep(10);
    const dataPromise3 = thenRequest("GET", `${pipingUrl}/mydataid?n=2&tag=third`);
    await sleep(10);

    // Send data
    thenRequest("POST", `${pipingUrl}/mydataid?n=2`, {
      body: "this is a content"
    });

    // Await all data
    const [data1, data2, data3] = await Promise.all([dataPromise1, dataPromise2, dataPromise3]);

    // Body should be the sent data
    assert.strictEqual(data1.getBody("UTF-8"), "this is a content");
    assert.strictEqual(data2.getBody("UTF-8"), "this is a content");

    // Should be bad request
    assert.strictEqual(data3.statusCode, 400);
    assert.strictEqual(data3.headers["access-control-allow-origin"], "*");
  });

  it(`should reject POST with invalid query parameter "n"`, async () => {
    // Get data
    const res = await thenRequest("POST", `${pipingUrl}/mydataid?n=hoge`, {
      body: "this is a content"
    });
    // Should be rejected
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
  });

  it(`should reject GET with invalid query parameter "n"`, async () => {
    // Get data
    const res = await thenRequest("GET", `${pipingUrl}/mydataid?n=hoge`);
    // Should be rejected
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
  });

  it("should unregister a sender before establishing", async () => {
    // Send data
    const sedReq1 = request.post( {
      url: `${pipingUrl}/mydataid`,
      body: "dummy content"
    });
    await sleep(10);
    // Quit send request
    sedReq1.abort();

    await sleep(10);

    // Send data
    const sendPromise1 = thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    const get1 = await thenRequest("GET", `${pipingUrl}/mydataid`);

    const sendData = await sendPromise1;

    // Should be sent
    assert.strictEqual(sendData.statusCode, 200);

    // Get-response should be 200
    assert.strictEqual(get1.statusCode, 200);
  });

  it("should unregister a receiver before establishing", async () => {
    // Get data
    const getReq1 = request.get( {
      url: `${pipingUrl}/mydataid`
    });
    await sleep(10);
    // Quit get request
    getReq1.abort();

    await sleep(10);

    const getPromise2 = thenRequest("GET", `${pipingUrl}/mydataid`);

    // Send data
    const sendData = await thenRequest("POST", `${pipingUrl}/mydataid`, {
      body: "this is a content"
    });

    // Should be sent
    assert.strictEqual(sendData.statusCode, 200);

    // 2nd-get response should be 200
    const get2 = await getPromise2;
    assert.strictEqual(get2.statusCode, 200);
  });

  context("If number of receivers <= 0", () => {
    it("should not allow n=0", async () => {
      // Send data
      const res = await thenRequest("POST", `${pipingUrl}/mydataid?n=0`, {
        body: "this is a content"
      });

      // Should be rejected
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    });

    it("should not allow n=-1", async () => {
      // Send data
      const res = await thenRequest("POST", `${pipingUrl}/mydataid?n=-1`, {
        body: "this is a content"
      });

      // Should be rejected
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    });
  });

  context("By multipart/data-form", () => {
    it("should allow sender to send data via multipart without multipart content-type", async () => {
      const formData = {
        "dummy form name": "this is a content"
      };

      // Send data
      request.post({url: `${pipingUrl}/mydataid`, formData: formData});

      await sleep(10);

      const getPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      assert.strictEqual(getData1.getBody("UTF-8"), "this is a content");
    });

    it("should pass sender's Content-Type to receivers' one", async () => {
      const formData = {
        "dummy form name": {
          value: "this is a content",
          options: {
            contentType: "text/plain"
          }
        }
      };

      // Send data
      request.post({url: `${pipingUrl}/mydataid`, formData: formData});

      await sleep(10);

      const getPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      assert.strictEqual(getData1.headers["content-type"], "text/plain");
    });

    it("should replace 'Content-Type: text/html' when 'text/plain'", async () => {
      const formData = {
        "dummy form name": {
          value: "<h1>this is a content</h1>",
          options: {
            contentType: "text/html"
          }
        }
      };

      // Send data
      request.post({url: `${pipingUrl}/mydataid`, formData: formData});

      await sleep(10);

      const getPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      assert.strictEqual(getData1.headers["content-type"], "text/plain");
    });

    it("should replace 'Content-Type: text/html; charset=utf-8' when 'text/plain; charset=utf-8'", async () => {
      const formData = {
        "dummy form name": {
          value: "<h1>this is a content</h1>",
          options: {
            contentType: "text/html; charset=utf-8"
          }
        }
      };

      // Send data
      request.post({url: `${pipingUrl}/mydataid`, formData: formData});

      await sleep(10);

      const getPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      assert.strictEqual(getData1.headers["content-type"], "text/plain; charset=utf-8");
    });

    it("should pass sender's Content-Disposition to receivers' one", async () => {
      const formData = {
        "dummy form name": {
          value: "this is a content",
          options: {
            filename: "myfile.txt"
          }
        }
      };

      // Send data
      request.post({url: `${pipingUrl}/mydataid`, formData: formData});

      await sleep(10);

      const getPromise1 = thenRequest("GET", `${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      const contentDisposition = "form-data; name=\"dummy form name\"; filename=\"myfile.txt\"";
      assert.strictEqual(getData1.headers["content-disposition"], contentDisposition);
    });
  });
});
