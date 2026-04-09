/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";

/** @beta */
export class CsvWriter {
  private _entries: Record<string, any>[] = [];

  public addEntry(data: Record<string, any>) {
    this._entries.push(data);
  }

  public clear() {
    this._entries = [];
  }

  /**
   * Create CSV file with report. Call after all test have run
   * @param fileName Name of the CSV file with or without .csv
   */
  public exportCSV(fileName: string) {
    if (!fileName.endsWith(".csv")) {
      fileName = `${fileName}.csv`;
    }

    if (this._entries.length === 0) {
      fs.writeFileSync(fileName, "");
      return;
    }

    // Get headers from the first entry to preserve order
    const headers = Object.keys(this._entries[0]);

    // Create header row
    let csvContent = `${headers.join(",")}\n`;

    // Create data rows
    for (const entry of this._entries) {
      const row = headers.map(header => {
        const value = entry[header];
        if (value === undefined || value === null) {
          return "";
        }

        // Convert to string and escape quotes
        let stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          stringValue = stringValue.replace(/"/g, '""');
          stringValue = `"${stringValue}"`;
        }
        return stringValue;
      });
      csvContent += `${row.join(",")}\n`;
    }

    // Replace the entire file
    fs.writeFileSync(fileName, csvContent);
  }
}
