
import * as child_process from "child_process";

const execSync = child_process.execSync;
let args = "";
let browser = "";
for (let i = 2; i < process.argv.length; i++) {
  const curArg = process.argv[i];
  args += curArg + " ";
  if (curArg === "chrome" || curArg === "edge" || curArg === "firefox")
    browser = curArg;
}
execSync("run-p \"start:webserver\" \"start:backend " + args + "\"", { stdio: [0, 1, 2] });

if (browser === "chrome")
  execSync("taskkill /f /im chrome.exe /t >nul");
else if (browser === "edge")
  execSync("taskkill /f /im MicrosoftEdge.exe /t >nul");
else if (browser === "firefox")
  execSync("taskkill /f /im firefox.exe /t >nul");
