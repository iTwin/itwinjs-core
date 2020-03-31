/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import * as Utils from "./utils";

// this class creates pseudo-localized versions of all the locale .json files specified in the sourceDirectory.
export class PseudoLocalizer {
  constructor(private _sourceDirectory: string, private _destDirectory: string, private _detail: number) { }

  private static _replacements: any = {
    A: "\u00C0\u00C1,\u00C2\u00C3,\u00C4\u00C5",
    a: "\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5",
    B: "\u00DF",
    c: "\u00A2\u00E7",
    C: "\u00C7\u0028",
    D: "\u00D0",
    E: "\u00C8\u00C9\u00CA\u00CB",
    e: "\u00E8\u00E9\u00EA\u00EB",
    I: "\u00CC\u00CD\u00CE\u00CF",
    i: "\u00EC\u00ED\u00EE\u00EF",
    L: "\u00A3",
    N: "\u00D1",
    n: "\u00F1",
    O: "\u00D2\u00D3\u00D4\u00D5\u00D6",
    o: "\u00F2\u00F3\u00F4\u00F5\u00F6\u00F8",
    S: "\u0024\u00A7",
    U: "\u00D9\u00DA\u00DB\u00DC",
    u: "\u00B5\u00F9\u00FA\u00FB\u00FC",
    x: "\u00D7",
    Y: "\u00DD\u00A5",
    y: "\u00FD\u00FF",
  };

  // pseudoLocalizes a string
  private convertString(inputString: string): string {
    let inReplace = 0;
    let outString = "";
    let replaceIndex = 0; // Note: the pseudoLocalize algorithm would normally use random, but here we cycle through because Javascript doesn't allow setting of the seed for Math.random.
    for (let iChar = 0; iChar < inputString.length; iChar++) {
      const thisChar = inputString.charAt(iChar);
      const nextChar = ((iChar + 1) < inputString.length) ? inputString.charAt(iChar + 1) : 0;

      // handle the {{ and }} delimiters for placeholders - don't want to do anything to characters in between.
      if (("{" === thisChar) && ("{" === nextChar)) {
        inReplace++;
        iChar++;
        outString = outString.concat("{{");
      } else if (("}" === thisChar) && ("}" === nextChar) && (inReplace > 0)) {
        inReplace--;
        iChar++;
        outString = outString.concat("}}");
      } else {
        let replacementChar = thisChar;
        if (0 === inReplace) {
          const replacementsForChar = PseudoLocalizer._replacements[thisChar];
          if (undefined !== replacementsForChar) {
            replacementChar = replacementsForChar.charAt(replaceIndex++ % replacementsForChar.length);
          }
        }
        outString = outString.concat(replacementChar);
      }
    }
    return outString;
  }

  // converts the JSON object
  private convertObject(objIn: any): any {
    const objOut: any = {};
    for (const prop in objIn) {
      if (objIn.hasOwnProperty(prop)) {
        if (typeof objIn[prop] === "string") {
          objOut[prop] = this.convertString(objIn[prop]);
        } else if (typeof objIn[prop] === "object") {
          objOut[prop] = this.convertObject(objIn[prop]);
        }
      }
    }
    return objOut;
  }

  // converts each JSON file.
  private convertFile(inputFilePath: string, outputFile: string): number {
    // read the file
    const jsonIn = fs.readFileSync(inputFilePath, { encoding: "utf8" });
    const objIn = JSON.parse(jsonIn);

    const objOut = this.convertObject(objIn);
    fs.writeFileSync(outputFile, JSON.stringify(objOut, null, 2));

    return 0;
  }

  public convertAll(): Utils.Result {
    try {
      fs.mkdirSync(this._destDirectory, { recursive: true });

      const sourceSpecification: string = path.join(this._sourceDirectory, "**/*.json");
      const found: string[] = glob.sync(sourceSpecification, { nodir: true });

      for (const fileName of found) {
        // find it relative to source.
        const relativePath = path.relative(this._sourceDirectory, fileName);
        const outputPath = path.resolve(this._destDirectory, relativePath);
        if (Utils.isSymLink(outputPath)) {
          if (this._detail > 3)
            console.log("  File", outputPath, "already exists and is a symLink - skipped.");
        } else {
          if (this._detail > 3)
            console.log("  PseudoLocalizing", fileName, "to", outputPath);
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          this.convertFile(fileName, outputPath);
        }
      }
    } catch (error) {
      return new Utils.Result("PseudoLocalize", 1, error);
    }
    return new Utils.Result("PseudoLocalize", 0);
  }
}
