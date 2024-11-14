/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import { marked, Tokens } from "marked";
import { IModelTestUtils } from "../IModelTestUtils";
import { ECSqlRowArg } from "../../core-backend";
import { QueryLimit, QueryOptions, QueryQuota, QueryRowFormat } from "@itwin/core-common";

export interface ECDbTestProps {
  fileName: string;
  title: string;
  toBeIncluded: boolean;    //  This flag handles the only: business and modifies accordingly
  dataset?: string;
  queryType?: TypeOfQuery
  sql?: string;
  binders?: ECDbTestBinderProps[];
  errorDuringPrepare?: string;
  stepStatus?: string;
  rowOptions?: ConcurrentQueryRowOptions;
  expectedResults?: { [key: string]: any }[] | any[];
  columnInfo?: ColumnInfoProps[];
}

export interface ConcurrentQueryRowOptions extends Omit<QueryOptions,"rowFormat">{
  rowFormat?: string;
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
  extendedType?: string;
  type?: string; // type is used on ECSqlStatement because it can differ from TypeName
  typeName?: string; // typeName is used on ConcurrentQuery
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

export interface ECSqlStatementECDbColumnInfoProps {
  accessString: string;
  propertyName?: string;
  originPropertyName?: string;
  rootClassAlias?: string;
  rootClassName?: string;
  rootClassTableSpace?: string;
  type?: string;
  isEnum?: boolean;
  isGeneratedProperty?: boolean;
  isSystemProperty?: boolean;
  isDynamicProp?: boolean;
}

export interface ConcurrentQueryECDbColumnInfoProps {
  name: string;
  className?: string;
  accessString?: string;
  generated?: boolean;
  index?: number;
  jsonName?: string;
  extendType?: string;
  typeName?: string;
}

export enum TypeOfQuery{

  ECSqlStatement = 0, //TODO: rename, it conflicts with a type of that name
  ConcurrentQuery = 1,
  Both = 2
};

function isValidRowFormat(str: string): boolean {
  const toLowerCase = str.toLowerCase();
  return toLowerCase === "useecsqlpropertynames" || toLowerCase === "useecsqlpropertyindexes" || toLowerCase === "usejspropertynames"
}

function isValidQueryLimit(obj: any): obj is QueryLimit {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
      (numberOfKeys >= 0 && numberOfKeys<=2) &&
      (obj.count === undefined || typeof obj.count === "number") &&
      (obj.offset === undefined || typeof obj.offset === "number");
}

function isValidQueryQuota(obj: any): obj is QueryQuota {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
      (numberOfKeys >= 0 && numberOfKeys<=2) &&
      (obj.time === undefined || typeof obj.time === "number") &&
      (obj.memory === undefined || typeof obj.memory === "number");
}



function isConcurrentQueryRowOptions(obj: any): obj is ConcurrentQueryRowOptions {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
    (numberOfKeys >=0 && numberOfKeys <= 11) &&
    (obj.rowFormat === undefined || (typeof obj.rowFormat === "string" && isValidRowFormat(obj.rowFormat))) &&
    (obj.abbreviateBlobs === undefined || typeof obj.abbreviateBlobs === "boolean") &&
    (obj.limit === undefined || (typeof obj.limit === "object" && isValidQueryLimit(obj.limit)))&&
    (obj.convertClassIdsToClassNames === undefined || typeof obj.convertClassIdsToClassNames === "boolean")&&
    (obj.rowFormat === undefined || typeof obj.rowFormat === "string")&&
    (obj.priority === undefined || typeof obj.priority === "number")&&
    (obj.restartToken === undefined || typeof obj.restartToken === "string")&&
    (obj.usePrimaryConn === undefined || typeof obj.usePrimaryConn === "boolean")&&
    (obj.delay === undefined || typeof obj.delay === "number")&&
    (obj.quota === undefined || (typeof obj.quota === "object" && isValidQueryQuota(obj.quota)));
}

export function buildECSqlRowArgs(object: ConcurrentQueryRowOptions | undefined) : ECSqlRowArg | undefined {
  if(object === undefined)
    return undefined;
  const rowArgs: ECSqlRowArg = {classIdsToClassNames: object.convertClassIdsToClassNames};
  if(object.rowFormat && object.rowFormat.toLowerCase() === "useecsqlpropertynames")
    rowArgs.rowFormat = QueryRowFormat.UseECSqlPropertyNames;
  else if(object.rowFormat && object.rowFormat.toLowerCase() === "useecsqlpropertyindexes")
    rowArgs.rowFormat = QueryRowFormat.UseECSqlPropertyIndexes;
  else if(object.rowFormat && object.rowFormat.toLowerCase() === "usejspropertynames")
    rowArgs.rowFormat = QueryRowFormat.UseJsPropertyNames;
  return rowArgs;
}

export function buildQueryOptionsBuilder(object: ConcurrentQueryRowOptions | undefined) : QueryOptions | undefined {
  if(object === undefined)
    return undefined;
  const queryOptions: QueryOptions = {abbreviateBlobs: object.abbreviateBlobs, suppressLogErrors : object.suppressLogErrors,
    includeMetaData: object.includeMetaData, limit: object.limit, convertClassIdsToClassNames: object.convertClassIdsToClassNames,
    priority: object.priority, restartToken: object.restartToken, usePrimaryConn: object.usePrimaryConn, quota: object.quota,
    delay: object.delay
  };
  if(object.rowFormat && object.rowFormat.toLowerCase() === "useecsqlpropertynames")
    queryOptions.rowFormat = QueryRowFormat.UseECSqlPropertyNames;
  else if(object.rowFormat && object.rowFormat.toLowerCase() === "useecsqlpropertyindexes")
    queryOptions.rowFormat = QueryRowFormat.UseECSqlPropertyIndexes;
  else if(object.rowFormat && object.rowFormat.toLowerCase() === "usejspropertynames")
    queryOptions.rowFormat = QueryRowFormat.UseJsPropertyNames;
  return queryOptions;
}

function tableTextToValue(text: string) : any {
  if(text === "null")
    return null;
  if(text.startsWith("{"))
    return JSON.parse(text);
  if(text === "true" || text === "false")
    return text === "true";
  if(text.startsWith("\"") && text.endsWith("\""))
    return text.slice(1,text.length-1);
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
    if(typeof obj[key] === "string")
    {
      const [isBinary, arrayVal] = understandAndReplaceBinaryData(obj[key])
      if(isBinary)
        obj[key] = arrayVal;
    }
    else if(typeof obj[key] === "object")
      obj[key] = buildBinaryData(obj[key])
  }
  return obj;
}

function understandAndReplaceBinaryData(str: string): [boolean,any]{
  if(str.startsWith("BIN(") && str.endsWith(")"))
  {
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
    return [true, Uint8Array.of(...ans)]
  }

  return [false,""]
}

export class ECDbMarkdownTestParser {
  // This method only goes through files and eraches if it finds one test with only: keyword
  public static parseOnlyHeaders(): boolean {
    const testAssetsDir = IModelTestUtils.resolveAssetFile("ECDbTests");
    const testFiles = fs.readdirSync(testAssetsDir, "utf-8").filter((fileName) => fileName.toLowerCase().endsWith("ecdbtest.md"));
    for (const fileName of testFiles) {
      const markdownFilePath = path.join(testAssetsDir, fileName);
      const markdownContent = fs.readFileSync(markdownFilePath, "utf-8");
      const tokens = marked.lexer(markdownContent);
      for (const token of tokens) {
        switch (token.type) {
          case "heading":
              if(token.text.toLowerCase().startsWith("only:"))
                return true;
        }
      }
    }
    return false;
  }

  public static parse(): ECDbTestProps[] {
    const isOnlyTestsFound = this.parseOnlyHeaders();
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
              if (currentTest !== undefined && currentTest.toBeIncluded) {
                out.push(currentTest);
              }
              currentTest = { title: token.text, queryType: undefined, toBeIncluded: isOnlyTestsFound ? (token.text.toLowerCase().startsWith("only:") ? true : false) : true, fileName: baseFileName };   // toBeIncluded: isOnlyTestsFound ? (token.text.toLowerCase().startsWith("only:") ? true : false) : true     This signifies that if no onlyTests are found then all are valid tests otherwise the onlyTests are only valid tests
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

      if (currentTest !== undefined && currentTest.toBeIncluded) {
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

    if(!currentTest.toBeIncluded)
      return;

    const variableRegex = /^(\w+):\s*(.+)$/;
    const bindRegex = /^bind(\w+)\s([^,\s]+),\s?(.+)$/;
    for (const item of token.items) {
      const match = item.text.match(variableRegex);
      if (match) {
        const key = match[1];
        const value = match[2];
        switch (key) {
          case "dataset":
            currentTest.dataset = value;
            continue;
          case "errorDuringPrepare":
            currentTest.errorDuringPrepare = value;
            continue;
          case "stepStatus":
            currentTest.stepStatus = value;
            continue;
          case "Mode":
            this.handleQueryType(value, currentTest, markdownFilePath);
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

  private static handleQueryType(value: string, currentTest: ECDbTestProps, markdownFilePath: string)
  {
    switch(value.toLowerCase())
    {
      case "ecsqlstatement":
        currentTest.queryType = TypeOfQuery.ECSqlStatement;
        break;
      case "concurrentquery":
        currentTest.queryType = TypeOfQuery.ConcurrentQuery;
        break;
      case "both":
        currentTest.queryType = TypeOfQuery.Both;
        break;
      default:
        logWarning(`Mode value is not recognised in file ${markdownFilePath} and test ${currentTest.title}. Skipping.`)
    }
  }
  private static handleCodeToken(token: Tokens.Code, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      logWarning(`Code token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }

    if(!currentTest.toBeIncluded)
      return;

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

      if (typeof json === "object" && typeof json.rowOptions === "object") {
        this.handleJSONRowOptionsMetaData(json, currentTest, markdownFilePath);
        return;
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

  private static handleJSONRowOptionsMetaData(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    if (isConcurrentQueryRowOptions(json.rowOptions)) {
      currentTest.rowOptions = json.rowOptions;
    } else {
      logWarning(`Row Options format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard. Skipping.`);
    }
    currentTest.rowOptions = json.rowOptions;
  }

  private static handleJSONColumnMetadata(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    const extraProps: string[] = [];

    if (json.columns.every(isColumnInfoProps)) {
      currentTest.columnInfo = json.columns;
      for (const column of json.columns) {
        for (const key in column) {
          if (!columnInfoPropsKeys.has(key as keyof ColumnInfoProps)) {
          extraProps.push(key);
          }
        }
      }

      if (extraProps.length > 0) {
        logWarning(`Found extra properties in column infos: ${extraProps.join(", ")} in file '${markdownFilePath}' test '${currentTest.title}'.`);
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

    if(!currentTest.toBeIncluded)
      return;

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