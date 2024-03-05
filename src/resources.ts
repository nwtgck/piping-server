import {VERSION} from "./version";
import {NAME_TO_RESERVED_PATH} from "./reserved-paths";
import * as utils from "./utils";

export const indexPage: string = `\
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Piping Server</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta charset="UTF-8">
  <style>
    body {
      font-family: "Avenir Next", Helvetica, Arial, sans-serif;
      font-size: 110%;
      margin: 1em;
    }
    h1 {
      display: inline;
    }
    h3 {
      margin-top: 2em;
      margin-bottom: 0.5em;
    }
  </style>
</head>
<body>
<h1>Piping Server</h1>
<span>${VERSION}</span>

<p>Streaming Data Transfer Server over HTTP/HTTPS</p>
<h3>Step 1: Choose a file or text</h3>

<input type="checkbox" id="text_mode" onchange="toggleInputMode()">: <b>Text mode</b><br><br>

<input type="file" id="file_input">
<textarea id="text_input" placeholder="Input text" cols="30" rows="10" style="display: none"></textarea>
<br>

<h3>Step 2: Write your secret path</h3>
(e.g. "abcd1234", "mysecret.png")<br>
<input id="secret_path" placeholder="Secret path" size="50"><br>
<h3>Step 3: Click the send button</h3>
<button onclick="send()">Send</button><br>
<progress id="progress_bar" value="0" max="100" style="display: none"></progress><br>
<div id="message"></div>
<hr>
<a href="https://piping-ui.org">Piping UI for Web</a><br>
<a href="${NAME_TO_RESERVED_PATH.noscript.substring(1)}">Transfer without JavaScript</a><br>
<a href="https://github.com/nwtgck/piping-server#readme">Command-line usage</a><br>
<script>
  // Toggle input mode: file or text
  var toggleInputMode = (function () {
    var activeInput      = window.file_input;
    var deactivatedInput = window.text_input;
    // Set inputs' functionality and visibility
    function setInputs() {
      activeInput.removeAttribute("disabled");
      activeInput.style.removeProperty("display");
      deactivatedInput.setAttribute("disabled", "");
      deactivatedInput.style.display = "none";
    }
    setInputs();
    // Body of toggleInputMode
    function toggle() {
      // Swap inputs
      var tmpInput     = activeInput;
      activeInput      = deactivatedInput;
      deactivatedInput = tmpInput;
      setInputs();
    }
    return toggle;
  })();
  function setMessage(msg) {
    window.message.innerText = msg;
  }
  function setProgress(loaded, total) {
    var progress = (total === 0) ? 0 : loaded / total * 100;
    window.progress_bar.value = progress;
    setMessage(loaded + "B (" + progress.toFixed(2) + "%)");
  }
  function hideProgress() {
    window.progress_bar.style.display = "none";
  }
  function send() {
    // Select body (text or file)
    var body = window.text_mode.checked ? window.text_input.value : window.file_input.files[0];
    // Send
    var xhr = new XMLHttpRequest();
    var path = location.href.replace(/\\/$/, '') + "/" + window.secret_path.value;
    xhr.open("POST", path, true);
    // If file has no type
    if (!window.text_mode.checked && body.type === "") {
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
    }
    // Update progress bar
    xhr.upload.onprogress = function (e) {
      setProgress(e.loaded, e.total);
    };
    xhr.upload.onload = function (e) {
      // Send finished
      if (xhr.status === 200) {
        setProgress(e.loaded, e.total);
      }
    };
    xhr.onload = function () {
      // Status code error
      if (xhr.status !== 200) {
        setMessage(xhr.responseText);
        hideProgress();
      }
    };
    xhr.onerror = function () {
      setMessage("Upload error");
      hideProgress();
    };
    xhr.send(body);
    // Show progress bar
    window.progress_bar.style.removeProperty("display");
  }
</script>
</body>
</html>
`;

export function noScriptHtml(queryParams: URLSearchParams, styleNonce: string): string {
  const pathQueryParameterName = "path";
  const modeQueryParameterName = "mode";
  const fileMode = "file";
  const textMode = "text";

  const path = queryParams.get(pathQueryParameterName) ?? "";
  const mode = queryParams.get(modeQueryParameterName) ?? fileMode;

  const pathIsFilled = path !== "";

  const escapedPath = utils.escapeHtmlAttribute(path);
  return `\
<!DOCTYPE html>
<html lang="en">
<head>
  <title>File transfer without JavaScript</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta charset="UTF-8">
  <style nonce="${styleNonce}">
    body {
      font-family: sans-serif;
      font-size: 110%;
    }
    h3 {
      margin-top: 2em;
      margin-bottom: 0.5em;
    }
  </style>
</head>
<body>
  <h2>File transfer without JavaScript</h2>
  <form method="GET">
    <h3>Step 1: Specify path and mode</h3>
    <input name="${pathQueryParameterName}" value="${escapedPath}" size="30" placeholder='e.g. "abc123", "myimg.png"'>
    <input type="submit" value="Apply"><br>
    <input type="radio" name="${modeQueryParameterName}" value="${fileMode}" ${mode === fileMode ? "checked" : ""}>File
    <input type="radio" name="${modeQueryParameterName}" value="${textMode}" ${mode === textMode ? "checked" : ""}>Text<br>
  </form>
  <form method="POST" ${pathIsFilled ? `action="${escapedPath}"` : ""} enctype="multipart/form-data">${
    (mode === "text") ? `
    <h3>Step 2: Input text</h3>
    <textarea name="input_text" cols="30" ${pathIsFilled ? 'rows="10"' : "disabled"} placeholder="${pathIsFilled ? "" : "Fill in the path above first"}"></textarea>`
    : `
    <h3>Step 2: Choose a file</h3>
    <input type="file" name="input_file" ${pathIsFilled ? "" : "disabled"}>`}
    <h3>Step 3: Send</h3>
    <input type="submit" value="Send" ${pathIsFilled ? "" : "disabled"}>
  </form>
  <hr>
  Version ${VERSION}<br>
  Piping Server:
  <a href="https://github.com/nwtgck/piping-server">
    https://github.com/nwtgck/piping-server
  </a><br>
  <a href=".">Top page</a><br>
</body>
</html>
`;
}

/**
 * Generate help page
 * @param {string} url
 * @returns {string}
 */
export function generateHelpPage(url: string): string {
  return (
`Help for Piping Server ${VERSION}
(Repository: https://github.com/nwtgck/piping-server)

======= Get  =======
curl ${url}/mypath

======= Send =======
# Send a file
curl -T myfile ${url}/mypath

# Send a text
echo 'hello!' | curl -T - ${url}/mypath

# Send a directory (zip)
zip -q -r - ./mydir | curl -T - ${url}/mypath

# Send a directory (tar.gz)
tar zfcp - ./mydir | curl -T - ${url}/mypath

# Encryption
## Send
cat myfile | openssl aes-256-cbc | curl -T - ${url}/mypath
## Get
curl ${url}/mypath | openssl aes-256-cbc -d
`);
}
