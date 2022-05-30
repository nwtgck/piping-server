import getPort from "get-port";
import * as net from "net";
import * as http from "http";
import * as http2 from "http2";
import * as log4js from "log4js";
import assert from "power-assert";
import * as request from "request";
import * as undici from "undici";
import * as piping from "../src/piping";
import * as utils from "../src/utils";
import {VERSION} from "../src/version";
import {EventEmitter} from "events";
import {URL, UrlObject} from "url";

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

// NOTE: with keep-alive test will be slow
function requestWithoutKeepAlive(
  url: string | URL | UrlObject,
  options?: Omit<undici.Dispatcher.RequestOptions, 'origin' | 'path' | 'method'> & Partial<Pick<undici.Dispatcher.RequestOptions, 'method'>>,
): Promise<undici.Dispatcher.ResponseData> {
  return undici.request(url, {
    ...options,
    dispatcher: new undici.Agent({ pipelining: 0 }), // For disabling keep alive
  });
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
      const res1 = await requestWithoutKeepAlive(`${pipingUrl}`);
      const res2 = await requestWithoutKeepAlive(`${pipingUrl}/`);

      const res1Body = await res1.body.text();
      const res2Body = await res2.body.text();

      // Body should be index page
      assert.strictEqual(res1Body.includes("Piping"), true);
      assert.strictEqual(res2Body.includes("Piping"), true);

      // Should have "Content-Length"
      assert.strictEqual(res1.headers["content-length"], res1Body.length.toString());
      assert.strictEqual(res2.headers["content-length"], res2Body.length.toString());

      // Should have "Content-Type"
      assert.strictEqual(res1.headers["content-type"], "text/html");
      assert.strictEqual(res2.headers["content-type"], "text/html");

      // Should have charset
      assert(res1Body.toLowerCase().includes(`<meta charset="utf-8">`));
      assert(res2Body.toLowerCase().includes(`<meta charset="utf-8">`));
    });

    it("should return noscript Web UI", async () => {
      // Get response
      const res = await requestWithoutKeepAlive(`${pipingUrl}/noscript?path=mypath`);
      const resBody = await res.body.text();

      // Body should be index page
      assert.strictEqual(resBody.includes("action=\"mypath\""), true);

      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], resBody.length.toString());

      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/html");

      // Should disable JavaScript and allow CSS with nonce
      assert(/^default-src 'none'; style-src 'nonce-.+'$/.test(res.headers["content-security-policy"] as string))

      // Should have charset
      assert(resBody.toLowerCase().includes(`<meta charset="utf-8">`));
    });

    it("should return version page", async () => {
      // Get response
      const res = await requestWithoutKeepAlive(`${pipingUrl}/version`);
      const resBody = await res.body.text();

      // Body should be index page
      // (from: https://stackoverflow.com/a/22339262/2885946)
      assert.strictEqual(resBody, VERSION + "\n");

      // Allow cross-origin
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], resBody.length.toString());
      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/plain");
    });

    it("should return help page", async () => {
      // Get response
      const res = await requestWithoutKeepAlive(`${pipingUrl}/help`);
      const resBody = await res.body.text();

      // Allow cross-origin
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], resBody.length.toString());
      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/plain");

      // Status should be OK
      assert.strictEqual(res.statusCode, 200);
    });

    it("should return no favicon", async () => {
      // Get response
      const res = await requestWithoutKeepAlive(`${pipingUrl}/favicon.ico`);

      // Status should be No Content
      assert.strictEqual(res.statusCode, 204);
    });

    it("should return no robots.txt", async () => {
      // Get response
      const res = await requestWithoutKeepAlive(`${pipingUrl}/robots.txt`);

      // Status should not be found
      assert.strictEqual(res.statusCode, 404);
      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
    });

    it("should not allow user to send the reserved paths", async () => {
      const reservedPaths = ["", "/", "/noscript", "/version", "/help", "/favicon.ico", "/robots.txt"];

      for (const reservedPath of reservedPaths) {
        // Send data to ""
        const res = await requestWithoutKeepAlive(`${pipingUrl}${reservedPath}`, {
          method: "POST",
          body: "this is a content"
        });
        // Should be failed
        assert.strictEqual(res.statusCode, 400);
        // Should have "Content-Length"
        assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
        assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      }
    });

    it("should return a HEAD response with the same headers as GET response", async () => {
      function normalizeHeaders(headers: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
        const h = {
          ...headers,
          "transfer-encoding": undefined,
          "content-security-policy" : undefined, // exclude because it includes nonce
          "date": undefined,
        };
        return JSON.parse(JSON.stringify(h, Object.keys(h).sort()));
      }

      const reservedPaths = ["", "/", "/noscript", "/version", "/help", "/favicon.ico", "/robots.txt"];

      for (const reservedPath of reservedPaths) {
        const getRes = await requestWithoutKeepAlive(`${pipingUrl}${reservedPath}`);
        const headRes = await requestWithoutKeepAlive(`${pipingUrl}${reservedPath}`, { method: "HEAD" });
        assert.strictEqual(headRes.statusCode, getRes.statusCode);
        assert.deepStrictEqual(normalizeHeaders(headRes.headers), normalizeHeaders(getRes.headers));
      }
    });

    it("should respond HTTP/1.0", async () => {
      const reservedPaths = ["/", "/noscript", "/version", "/help", "/favicon.ico", "/robots.txt"];

      for (const reservedPath of reservedPaths) {
        const getRes = await requestWithoutKeepAlive(`${pipingUrl}${reservedPath}`);
        const http1_0GetResPromise: Promise<Buffer> = new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          const socket = net.connect(pipingPort, "localhost", () => {
            socket.on("data", (chunk) => chunks.push(chunk));
            socket.on("end", () => resolve(Buffer.concat(chunks)));
            socket.on("error", (err) => reject(err));
            socket.write(`\
GET ${reservedPath} HTTP/1.0
Host: localhost:${pipingPort}

`.replace(/\n/g, "\r\n"));
          });
        });
        const http1_0GetResString = (await http1_0GetResPromise).toString();
        assert(http1_0GetResString.startsWith(`HTTP/1.0 ${getRes.statusCode}`));
        if (getRes.statusCode !== 204) {
          assert(http1_0GetResString.includes(`Content-Length: ${(await getRes.body.text()).length}`));
        }
      }
    });
  });

  it("should reject unsupported method", async () => {
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, { method: "DELETE" });
    assert.strictEqual(res.statusCode, 405);
    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
  });

  it("should support Preflight request", async () => {
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, { method: "OPTIONS" });

    assert.strictEqual(res.statusCode, 200);

    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(headers["access-control-allow-methods"], "GET, HEAD, POST, PUT, OPTIONS");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, Content-Disposition, X-Piping");
    assert.strictEqual(headers["access-control-max-age"], "86400");
    assert.strictEqual(headers["content-length"], "0");
  });

  it("should support Private Network Access Preflight request", async () => {
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "OPTIONS",
      headers: {
        "Access-Control-Request-Private-Network": "true",
      },
    });

    assert.strictEqual(res.statusCode, 200);

    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(headers["access-control-allow-methods"], "GET, HEAD, POST, PUT, OPTIONS");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, Content-Disposition, X-Piping");
    assert.strictEqual(headers["access-control-allow-headers"], "Content-Type, Content-Disposition, X-Piping");
    assert.strictEqual(headers["access-control-allow-private-network"], "true");
    assert.strictEqual(headers["access-control-max-age"], "86400");
    assert.strictEqual(headers["content-length"], "0");
  });

  it("should reject Service Worker registration request", async () => {
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mysw.js`, {
      headers: {
        "Service-Worker": "script"
      }
    });

    assert.strictEqual(res.statusCode, 400);
    const headers = res.headers;
    assert.strictEqual(headers["access-control-allow-origin"], "*");
    assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
  });

  it("should reject POST and PUT with Content-Range", async () => {
    const commonOptions = {
      body: "hello",
      headers: { "Content-Range": "bytes 2-6/100" },
    };
    const postRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, { ...commonOptions, method: "POST" });
    assert.strictEqual(postRes.statusCode, 400);
    assert.strictEqual(postRes.headers["content-type"], "text/plain");
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(postRes.headers["content-length"], (await postRes.body.text()).length.toString());

    const putRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, { ...commonOptions, method: "PUT" });
    assert.strictEqual(putRes.statusCode, 400);
    assert.strictEqual(putRes.headers["content-type"], "text/plain");
    assert.strictEqual(putRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(putRes.headers["content-length"], (await putRes.body.text()).length.toString());
  });

  it("should handle connection (receiver O, sender: O)", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    const sendRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");

    // Wait for response
    const res = await resPromise;

    // Body should be the sent data
    assert.strictEqual(await res.body.text(), "this is a content");
    // Content-length should be returned
    assert.strictEqual(res.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(res.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(res.headers["content-type"], undefined);
    assert.strictEqual(res.headers["x-robots-tag"], "none");
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
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: {
        "content-type": "text/plain"
      },
      body: "this is a content"
    });

    // Wait for response
    const res = await resPromise;

    // Content-Type should be returned
    assert.strictEqual(res.headers["content-type"], "text/plain");
  });

  it("should replace 'Content-Type: text/html' with 'text/plain'", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: {
        "content-type": "text/html"
      },
      body: "<h1>this is a content</h1>"
    });

    // Wait for response
    const res = await resPromise;

    // Content-Type should be 'text/plain'
    assert.strictEqual(res.headers["content-type"], "text/plain");
  });

  it("should replace 'Content-Type: text/html; charset=utf-8' with 'text/plain; charset=utf-8'", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: {
        "content-type": "text/html; charset=utf-8"
      },
      body: "<h1>this is a content</h1>"
    });

    // Wait for response
    const res = await resPromise;

    // Content-Type should be 'text/plain'
    assert.strictEqual(res.headers["content-type"], "text/plain; charset=utf-8");
  });

  it("should pass sender's Content-Disposition to receivers' one", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: {
        "content-disposition": "attachment; filename=\"myfile.txt\""
      },
      body: "this is a content"
    });

    // Wait for response
    const res = await resPromise;

    // Content-Disposition should be returned
    assert.strictEqual(res.headers["content-disposition"], "attachment; filename=\"myfile.txt\"");
  });

  it("should pass sender's X-Piping to receivers' one", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: {
        "x-piping": "mymetadata"
      },
      body: "this is a content"
    });

    // Wait for response
    const res = await resPromise;

    // Content-Type should be returned
    assert.strictEqual(res.headers["x-piping"], "mymetadata");
  });

  it("should pass sender's multiple X-Piping to receivers' ones", async () => {
    // Create a GET request
    const getReq = http.request({
      host: "localhost",
      port: pipingPort,
      method: "GET",
      path: `/mydataid`
    });
    getReq.end();

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      headers: [
        "x-piping", "mymetadata1",
        "x-piping", "mymetadata2",
        "x-piping", "mymetadata3",
      ],
      body: "this is a content"
    });

    // Wait for GET
    await new Promise(resolve => getReq.on("close", resolve));

    // Should return multiple X-Piping
    const xPiping = utils.parseHeaders((getReq as any).res.rawHeaders).get("x-piping");
    assert.deepStrictEqual(xPiping, ["mymetadata1", "mymetadata2", "mymetadata3"]);
  });

  it("should have Access-Control-Allow-Origin and no Access-Control-Expose-Headers in GET/POST response", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    await sleep(10);

    // Send data
    const postRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    // Headers of POST response should have Access-Control-Allow-Origin
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");

    // Wait for response
    const res = await resPromise;

    // Headers of GET response should have Access-Control-Allow-Origin
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(res.headers["access-control-expose-headers"], undefined);
  });

  it("should have Access-Control-Allow-Origin and no Access-Control-Expose-Headers in POST/GET response", async () => {
    // Send data
    const postResPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    await sleep(10);

    // Get request promise
    const getRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Headers of GET response should have Access-Control-Allow-Origin
    assert.strictEqual(getRes.headers["access-control-allow-origin"], "*");
    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(getRes.headers["access-control-expose-headers"], undefined);

    // Get response
    const postRes = await postResPromise;

    // Headers of POST response should have Access-Control-Allow-Origin
    assert.strictEqual(postRes.headers["access-control-allow-origin"], "*");
  });

  it("should have X-Piping in Access-Control-Expose-Headers in GET/POST response when sending with X-Piping", async () => {
    // Get request promise
    const resPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    await sleep(10);

    // Send data
    await requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      // NOTE: headers have X-Piping
      headers: {
        "X-Piping": "mymetadata",
      },
      body: "this is a content"
    });

    // Wait for response
    const res = await resPromise;
    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(res.headers["access-control-expose-headers"], "X-Piping");
  });

  it("should have X-Piping Access-Control-Expose-Headers in POST/GET response when sending with X-Piping", async () => {
    // Send data
    requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      // NOTE: headers have X-Piping
      headers: {
        "X-Piping": "mymetadata",
      },
      body: "this is a content"
    });

    await sleep(10);

    // Get request promise
    const getRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Headers of GET response should have Access-Control-Expose-Headers
    assert.strictEqual(getRes.headers["access-control-expose-headers"], "X-Piping");
  });

  it("should handle connection (sender: O, receiver: O)", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    const sendResPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    // Get data
    const getRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    const sendRes = await sendResPromise;
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");

    // Body should be the sent data
    assert.strictEqual(await getRes.body.text(), "this is a content");
    // Content-length should be returned
    assert.strictEqual(getRes.headers["content-length"], "this is a content".length.toString());
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
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.strictEqual(await res.body.text(), "this is a content");
  });

  it("should be sent by PUT method", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "PUT",
      body: "this is a content"
    });

    // Get data
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    // Body should be the sent data
    assert.strictEqual(await res.body.text(), "this is a content");
    // Content-length should be returned
    assert.strictEqual(res.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=3: O, receiver?n=3: O, receiver?n=3: O, sender?n=3: O)", async () => {
    // Get request promise
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);
    const resPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);
    const resPromise3 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Send data
    requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`, {
      method: "POST",
      body: "this is a content"
    });

    // Await all responses
    const [res1, res2, res3] = await Promise.all([resPromise1, resPromise2, resPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual((await res1.body.text()), "this is a content");
    assert.strictEqual(res1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual((await res2.body.text()), "this is a content");
    assert.strictEqual(res2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual((await res3.body.text()), "this is a content");
    assert.strictEqual(res3.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (sender?n=3: O, receiver?n=3: O, receiver?n=3: O, receiver?n=3: O)", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking GET requests)
    requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`, {
      method: "POST",
      body: "this is a content"
    });

    // Get data
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);
    const resPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);
    const resPromise3 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Await all responses
    const [res1, res2, res3] = await Promise.all([resPromise1, resPromise2, resPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual(await res1.body.text(), "this is a content");
    assert.strictEqual(res1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(await res2.body.text(), "this is a content");
    assert.strictEqual(res2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(await res3.body.text(), "this is a content");
    assert.strictEqual(res3.headers["content-length"], "this is a content".length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=3: O, sender?n=3: O, receiver?n=3: O, receiver?n=3: O)", async () => {

    // Get data
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Send data
    // (NOTE: Should NOT use `await` because of blocking GET requests)
    requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`, {
      method: "POST",
      body: "this is a content"
    });

    // Get data
    const resPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);
    const resPromise3 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Await all responses
    const [res1, res2, res3] = await Promise.all([resPromise1, resPromise2, resPromise3]);

    // Body should be the sent data and content-length should be returned
    assert.strictEqual(await res1.body.text(), "this is a content");
    assert.strictEqual(res1.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(await res2.body.text(), "this is a content");
    assert.strictEqual(res2.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(await res3.body.text(), "this is a content");
    assert.strictEqual(res3.headers["content-length"], "this is a content".length.toString());
  });

  it("should handle multi receiver connection (receiver?n=2: O, sender?n=1: X: because too less n)", async () => {
    // Get data
    const abortEventEmitter = new EventEmitter();
    undici.request(`${pipingUrl}/mydataid?n=2`, {
      signal: abortEventEmitter,
    });

    await sleep(10);

    // Send data
    const sendRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=1`, {
      method: "POST",
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendRes.statusCode, 400);
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");
    assert.strictEqual(sendRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(sendRes.headers["content-length"], (await sendRes.body.text()).length.toString());

    // Quit get request
    abortEventEmitter.emit("abort");
  });

  it("should handle multi receiver connection (receiver?n=2: O, sender?n=3: X: because too much n)", async () => {
    // Get data
    const getReq1 = request.get( {
      url: `${pipingUrl}/mydataid?n=2`
    });

    await sleep(10);

    // Send data
    const sendRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`, {
      method: "POST",
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendRes.statusCode, 400);
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");
    assert.strictEqual(sendRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(sendRes.headers["content-length"], (await sendRes.body.text()).length.toString());

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
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=1`);

    // Await response
    const res1 = await resPromise1;

    // Should be rejected
    assert.strictEqual(res1.statusCode, 400);
    assert.strictEqual(res1.headers["content-type"], "text/plain");
    assert.strictEqual(res1.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res1.headers["content-length"], (await res1.body.text()).length.toString());

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
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Await data
    const res1 = await resPromise1;

    // Should be rejected
    assert.strictEqual(res1.statusCode, 400);
    assert.strictEqual(res1.headers["content-type"], "text/plain");
    assert.strictEqual(res1.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res1.headers["content-length"], (await res1.body.text()).length.toString());

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

    const getResPromise3: Promise<request.Response> = new Promise((resolve) =>
      request.get({
        url: `${pipingUrl}/mydataid?n=2`
      }, (err, response, body) => {
        resolve(response);
      })
    );
    const getRes3 = await getResPromise3;
    // Should be rejected
    assert.strictEqual(getRes3.statusCode, 400);
    assert.strictEqual(getRes3.headers["content-type"], "text/plain");
    assert.strictEqual(getRes3.headers["access-control-allow-origin"], "*");
    assert.strictEqual(getRes3.headers["content-length"], getRes3.body.length.toString());
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

    const getResPromise3: Promise<request.Response> = new Promise((resolve) =>
      request.get({
        url: `${pipingUrl}/mydataid?n=3`
      }, (err, response, body) => {
        resolve(response);
      })
    );
    const getRes3 = await getResPromise3;
    // Should be rejected
    assert.strictEqual(getRes3.statusCode, 400);
    assert.strictEqual(getRes3.headers["content-type"], "text/plain");
    assert.strictEqual(getRes3.headers["access-control-allow-origin"], "*");
    assert.strictEqual(getRes3.headers["content-length"], getRes3.body.length.toString());
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
    const sendRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=1`, {
      method: "POST",
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendRes.statusCode, 400);
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");
    assert.strictEqual(sendRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(sendRes.headers["content-length"], (await sendRes.body.text()).length.toString());

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
    const sendRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`, {
      method: "POST",
      body: "this is a content"
    });

    // Should be rejected
    assert.strictEqual(sendRes.statusCode, 400);
    assert.strictEqual(sendRes.headers["content-type"], "text/plain");
    assert.strictEqual(sendRes.headers["access-control-allow-origin"], "*");
    assert.strictEqual(sendRes.headers["content-length"], (await sendRes.body.text()).length.toString());

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
    const res2 = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=3`);

    // Should be rejected
    assert.strictEqual(res2.statusCode, 400);
    assert.strictEqual(res2.headers["content-type"], "text/plain");
    assert.strictEqual(res2.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res2.headers["content-length"], (await res2.body.text()).length.toString());

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
    const res2 = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=1`);

    // Should be rejected
    assert.strictEqual(res2.statusCode, 400);
    assert.strictEqual(res2.headers["content-type"], "text/plain");
    assert.strictEqual(res2.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res2.headers["content-length"], (await res2.body.text()).length.toString());

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
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2`);
    await sleep(10);
    const resPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2`);
    await sleep(10);
    const resPromise3 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2`);
    await sleep(10);

    // End send data
    sendReq.end(" a content");

    // Await all responses
    const [res1, res2, res3] = await Promise.all([resPromise1, resPromise2, resPromise3]);

    // Body should be the sent data
    assert.strictEqual(await res1.body.text(), "this is a content");
    assert.strictEqual(await res2.body.text(), "this is a content");

    // Should be bad request
    assert.strictEqual(res3.statusCode, 400);
    assert.strictEqual(res3.headers["content-type"], "text/plain");
    assert.strictEqual(res3.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res3.headers["content-length"], (await res3.body.text()).length.toString());
  });

  // tslint:disable-next-line:max-line-length
  it("should handle multi receiver connection (receiver?n=2: O, receiver?n=2: O, receiver?n=2: X, sender?n=2: O)", async () => {
    // Get request promises
    // (NOTE: Each sleep is to ensure the order of requests)
    const resPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2&tag=first`);
    await sleep(10);
    const resPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2&tag=second`);
    await sleep(10);
    const resPromise3 = requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2&tag=third`);
    await sleep(10);

    // Send data
    requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=2`, {
      method: "POST",
      body: "this is a content"
    });

    // Await all responses
    const [res1, res2, res3] = await Promise.all([resPromise1, resPromise2, resPromise3]);

    // Body should be the sent data
    assert.strictEqual(await res1.body.text(), "this is a content");
    assert.strictEqual(await res2.body.text(), "this is a content");

    // Should be bad request
    assert.strictEqual(res3.statusCode, 400);
    assert.strictEqual(res3.headers["content-type"], "text/plain");
    assert.strictEqual(res3.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res3.headers["content-length"], (await res3.body.text()).length.toString());
  });

  it(`should reject POST with invalid query parameter "n"`, async () => {
    // Get data
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=hoge`, {
      method: "POST",
      body: "this is a content"
    });
    // Should be rejected
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers["content-type"], "text/plain");
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
  });

  it(`should reject GET with invalid query parameter "n"`, async () => {
    // Get data
    const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=hoge`);
    // Should be rejected
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.headers["content-type"], "text/plain");
    assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
  });

  it("should unregister a sender before establishing", async () => {
    // Create send request
    const sendReq1 = http.request( {
      host: "localhost",
      port: pipingPort,
      method: "POST",
      path: `/mydataid`
    });
    // Send content-length
    sendReq1.setHeader("Content-Length", "dummy content".length);
    // Send data
    sendReq1.end("dummy content");
    await sleep(10);
    sendReq1.destroy();
    await sleep(10);

    // Send data
    const sendPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    const get1 = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

    const sendRes = await sendPromise1;

    // Should be sent
    assert.strictEqual(sendRes.statusCode, 200);

    // Get-response should be 200
    assert.strictEqual(get1.statusCode, 200);
  });

  it("should unregister a receiver before establishing", async () => {
    // GET request
    const getReq1 = http.request( {
      host: "localhost",
      port: pipingPort,
      method: "GET",
      path: `/mydataid`
    });
    // Without this, failed with "Uncaught Error: socket hang up"
    getReq1.on("error", (err) => {});
    getReq1.end();

    await sleep(10);
    getReq1.destroy();
    await sleep(10);

    const getPromise2 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);
    await sleep(10);
    // Send data
    const sendPromise = requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    const [get2, sendRes] = await Promise.all([getPromise2, sendPromise]);
    // Should be sent
    assert.strictEqual(sendRes.statusCode, 200);
    // 2nd-get response should be 200
    assert.strictEqual(get2.statusCode, 200);
  });

  it("should handle connection from HTTP/1.0 sender", async () => {
    const senderResPromise: Promise<Buffer> = new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = net.connect(pipingPort, "localhost", () => {
        socket.on("data", (chunk) => chunks.push(chunk));
        socket.on("end", () => resolve(Buffer.concat(chunks)));
        socket.on("error", (err) => reject(err));
        socket.write(`\
POST /mydataid HTTP/1.0
Host: localhost:${pipingPort}
Content-Length: 17
Content-Type: text/plain

this is a content`.replace(/\n/g, "\r\n"));
      });
    });

    // Get data
    const getRes = await requestWithoutKeepAlive(`${pipingUrl}/mydataid`);
    // Body should be the sent data
    assert.strictEqual(await getRes.body.text(), "this is a content");
    // Content-length should be returned
    assert.strictEqual(getRes.headers["content-length"], "this is a content".length.toString());
    assert.strictEqual(getRes.headers["content-type"], "text/plain");

    const senderResString = (await senderResPromise).toString();
    assert(senderResString.startsWith("HTTP/1.0 200 OK\r\n"));
    assert(senderResString.match(/Content-Length: \d+\r\n/) !== null);
  });

  it("should handle connection from HTTP/1.0 receiver", async () => {
    // Send data
    // (NOTE: Should NOT use `await` because of blocking a GET request)
    requestWithoutKeepAlive(`${pipingUrl}/mydataid`, {
      method: "POST",
      body: "this is a content"
    });

    const receiverResPromise: Promise<Buffer> = new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = net.connect(pipingPort, "localhost", () => {
        socket.on("data", (chunk) => chunks.push(chunk));
        socket.on("end", () => resolve(Buffer.concat(chunks)));
        socket.on("error", (err) => reject(err));
        socket.write(`\
GET /mydataid HTTP/1.0
Host: localhost:${pipingPort}

`.replace(/\n/g, "\r\n"));
      });
    });

    const receiverResString = (await receiverResPromise).toString();
    assert(receiverResString.startsWith("HTTP/1.0 200 OK\r\n"));
    assert(receiverResString.includes("Content-Length: 17\r\n"));
  });

  context("If number of receivers <= 0", () => {
    it("should not allow n=0", async () => {
      // Send data
      const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=0`, {
        method: "POST",
        body: "this is a content"
      });

      // Should be rejected
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.headers["content-type"], "text/plain");
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
    });

    it("should not allow n=-1", async () => {
      // Send data
      const res = await requestWithoutKeepAlive(`${pipingUrl}/mydataid?n=-1`, {
        method: "POST",
        body: "this is a content"
      });

      // Should be rejected
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      assert.strictEqual(res.headers["content-length"], (await res.body.text()).length.toString());
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

      const getPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      assert.strictEqual(await getData1.body.text(), "this is a content");
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

      const getPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

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

      const getPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

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

      const getPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

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

      const getPromise1 = requestWithoutKeepAlive(`${pipingUrl}/mydataid`);

      const getData1 = await getPromise1;
      assert.strictEqual(getData1.statusCode, 200);
      const contentDisposition = "form-data; name=\"dummy form name\"; filename=\"myfile.txt\"";
      assert.strictEqual(getData1.headers["content-disposition"], contentDisposition);
    });
  });
});
