/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@itwin/core-bentley";
import { TestRpcInterface } from "../common/RpcInterfaces";

interface PerfEntry {
  testSuite: string;
  testName: string;
  valueDescription: string;
  value: number;
  date: string;
  environment: string;
  info?: string;
}

export class FrontendPerfReporter {
  private readonly _entries: PerfEntry[] = [];
  private readonly _csvPath: string;

  constructor(csvPath: string) {
    this._csvPath = csvPath;
  }

  public get csvPath(): string {
    return this._csvPath;
  }

  /**
   * Add an entry to the performance report.
   * @param testSuite Name of the test suite that is being run.
   * @param testName The particular test that is being reported.
   * @param valueDescription The description of the value being recorded.
   * @param value The actual value of the test.
   * @param info Optional additional details string.
   */
  public addEntry(testSuite: string, testName: string, valueDescription: string, value: number, info?: string): void {
    this._entries.push({
      testSuite,
      testName,
      valueDescription,
      value,
      info,
      date: new Date().toISOString(),
      environment: ProcessDetector.isElectronAppFrontend ? "Electron" : "Chrome",
    });
  }

  /** Clear all entries. */
  public clearEntries(): void {
    this._entries.length = 0;
  }

  private _escapeCsvField(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  public async exportCSV(): Promise<void> {
    let csv = "\nTestSuite,TestName,ValueDescription,Value,Environment,Info,Date\n";
    for (const e of this._entries) {
      const escapedSuite = this._escapeCsvField(e.testSuite);
      const escapedName = this._escapeCsvField(e.testName);
      const escapedDesc = this._escapeCsvField(e.valueDescription);
      const escapedInfo = this._escapeCsvField(e.info ?? "");
      csv += `${escapedSuite},${escapedName},${escapedDesc},${e.value},${e.environment},${escapedInfo},${e.date}\n`;
    }

    // Use append mode so Chrome and Electron results don't overwrite each other
    await TestRpcInterface.getClient().writeTestOutputFile(this._csvPath, csv, true);
  }
}
