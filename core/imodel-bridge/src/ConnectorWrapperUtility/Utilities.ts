/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const fs = require("fs");
export class Utilities {
  public static isEmpty(str: any) {
    return (!str || 0 === str.length || str === undefined);
  }

  public static cleanString(str: any): string {
    return str.replace(/^"(.*)"$/, "$1");
  }

  public static convertSeconds(seconds: number) { // day, h, m and s
    const days     = Math.floor(seconds / (24 * 60 * 60));
    seconds -= days    * (24 * 60 * 60);
    const hours    = Math.floor(seconds / (60 * 60));
    seconds -= hours   * (60 * 60);
    const minutes  = Math.floor(seconds / (60));
    seconds -= minutes * (60);
    return ((0 < days) ? (days + " day, ") : "") + hours + "h, " + minutes + "m and " + seconds + "s";
  }

  public static isGuid( guid: string ) {
    const s = "" + guid;
    const result = s.match("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    if (result === null) {
      return false;
    }
    return true;
  }

  public static isEmptyVariableAllowed(value: string, exempted: string[]): boolean {
    if (exempted) {
      for (const variable of exempted) {
        if (value.toLowerCase() === variable.toLowerCase())
          return true;
      }
    }
    return false;
  }

  public static async isProcessRunning(processName: string): Promise<boolean> {
    const cmd = (() => {
      switch (process.platform) {
        case "win32": return `tasklist`;
        case "darwin": return `ps -ax | grep ${processName}`;
        case "linux": return `ps -A`;
        default: return false;
      }
    })();

    return new Promise((resolve, reject) => {
      require("child_process").exec(cmd, (err: Error, stdout: string) => {
        if (err) reject(err);

        resolve(stdout.toLowerCase().indexOf(processName.toLowerCase()) > -1);
      });
    });
  }

  public static getTime(): string {
    const today = new Date();
    return today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  }

  public static async delay(seconds: number) {
    const ms = 1000 * seconds;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public static async delayInformativelyForMinutes(delayMinutesBeforeBridging: number) {
    const delayIntervalInMinutes = 1;
    const delayIntervalSeconds = delayIntervalInMinutes * 60;
    let delayMinutesLeft = delayMinutesBeforeBridging;
    while (delayMinutesLeft > 0) {
      console.log(`Delaying, minutes left: ${delayMinutesLeft}`);
      await Utilities.delay(delayIntervalSeconds);

      delayMinutesLeft = delayMinutesLeft - delayIntervalInMinutes;
    }
  }

  public static exportResultsToFile(text: string, filePath: string) {

    try {
      const writeStream = fs.createWriteStream(filePath);

      // write some data with a base64 encoding
      writeStream.write(text, "UTF-8");

      // the finish event is emitted when all data has been flushed from the stream
      writeStream.on("finish", () => {
        console.log("wrote all data to file");
      });

      // close the stream
      writeStream.end();
    } catch (ex) {
      console.log(`Exception export Result${filePath} ${ex}`);
    }
  }

}
