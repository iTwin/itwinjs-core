/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";

interface Entry {
  testSuite: string;
  testName: string;
  valueName: string;
  value: number;
  info: any;
}

export class PerfReporter {
  private _entries: Entry[] = [];
  public addEntry(testSuite: string, testName: string, valueName: string, value: number, info: any) {
    const entry: Entry = { testSuite, testName, valueName, value, info };
    this._entries.push(entry);
  }

  public exportCSV(fileName: string) {
    let finalReport: string = "";
    if (!fileName.endsWith(".csv")) {
      fileName = fileName + ".csv";
    }
    if (!fs.existsSync(fileName)) {
      finalReport += "Test Suite,Test Name,Value Name,Value,Info\n";
    }
    for (const entry of this._entries) {
      finalReport += `${entry.testName},${entry.testSuite},${entry.valueName},${entry.value},${entry.info}\n`;
    }
    fs.appendFileSync(fileName, finalReport);
  }
}
