import * as getPort from "get-port";
import * as http from "http";
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
function listenPromise(server: http.Server, port: number): Promise<void> {
  return new Promise<void>((resolve) => {
    server.listen(port, resolve);
  });
}

/**
 * Close the server
 * @param server
 */
function closePromise(server: http.Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

// Sleep
// (from: https://qiita.com/yuba/items/2b17f9ac188e5138319c)
export function sleep(ms: number): Promise<any> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    pipingServer = http.createServer(new piping.Server(false).generateHandler(false));
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

    it("should return version page", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/version`);

      // Body should be index page
      // (from: https://stackoverflow.com/a/22339262/2885946)
      assert.strictEqual(res.getBody("UTF-8"), VERSION + "\n");

      // Should have "Content-Length"
      assert.strictEqual(res.headers["content-length"], Buffer.byteLength(res.getBody("UTF-8")).toString());
      // Should have "Content-Type"
      assert.strictEqual(res.headers["content-type"], "text/plain");
    });

    it("should return help page", async () => {
      // Get response
      const res = await thenRequest("GET", `${pipingUrl}/help`);

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
      const reservedPaths = ["", "/", "/version", "/help", "/favicon.ico", "/robots.txt"];

      for (const reservedPath of reservedPaths) {
        // Send data to ""
        const req = await thenRequest("POST", `${pipingUrl}${reservedPath}`, {
          body: "this is a content"
        });
        // Should be failed
        assert.strictEqual(req.statusCode, 400);
      }
    });
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

  it("should have Access-Control-Allow-Origin headers in GET/POST response", async () => {
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
    });

    it("should not allow n=-1", async () => {
      // Send data
      const res = await thenRequest("POST", `${pipingUrl}/mydataid?n=-1`, {
        body: "this is a content"
      });

      // Should be rejected
      assert.strictEqual(res.statusCode, 400);
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
