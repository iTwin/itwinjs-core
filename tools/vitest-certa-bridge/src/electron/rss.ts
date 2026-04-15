/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { execSync } from "child_process";
import * as fs from "fs";

/**
 * Sample the resident set size (RSS) of a process in kilobytes.
 * Returns 0 if the process no longer exists or the platform is unsupported.
 */
export function sampleRssKb(pid: number): number {
  if (!Number.isInteger(pid) || pid <= 0)
    return 0;
  try {
    if (process.platform === "linux") {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const match = /VmRSS:\s+(\d+)\s+kB/.exec(status);
      return match ? parseInt(match[1], 10) : 0;
    }
    // macOS and other Unix: ps -o rss= returns RSS in KB
    const out = execSync(`ps -o rss= -p ${pid} 2>/dev/null`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return parseInt(out.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/** Poll a process's RSS at a fixed interval and track the peak value. */
export class RssPoller {
  private _intervalHandle: ReturnType<typeof setInterval> | undefined;
  private _peak = 0;

  constructor(private readonly _pid: number, intervalMs = 500) {
    this._intervalHandle = setInterval(() => {
      const rss = sampleRssKb(this._pid);
      if (rss > this._peak)
        this._peak = rss;
    }, intervalMs);
    // Allow Node to exit even if this interval is still running
    if (this._intervalHandle.unref)
      this._intervalHandle.unref();
  }

  public get peakKb(): number { return this._peak; }

  public stop(): number {
    if (this._intervalHandle) {
      clearInterval(this._intervalHandle);
      this._intervalHandle = undefined;
    }
    // Take one final sample in case the interval missed the peak
    const final = sampleRssKb(this._pid);
    if (final > this._peak)
      this._peak = final;
    return this._peak;
  }
}
