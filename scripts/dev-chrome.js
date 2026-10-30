const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
];

const chromePath = chromeCandidates.find((p) => p && fs.existsSync(p));

function openChrome(url) {
  if (chromePath) {
    spawn(chromePath, [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("cmd.exe", ["/c", "start", "", "chrome", url], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }
}

const nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: path.join(__dirname, ".."),
  stdio: ["inherit", "pipe", "pipe"],
});

let opened = false;
let combinedLog = "";

function checkOutput(text) {
  combinedLog += text;
  if (opened) return;

  // 1) 이미 다른 터미널에서 서버가 켜져 있는 경우 -> 기존 서버 주소(3000번)를 크롬으로 바로 열어줌
  if (combinedLog.includes("Another next dev server is already running")) {
    const existingMatch = combinedLog.match(/existing server at (https?:\/\/localhost:\d+)/);
    const url = existingMatch ? existingMatch[1] : "http://localhost:3000";
    opened = true;
    console.log(`\n🌐 이미 실행 중인 서버(${url})를 Chrome으로 엽니다...`);
    openChrome(url);
    return;
  }

  // 2) 새로 서버가 정상 시작된 경우 -> Ready 메시지가 떴을 때 크롬으로 열어줌
  if (combinedLog.includes("Ready in")) {
    const localMatch = combinedLog.match(/-\s*Local:\s*(https?:\/\/localhost:\d+)/);
    if (localMatch) {
      opened = true;
      openChrome(localMatch[1]);
    }
  }
}

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  checkOutput(text);
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  checkOutput(text);
});

child.on("exit", (code) => {
  // 이미 실행 중인 서버가 있어서 종료된 경우 에러 코드 대신 정상 종료 처리
  if (combinedLog.includes("Another next dev server is already running")) {
    process.exit(0);
  }
  process.exit(code ?? 0);
});
