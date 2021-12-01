/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";

interface Entry {
  testSuite: string;
  testName: string;
  valueDescription: string;
  value: number;
  date: string;
  info?: object;
}

/** @beta */
export class Reporter {
  private _entries: Entry[] = [];

  /**
   * Add entries to performance test report
   * @param testSuite Name of the test suite that is being run
   * @param testName The particular test that is being reported
   * @param valueDescription The description of the value being recorded
   * @param value The actual value of the test
   * @param info A JSON object for additional details
   */
  public addEntry(testSuite: string, testName: string, valueDescription: string, value: number, info?: any) {
    const date = new Date().toISOString();
    const entry: Entry = { testSuite, testName, valueDescription, value, date, info };
    this._entries.push(entry);
  }

  /**
   * Clear entries to get a fresh start
   */
  public clearEntries() {
    this._entries = [];
  }

  /**
   * Create CSV file with report. Call after all test have run
   * @param fileName Name of the CSV file with or without .csv
   */
  public exportCSV(fileName: string) {
    let finalReport: string = "";
    if (!fileName.endsWith(".csv")) {
      fileName = `${fileName}.csv`;
    }
    if (!fs.existsSync(fileName)) {
      finalReport += "TestSuite,TestName,ValueDescription,Value,Date,Info\n";
    }
    for (const entry of this._entries) {
      let info = JSON.stringify(entry.info) ?? "";
      info = info.replace(/\"/g, '""');
      info = `"${info}"`;
      finalReport += `${entry.testSuite},${entry.testName},${entry.valueDescription},${entry.value},${entry.date},${info}\n`;
    }
    fs.appendFileSync(fileName, finalReport);
  }
}
