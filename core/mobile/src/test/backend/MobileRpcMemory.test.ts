import { spawnSync } from "node:child_process";
import { expect } from "chai";
import type { MemoryReport } from "./MobileRpcMemoryTestProcess";

const enabled = /^(1|true|yes)$/i.test(process.env.ITWIN_INCLUDE_MOBILE_RPC_MEMORY_TESTS ?? "");
const memoryIt = enabled ? it : it.skip;
const sizes = (process.env.ITWIN_MOBILE_RPC_MEMORY_MIB ?? "16,64,128").split(",").map(Number);

describe("Mobile RPC host memory measurements", () => {
  for (const sizeMiB of sizes) {
    memoryIt(`measures a ${sizeMiB} MiB backend-to-frontend response`, function () {
      this.timeout(120000);
      expect(Number.isInteger(sizeMiB) && sizeMiB >= 1 && sizeMiB <= 512, "Payload sizes must be integer MiB values between 1 and 512.").to.equal(true);
      const fixture = require.resolve("./MobileRpcMemoryTestProcess");
      const result = spawnSync(process.execPath, ["--expose-gc", fixture, String(sizeMiB * 1024 * 1024)], {
        encoding: "utf8", timeout: 90000,
      });
      const diagnostics = `${result.stdout}\n${result.stderr}`;
      expect(result.error, diagnostics).to.equal(undefined);
      expect(result.signal, diagnostics).to.equal(null);
      expect(result.status, diagnostics).to.equal(0);
      const report = JSON.parse(result.stdout) as MemoryReport;
      expect(report.payloadBytes).to.equal(sizeMiB * 1024 * 1024);
      for (const side of [report.frontend, report.backend]) {
        expect(side.samples).to.be.greaterThan(0);
        expect(side.peak.rss).to.be.at.least(side.baseline.rss);
      }
      process.stdout.write(`Mobile RPC host memory (${sizeMiB} MiB; memory values in bytes): ${JSON.stringify(report)}\n`);
    });
  }
});
