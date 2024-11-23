/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import { marked, Tokens } from "marked";
import { IModelTestUtils } from "../IModelTestUtils";

export interface ECDbTestProps {
  fileName: string;
  title: string;

  // Things from properties:
  only?: boolean;    //  This flag handles the only property to filter tests
  dataset?: string;
  mode: ECDbTestMode;
  rowFormat: ECDbTestRowFormat;
  abbreviateBlobs: boolean;
  convertClassIdsToClassNames: boolean;
  errorDuringPrepare?: boolean;

  // TODO: implement, it's currently being parsed but not used
  stepStatus?: string;

  // Things from code blocks or tables
  sql?: string;
  expectedResults?: { [key: string]: any }[] | any[];
  columnInfo?: ColumnInfoProps[];

  // Things from lists
  binders?: ECDbTestBinderProps[];
}

export interface ECDbTestBinderProps {
  indexOrName: string;
  type: string;
  value: string;
}

export interface ColumnInfoProps{
  name: string;
  className?: string;
  accessString?: string;
  generated?: boolean;
  index?: number;
  jsonName?: string;
  // expected extendedType value should be given when we know that the actual column info extendedType will be a valid non empty string for test to pass.
  // This extendedType value is internally used to check both extendType and extendedType values of column metadata.
  extendedType?: string;
  type?: string; // type is used on ECSqlStatement because it can differ from TypeName
  typeName?: string; // typeName is used on ConcurrentQuery
  originPropertyName?: string; // only supported for ECSqlStatement
}

export const columnInfoPropsKeys: Set<keyof ColumnInfoProps> = new Set([
  "name",
  "className",
  "accessString",
  "generated",
  "index",
  "jsonName",
  "extendedType",
  "type",
  "typeName",
  "originPropertyName",
]);

/* interface QueryPropertyMetaData
  className: string;
  accessString?: string;
  generated: boolean;
  index: number;
  jsonName: string;
  name: string;
  extendType: string;
  typeName: string;
*/

function isColumnInfoProps(obj: any): obj is ColumnInfoProps {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  const isValid = typeof obj === "object" &&
    typeof obj.name === "string" &&
    (obj.className === undefined || typeof obj.className === "string") &&
    (obj.accessString === undefined || typeof obj.accessString === "string") &&
    (obj.generated === undefined || typeof obj.generated === "boolean") &&
    (obj.index === undefined || typeof obj.index === "number") &&
    (obj.jsonName === undefined || typeof obj.jsonName === "string") &&
    (obj.extendedType === undefined || typeof obj.extendedType === "string") &&
    (obj.type === undefined || typeof obj.type === "string") &&
    (obj.typeName === undefined || typeof obj.typeName === "string");

  if (!isValid) {
    const errors: string[] = [];
    if (typeof obj !== "object") errors.push("Object is not of type 'object'");
    if (numberOfKeys < 1 || numberOfKeys > 7) errors.push("Number of keys is not between 1 and 7");
    if (typeof obj.name !== "string") errors.push("Property 'name' is not of type 'string'");
    if (obj.className !== undefined && typeof obj.className !== "string") errors.push("Property 'className' is not of type 'string'");
    if (obj.accessString !== undefined && typeof obj.accessString !== "string") errors.push("Property 'accessString' is not of type 'string'");
    if (obj.generated !== undefined && typeof obj.generated !== "boolean") errors.push("Property 'generated' is not of type 'boolean'");
    if (obj.index !== undefined && typeof obj.index !== "number") errors.push("Property 'index' is not of type 'number'");
    if (obj.jsonName !== undefined && typeof obj.jsonName !== "string") errors.push("Property 'jsonName' is not of type 'string'");
    if (obj.extendedType !== undefined && typeof obj.extendedType !== "string") errors.push("Property 'extendedType' is not of type 'string'");
    if (obj.type !== undefined && typeof obj.type !== "string") errors.push("Property 'type' is not of type 'string'");
    if (obj.typeName !== undefined && typeof obj.typeName !== "string") errors.push("Property 'typeName' is not of type 'string'");
    logWarning(`Validation failed for ColumnInfoProps. Object: ${JSON.stringify(obj)}. Errors: ${errors.join(", ")}`);
  }

  return isValid;
}

export enum ECDbTestMode{
  Both = "Both",
  Statement = "Statement",
  ConcurrentQuery = "ConcurrentQuery",
};

export enum ECDbTestRowFormat {
  ECSqlNames = "ECSqlNames",
  ECSqlIndexes = "ECSqlIndexes",
  JsNames = "JsNames",
}

function tableTextToValue(text: string) : any {
  if(text.startsWith("\"") && text.endsWith("\""))
    return text.slice(1,text.length-1);
  if(text === "null")
    return null;
  if(text === "undefined")
    return undefined;
  if(text.startsWith("{") || text.startsWith("["))
    return JSON.parse(text);
  if(text === "true" || text === "false")
    return text === "true";
  if(text.startsWith("0x"))
    return text; // we use this for IDs and they are handled as strings, the parseInt below would attempt to convert them to numbers
  if(/^-?\d+(\.\d+)?$/.test(text)) {
    const flt = parseFloat(text);
    if(!Number.isNaN(flt))
      return flt;
  }

  if(/^-?\d+$/.test(text)) {
    // eslint-disable-next-line radix
    const asInt = parseInt(text);
    if(!Number.isNaN(asInt))
      return asInt;
  }

  return text;
}

export function buildBinaryData(obj: any): any { //TODO: we should do this during table parsing
  for(const key in obj) {
    if(typeof obj[key] === "string" && obj[key].startsWith("BIN(") && obj[key].endsWith(")"))
      obj[key] = understandAndReplaceBinaryData(obj[key])
    else if(typeof obj[key] === "object" || Array.isArray(obj[key]))
      obj[key] = buildBinaryData(obj[key])
  }
  return obj;
}

function understandAndReplaceBinaryData(str: string): any{
    const startInd = str.indexOf("(") + 1;
    const endInd = str.indexOf(")");
    str = str.slice(startInd, endInd);
    const ans: number[] = []
    const numbers: string[] = str.split(",");
    numbers.forEach((value:string)=>
      {
        value = value.trim();
        // eslint-disable-next-line radix
        ans.push(parseInt(value));
      }
    );
    return  Uint8Array.of(...ans);
}


export class ECDbMarkdownTestParser {
  public static parse(): ECDbTestProps[] {
    const testAssetsDir = IModelTestUtils.resolveAssetFile("ECDbTests");
    const testFiles = fs.readdirSync(testAssetsDir, "utf-8").filter((fileName) => fileName.toLowerCase().endsWith("ecdbtest.md"));
    const out: ECDbTestProps[] = [];

    for (const fileName of testFiles) {
      const markdownFilePath = path.join(testAssetsDir, fileName);
      const baseFileName = fileName.replace(/\.ecdbtest\.md$/i, "");
      const markdownContent = fs.readFileSync(markdownFilePath, "utf-8");
      const tokens = marked.lexer(markdownContent);

      let currentTest: ECDbTestProps | undefined;

      for (const token of tokens) {
        switch (token.type) {
          case "space":
          case "html":
          case "paragraph":
          case "hr":
            continue;
          case "heading":
              if (currentTest !== undefined) {
                out.push(currentTest);
              }
              currentTest = { title: token.text, mode: ECDbTestMode.Both, fileName: baseFileName,
                rowFormat: ECDbTestRowFormat.ECSqlNames, abbreviateBlobs: false, convertClassIdsToClassNames: false };
            break;
          case "list":
            this.handleListToken(token as Tokens.List, currentTest, markdownFilePath);
            break;
          case "code":
            this.handleCodeToken(token as Tokens.Code, currentTest, markdownFilePath);
            break;
          case "table":
            this.handleTableToken(token as Tokens.Table, currentTest, markdownFilePath);
            break;
          default:
            logWarning(`Unknown token type ${token.type} found in file ${markdownFilePath}. Skipping.`);
            break;
        }
      }

      if (currentTest !== undefined) {
        out.push(currentTest);
      }
    }
    return out;
  }

  private static handleListToken(token: Tokens.List, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      logWarning(`List token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }

    const variableRegex = /^(\w+):\s*(.+)$/;
    const bindRegex = /^bind(\w+)\s([^,\s]+),\s?(.+)$/;
    for (const item of token.items) {
      const match = item.text.match(variableRegex);
      if (match) {
        const key = match[1];
        const value = match[2];
        switch (key.toLowerCase()) {
          case "dataset":
            currentTest.dataset = value;
            continue;
          case "errorduringprepare":
            currentTest.errorDuringPrepare = value.toLowerCase() === "true";
            continue;
          case "stepstatus":
            currentTest.stepStatus = value;
            continue;
          case "only":
            currentTest.only = value.toLowerCase() === "true";
            continue;
          case "mode":
            this.handleMode(value, currentTest, markdownFilePath);
            continue;
          case "rowformat":
            this.handleRowFormat(value, currentTest, markdownFilePath);
            continue;
          case "abbreviateblobs":
            currentTest.abbreviateBlobs = value.toLowerCase() === "true";
            continue;
          case "convertclassidstoclassnames":
            currentTest.convertClassIdsToClassNames = value.toLowerCase() === "true";
            continue;
        }
      }
      const bindMatch = item.text.match(bindRegex);
      if (bindMatch) {
        currentTest.binders = currentTest.binders || [];
        currentTest.binders.push({ indexOrName: bindMatch[2], type: bindMatch[1], value: bindMatch[3] });
        continue;
      }
    }
  }

  private static handleMode(value: string, currentTest: ECDbTestProps, markdownFilePath: string) {
    switch(value.toLowerCase()) {
      case "statement":
        currentTest.mode = ECDbTestMode.Statement;
        break;
      case "concurrentquery":
        currentTest.mode = ECDbTestMode.ConcurrentQuery;
        break;
      case "both":
        currentTest.mode = ECDbTestMode.Both;
        break;
      default:
        logWarning(`Mode value (${value}) is not recognized in file ${markdownFilePath} and test ${currentTest.title}. Skipping.`);
    }
  }

 private static handleRowFormat(value: string, currentTest: ECDbTestProps, markdownFilePath: string) {
    switch(value.toLowerCase()) {
      case "ecsqlnames":
        currentTest.rowFormat = ECDbTestRowFormat.ECSqlNames;
        break;
      case "ecsqlindexes":
        currentTest.rowFormat = ECDbTestRowFormat.ECSqlIndexes;
        break;
      case "jsnames":
        currentTest.rowFormat = ECDbTestRowFormat.JsNames;
        break;
      default:
        logWarning(`Row Format value (${value}) is not recognized in file ${markdownFilePath} and test ${currentTest.title}. Skipping.`);
    }
  }

  private static handleCodeToken(token: Tokens.Code, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      logWarning(`Code token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }

    if (token.lang === "sql") {
      currentTest.sql = token.text;
    } else if (token.lang === "json") {
      let json: any;
      try {
        json = JSON.parse(token.text);
      } catch (error) {
        if (error instanceof Error) {
          logWarning(`Failed to parse JSON ${token.text} in file ${markdownFilePath}. ${error.message} Skipping.`);
        } else {
          logWarning(`Failed to parse SON ${token.text} in file ${markdownFilePath}. Unknown error. Skipping.`);
        }
      }

      if (typeof json === "object" && Array.isArray(json.columns)) {
        this.handleJSONColumnMetadata(json, currentTest, markdownFilePath);
        return;
      }

      this.handleJSONExpectedResults(json, currentTest); // TODO: validate the expected results
    } else {
      logWarning(`Unknown code language ${token.lang} found in file ${markdownFilePath}. Skipping.`);
    }
  }

  private static handleJSONColumnMetadata(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    const extraProps: Set<string> = new Set();

    if (json.columns.every(isColumnInfoProps)) {
      currentTest.columnInfo = json.columns;
      for (const column of json.columns) {
        for (const key in column) {
          if (!columnInfoPropsKeys.has(key as keyof ColumnInfoProps)) {
            extraProps.add(key);
          }
        }
      }

      if (extraProps.size > 0) {
        logWarning(`Found extra properties in column infos: ${Array.from(extraProps).join(", ")} in file '${markdownFilePath}' test '${currentTest.title}'.`);
      }
    } else {
      logWarning(`Columns format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard. Skipping.`);
    }
  }

  private static handleJSONExpectedResults(json: any, currentTest: ECDbTestProps) {
    currentTest.expectedResults = json
  }

  private static handleTableToken(token: Tokens.Table, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      logWarning(`Table token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }

    this.handleTable(token, currentTest, markdownFilePath);
  }

  private static handleTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    if (token.header.length > 0 && currentTest.columnInfo === undefined && columnInfoPropsKeys.has(token.header[0].text as keyof ColumnInfoProps)) {
      this.handleColumnTable(token, currentTest, markdownFilePath);
      return;
    }
    else if(token.header.length > 0 && token.header[0].text === ""){
      this.handleExpectedResultsTableForECSqlPropertyIndexesOption(token, currentTest, markdownFilePath);
    } else {
      this.handleExpectedResultsTable(token, currentTest, markdownFilePath);
    }
  }

  private static handleColumnTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    const columnInfos: any[] = [];
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        logWarning(`Rows in a expected result table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }
      const columnInfo: { [key: string]: any } = {};
      for (let i = 0; i < token.header.length; i++) {
        const header = token.header[i].text;
        const cell = row[i].text;
        columnInfo[header] = tableTextToValue(cell);
      }
      columnInfos.push(columnInfo);
    }

    this.handleJSONColumnMetadata({columns: columnInfos}, currentTest, markdownFilePath);
  }

  private static handleExpectedResultsTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.expectedResults !== undefined) {
      logWarning(`Expected results already set for test ${currentTest.title} in file ${markdownFilePath}. Skipping.`);
      return;
    }
    currentTest.expectedResults = [];
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        logWarning(`Rows in a expected result table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }

      const expectedResult: { [key: string]: any } = {};
      for (let i = 0; i < token.header.length; i++) {
        const header = token.header[i].text;
        const cell = row[i].text;
        expectedResult[header] = tableTextToValue(cell);
      }
      currentTest.expectedResults.push(expectedResult);
    }
  }

  private static handleExpectedResultsTableForECSqlPropertyIndexesOption(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.expectedResults !== undefined) {
      logWarning(`Expected results already set for test ${currentTest.title} in file ${markdownFilePath}. Skipping.`);
      return;
    }
    currentTest.expectedResults = [];
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        logWarning(`Rows in a expected result table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }

      const expectedResult: any[] = [];
      for (let i = 0; i < token.header.length; i++) {
        const cell = row[i].text;
        expectedResult.push(tableTextToValue(cell));
      }
      currentTest.expectedResults.push(expectedResult);
    }
  }
}

function logWarning(message: string) {
  // eslint-disable-next-line no-console
  console.log(`\x1b[33m${message}\x1b[0m`);
}