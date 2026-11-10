import { spawnSync } from "node:child_process";
import { expect } from "chai";

describe("MobileRpcServer", () => {
  const titles = {
    "connected": "sends small text and binary responses while connected",
    "pending": "replays queued messages when a client connects",
    "string": "survives a string response after the client disconnects",
    "binary": "survives a binary response after the client disconnects",
    "callback-error": "survives asynchronous send errors and closes the failed connection",
    "throw-error": "survives synchronous send errors and closes the failed connection",
    "socket-error": "survives socket errors and closes the failed connection",
    "missing-connection": "throws when an installed sender has no connection",
    "send-queue": "paces writes by completion callbacks and discards queued sends on close",
  };
  for (const mode of ["connected", "pending", "string", "binary", "callback-error", "throw-error", "socket-error", "missing-connection", "send-queue"] as const) {
    it(titles[mode], function () {
      this.timeout(15000);
      const fixture = require.resolve("./MobileRpcServerTestProcess");
      const script = `require(${JSON.stringify(fixture)}).run(${JSON.stringify(mode)}).catch((error) => { console.error(error); process.exitCode = 1; });`;
      const result = spawnSync(process.execPath, ["--eval", script], { encoding: "utf8", timeout: 10000 });
      const diagnostics = `${result.stdout}\n${result.stderr}`;

      expect(result.error, diagnostics).to.equal(undefined);
      expect(result.signal, diagnostics).to.equal(null);
      expect(result.stdout, diagnostics).to.include("Connected transfers succeeded.");
      if (mode === "string" || mode === "binary")
        expect(result.stdout, diagnostics).to.include("Client disconnected.");

      expect(result.status, diagnostics).to.equal(0);
      if (mode === "string" || mode === "binary")
        expect(result.stdout, diagnostics).to.include("Backend survived the late send.");
      if (mode === "callback-error" || mode === "throw-error" || mode === "socket-error")
        expect(result.stdout, diagnostics).to.include("Backend survived a socket failure.");
    });
  }
});
