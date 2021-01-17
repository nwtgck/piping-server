import {VERSION} from "./version";

export const indexPage: string = `\
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Piping Server</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta charset="UTF-8">
  <style>
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
<textarea id="text_input" placeholder="Input text" cols="30" rows="10"></textarea>
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

/**
 * Generate help page
 * @param {string} url
 * @returns {string}
 */
// tslint:disable-next-line:no-shadowed-variable
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
