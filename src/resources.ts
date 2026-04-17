import {VERSION} from "./version";
import {NAME_TO_RESERVED_PATH} from "./reserved-paths";
import * as utils from "./utils";

export const indexPage: string = `\
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <title>流式数据传输（不限制传输文件大小）</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: "PingFang SC", "Microsoft YaHei", "Avenir Next", Helvetica, Arial, sans-serif;
      font-size: 16px;
      margin: 0;
      padding: 2em;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 2em;
    }
    .header h1 {
      font-size: 2.5em;
      margin: 0 0 0.3em 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .header p {
      font-size: 1.1em;
      opacity: 0.9;
      margin: 0;
    }
    .header .version {
      background: rgba(255,255,255,0.2);
      padding: 0.2em 0.8em;
      border-radius: 20px;
      font-size: 0.85em;
      display: inline-block;
      margin-top: 0.5em;
    }
    .container {
      display: flex;
      gap: 2em;
      max-width: 1400px;
      margin: 0 auto;
    }
    .panel {
      flex: 1;
      background: white;
      border-radius: 16px;
      padding: 2em;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .panel-title {
      font-size: 1.4em;
      color: #333;
      margin: 0 0 1.5em 0;
      padding-bottom: 0.5em;
      border-bottom: 2px solid #667eea;
      display: flex;
      align-items: center;
      gap: 0.5em;
    }
    .panel-title .icon {
      font-size: 1.2em;
    }
    h3 {
      color: #555;
      font-size: 1em;
      margin: 1.5em 0 0.8em 0;
    }
    h3:first-of-type {
      margin-top: 0;
    }
    input[type="text"],
    input[type="file"],
    textarea {
      width: 100%;
      padding: 0.8em;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1em;
      transition: border-color 0.3s;
    }
    input[type="text"]:focus,
    textarea:focus {
      border-color: #667eea;
      outline: none;
    }
    input[type="file"] {
      padding: 0.5em;
      border-style: dashed;
    }
    textarea {
      resize: vertical;
      min-height: 100px;
    }
    button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 1em 2em;
      font-size: 1.1em;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    button:active {
      transform: translateY(0);
    }
    progress {
      width: 100%;
      height: 8px;
      border-radius: 4px;
      margin-top: 1em;
    }
    progress::-webkit-progress-bar {
      background: #e0e0e0;
      border-radius: 4px;
    }
    progress::-webkit-progress-value {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
    }
    #message {
      margin-top: 1em;
      padding: 0.8em;
      border-radius: 8px;
      text-align: center;
      min-height: 1.5em;
    }
    .success {
      background: #d4edda;
      color: #155724;
    }
    .error {
      background: #f8d7da;
      color: #721c24;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1.2em;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.9em;
      line-height: 1.6;
      margin: 0;
    }
    code {
      font-family: Consolas, Monaco, "Courier New", monospace;
    }
    .comment { color: #6a9955; }
    .cmd { color: #4ec9b0; }
    .string { color: #ce9178; }
    .highlight { color: #dcdcaa; }
    .links {
      margin-top: 1.5em;
      padding-top: 1em;
      border-top: 1px solid #eee;
    }
    .links a {
      color: #667eea;
      text-decoration: none;
      display: inline-block;
      margin-right: 1.5em;
      transition: color 0.2s;
    }
    .links a:hover {
      color: #764ba2;
      text-decoration: underline;
    }
    .tip {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 1em;
      margin-top: 1.5em;
      font-size: 0.9em;
      color: #856404;
    }
    .tip .title {
      font-weight: bold;
      margin-bottom: 0.5em;
    }
    @media (max-width: 900px) {
      .container {
        flex-direction: column;
      }
      .header h1 {
        font-size: 1.8em;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📡 流式数据传输（不限制传输文件大小）</h1>
    <p>基于 HTTP/HTTPS 的实时数据中继服务</p>
    <div class="version">版本 ${VERSION}</div>
  </div>

  <div class="container">
    <!-- 左侧：网页操作 -->
    <div class="panel">
      <h2 class="panel-title"><span class="icon">🖥️</span> 网页操作</h2>

      <h3>第一步：选择文件或输入文本</h3>
      <input type="checkbox" id="text_mode" onchange="toggleInputMode()"> <label for="text_mode">切换为文本模式</label>
      <br><br>
      <input type="file" id="file_input">
      <textarea id="text_input" placeholder="请输入文本内容..." style="display: none"></textarea>

      <h3>第二步：设置传输路径</h3>
      <input id="secret_path" placeholder="例如：myfile、secret123" size="50">

      <h3>第三步：发送数据</h3>
      <button onclick="send()">🚀 发送</button>
      <progress id="progress_bar" value="0" max="100" style="display: none"></progress>
      <div id="message"></div>

      <div class="links">
        <a href="https://piping-ui.org" target="_blank">✨ Piping UI（支持加密）</a>
        <a href="${NAME_TO_RESERVED_PATH.noscript.substring(1)}">🔒 无 JS 传输</a>
      </div>
    </div>

    <!-- 右侧：命令行操作 -->
    <div class="panel">
      <h2 class="panel-title"><span class="icon">💻</span> 命令行操作</h2>

      <div class="tip">
        <div class="title">💡 提示</div>
        请将 <code>&#36;{url}</code> 替换为您的服务器地址（如 <code>http://localhost:8080</code>）
      </div>

      <h3>接收数据</h3>
      <pre><code><span class="cmd">curl</span> <span class="highlight">&#36;{url}</span>/mypath</code></pre>

      <h3>发送文件</h3>
      <pre><code><span class="cmd">curl</span> -T myfile <span class="highlight">&#36;{url}</span>/mypath</code></pre>

      <h3>发送文本</h3>
      <pre><code><span class="cmd">echo</span> <span class="string">'你好！'</span> | <span class="cmd">curl</span> -T - <span class="highlight">&#36;{url}</span>/mypath</code></pre>

      <h3>发送目录</h3>
      <pre><code><span class="comment"># zip 格式</span>
<span class="cmd">zip</span> -q -r - ./mydir | <span class="cmd">curl</span> -T - <span class="highlight">&#36;{url}</span>/mypath

<span class="comment"># tar.gz 格式</span>
<span class="cmd">tar</span> zfcp - ./mydir | <span class="cmd">curl</span> -T - <span class="highlight">&#36;{url}</span>/mypath</code></pre>

      <h3>加密传输</h3>
      <pre><code><span class="comment"># 发送加密</span>
<span class="cmd">cat</span> myfile | <span class="cmd">openssl</span> aes-256-cbc | <span class="cmd">curl</span> -T - <span class="highlight">&#36;{url}</span>/mypath

<span class="comment"># 接收解密</span>
<span class="cmd">curl</span> <span class="highlight">&#36;{url}</span>/mypath | <span class="cmd">openssl</span> aes-256-cbc -d</code></pre>

      <h3>多接收者（同时下载）</h3>
      <pre><code><span class="comment"># 发送端指定 3 个接收者</span>
<span class="cmd">curl</span> -T video.mp4 <span class="string">"&#36;{url}/video?n=3"</span>

<span class="comment"># 三个终端同时接收</span>
<span class="cmd">curl</span> <span class="string">"&#36;{url}/video?n=3"</span> -o part1.mp4 &
<span class="cmd">curl</span> <span class="string">"&#36;{url}/video?n=3"</span> -o part2.mp4 &
<span class="cmd">curl</span> <span class="string">"&#36;{url}/video?n=3"</span> -o part3.mp4</code></pre>
    </div>
  </div>

<script>
  // 切换输入模式：文件或文本
  var toggleInputMode = (function () {
    var activeInput      = window.file_input;
    var deactivatedInput = window.text_input;
    function setInputs() {
      activeInput.removeAttribute("disabled");
      activeInput.style.removeProperty("display");
      deactivatedInput.setAttribute("disabled", "");
      deactivatedInput.style.display = "none";
    }
    setInputs();
    function toggle() {
      var tmpInput     = activeInput;
      activeInput      = deactivatedInput;
      deactivatedInput = tmpInput;
      setInputs();
    }
    return toggle;
  })();

  function setMessage(msg, type) {
    var el = window.message;
    el.innerText = msg;
    el.className = type ? type : '';
  }

  function setProgress(loaded, total) {
    var progress = (total === 0) ? 0 : loaded / total * 100;
    window.progress_bar.value = progress;
    setMessage(loaded + " 字节 (" + progress.toFixed(1) + "%)", 'success');
  }

  function hideProgress() {
    window.progress_bar.style.display = "none";
  }

  function send() {
    var body = window.text_mode.checked ? window.text_input.value : window.file_input.files[0];

    if (!body) {
      setMessage("请选择文件或输入文本！", 'error');
      return;
    }

    var path = window.secret_path.value.trim();
    if (!path) {
      setMessage("请输入传输路径！", 'error');
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/" + path, true);

    if (!window.text_mode.checked && body.type === "") {
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
    }

    xhr.upload.onprogress = function (e) {
      setProgress(e.loaded, e.total);
    };

    xhr.upload.onload = function (e) {
      if (xhr.status === 200) {
        setProgress(e.loaded, e.total);
      }
    };

    xhr.onload = function () {
      if (xhr.status !== 200) {
        setMessage("发送失败：" + xhr.responseText, 'error');
        hideProgress();
      }
    };

    xhr.onerror = function () {
      setMessage("网络错误，请检查连接", 'error');
      hideProgress();
    };

    xhr.send(body);
    window.progress_bar.style.removeProperty("display");
  }

  // 动态替换 URL 占位符
  document.addEventListener('DOMContentLoaded', function() {
    var url = location.origin;
    var codeElements = document.querySelectorAll('.panel code');
    codeElements.forEach(function(el) {
      el.innerHTML = el.innerHTML.replace(/\$\{url\}/g, url);
    });
  });
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
<html lang="zh-CN">
<head>
  <title>无 JavaScript 文件传输</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta charset="UTF-8">
  <style nonce="${styleNonce}">
    body {
      font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 110%;
    }
    h3 {
      margin-top: 2em;
      margin-bottom: 0.5em;
    }
  </style>
</head>
<body>
  <h2>无 JavaScript 文件传输</h2>
  <form method="GET">
    <h3>第一步：设置路径和模式</h3>
    <input name="${pathQueryParameterName}" value="${escapedPath}" size="30" placeholder='例如："abc123"、"myimg.png"'>
    <input type="submit" value="应用"><br>
    <input type="radio" name="${modeQueryParameterName}" value="${fileMode}" ${mode === fileMode ? "checked" : ""}>文件
    <input type="radio" name="${modeQueryParameterName}" value="${textMode}" ${mode === textMode ? "checked" : ""}>文本<br>
  </form>
  <form method="POST" ${pathIsFilled ? `action="${escapedPath}"` : ""} enctype="multipart/form-data">${
    (mode === "text") ? `
    <h3>第二步：输入文本</h3>
    <textarea name="input_text" cols="30" ${pathIsFilled ? 'rows="10"' : "disabled"} placeholder="${pathIsFilled ? "" : "请先在上方填写路径"}"></textarea>`
    : `
    <h3>第二步：选择文件</h3>
    <input type="file" name="input_file" ${pathIsFilled ? "" : "disabled"}>`}
    <h3>第三步：发送</h3>
    <input type="submit" value="发送" ${pathIsFilled ? "" : "disabled"}>
  </form>
  <hr>
  版本 ${VERSION}<br>
  Piping Server：
  <a href="https://github.com/nwtgck/piping-server">
    https://github.com/nwtgck/piping-server
  </a><br>
  <a href=".">返回首页</a><br>
</body>
</html>
`;
}

/**
 * 生成帮助页面
 * @param {string} url
 * @returns {string}
 */
// tslint:disable-next-line:no-shadowed-variable
export function generateHelpPage(url: string): string {
  return (
`Piping Server 帮助文档 ${VERSION}
（项目地址：https://github.com/nwtgck/piping-server）

======= 接收数据 =======
curl ${url}/mypath

======= 发送数据 =======
# 发送文件
curl -T myfile ${url}/mypath

# 发送文本
echo '你好！' | curl -T - ${url}/mypath

# 发送目录（zip 格式）
zip -q -r - ./mydir | curl -T - ${url}/mypath

# 发送目录（tar.gz 格式）
tar zfcp - ./mydir | curl -T - ${url}/mypath

# 加密传输
## 发送加密数据
cat myfile | openssl aes-256-cbc | curl -T - ${url}/mypath
## 接收并解密数据
curl ${url}/mypath | openssl aes-256-cbc -d
`);
}
