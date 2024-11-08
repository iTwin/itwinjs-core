/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import { marked, Tokens } from "marked";
import { IModelTestUtils } from "../IModelTestUtils";
import { ECSqlRowArg } from "../../ECSqlStatement";
import { QueryLimit, QueryOptions, QueryOptionsBuilder, QueryQuota, QueryRowFormat } from "@itwin/core-common";

export interface ECDbTestProps {
  title: string;
  dataset?: string;
  queryType?: TypeOfQuery[]
  sql?: string;
  binders?: ECDbTestBinderProps[];
  errorDuringPrepare?: string;
  stepStatus?: string;
  concurrentQueryProps?: ConcurrentQueryProps;
  ecsqlStatementProps?: ECSqlStatementProps;
}

export interface ConcurrentQueryProps{
  rowOptions?: ConcurrentQueryRowOptions;
  columnInfo?: ConcurrentQueryECDbColumnInfoProps[];
  expectedResults?: { [key: string]: any }[];
}

export interface ECSqlStatementProps{
  rowOptions?: ECSqlStatementRowOptions;
  columnInfo?: ECSqlStatementECDbColumnInfoProps[];
  expectedResults?: { [key: string]: any }[];
}

export interface ECSqlStatementRowOptions{
  rowFormat?: string;
  classIdsToClassNames?: boolean;
}

export interface ConcurrentQueryRowOptions{
  abbreviateBlobs?: boolean;
  suppressLogErrors?: boolean;
  includeMetaData?: boolean;
  limit?: QueryLimit;
  convertClassIdsToClassNames?: boolean;
  rowFormat?: string;
  priority?: number;
  restartToken?: string;
  usePrimaryConn?: boolean;
  quota?: QueryQuota;
  delay?: number;
}

export interface ECDbTestBinderProps {
  indexOrName: string;
  type: string;
  value: string;
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
  className: string;
  accessString?: string;
  generated?: boolean;
  index?: number;
  jsonName?: string;
  name?: string;
  extendType?: string;
  typeName?: string;
}

enum TypeOfQuery{
  ECSqlStatement = 0,
  ConcurrentQuery = 1
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

function isECSqlStatementECDbColumnInfoProps(obj: any): obj is ECSqlStatementECDbColumnInfoProps {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
    (numberOfKeys >=1 && numberOfKeys <= 11) &&
    typeof obj.accessString === "string" &&
    (obj.propertyName === undefined || typeof obj.propertyName === "string") &&
    (obj.originPropertyName === undefined || typeof obj.originPropertyName === "string") &&
    (obj.rootClassAlias === undefined || typeof obj.rootClassAlias === "string") &&
    (obj.rootClassName === undefined || typeof obj.rootClassName === "string") &&
    (obj.rootClassTableSpace === undefined || typeof obj.rootClassTableSpace === "string") &&
    (obj.type === undefined || typeof obj.type === "string") &&
    (obj.isEnum === undefined || typeof obj.isEnum === "boolean") &&
    (obj.isGeneratedProperty === undefined || typeof obj.isGeneratedProperty === "boolean") &&
    (obj.isSystemProperty === undefined || typeof obj.isSystemProperty === "boolean") &&
    (obj.isDynamicProp === undefined || typeof obj.isDynamicProp === "boolean");
}

function isECSqlStatementRowOptions(obj: any): obj is ECSqlStatementRowOptions {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
    (numberOfKeys >=0 && numberOfKeys <= 2) &&
    (obj.rowFormat === undefined || (typeof obj.rowFormat === "string" && isValidRowFormat(obj.rowFormat))) &&
    (obj.classIdsToClassNames === undefined || typeof obj.classIdsToClassNames === "boolean");
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

function isConcurrentQueryECDbColumnInfoProps(obj: any): obj is ConcurrentQueryECDbColumnInfoProps {
  const numberOfKeys = typeof obj === "object" ? Object.keys(obj).length : 0;
  return typeof obj === "object" &&
    (numberOfKeys >= 1 && numberOfKeys <= 8) &&
    typeof obj.className === "string" &&
    (obj.accessString === undefined || typeof obj.accessString === "string") &&
    (obj.generated === undefined || typeof obj.generated === "boolean") &&
    (obj.index === undefined || typeof obj.index === "number") &&
    (obj.jsonName === undefined || typeof obj.jsonName === "string") &&
    (obj.name === undefined || typeof obj.name === "string") &&
    (obj.extendType === undefined || typeof obj.extendType === "string") &&
    (obj.typeName === undefined || typeof obj.typeName === "string");
}

export function buildECSqlRowArgs(object: ECSqlStatementRowOptions | undefined) : ECSqlRowArg | undefined {
  if(object === undefined)
    return undefined;
  const rowArgs: ECSqlRowArg = {classIdsToClassNames: object.classIdsToClassNames};
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

export class ECDbMarkdownTestParser {
  public static parse(): ECDbTestProps[] {
    const testAssetsDir = IModelTestUtils.resolveAssetFile("ECDbTests");
    const testFiles = fs.readdirSync(testAssetsDir, "utf-8").filter((fileName) => fileName.toLowerCase().endsWith("ecdbtest.md"));
    const out: ECDbTestProps[] = [];
    const outOnly: ECDbTestProps[] = [];

    for (const fileName of testFiles) {
      const markdownFilePath = path.join(testAssetsDir, fileName);
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
            if(token.depth == 1)
              {
                if (currentTest !== undefined) {
                  out.push(currentTest);
                  if(currentTest.title.startsWith("only:"))
                    outOnly.push(currentTest);
                }
                currentTest = { title: token.text, queryType: undefined, ecsqlStatementProps: undefined, concurrentQueryProps: undefined };
              }
            else if(token.depth == 2)
              this.handleHeadingToken(token as Tokens.Heading, currentTest, markdownFilePath)
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
            this.logWarning(`Unknown token type ${token.type} found in file ${markdownFilePath}. Skipping.`);
            break;
        }
      }

      if (currentTest !== undefined) {
        out.push(currentTest);
        if(currentTest.title.startsWith("only:"))
          outOnly.push(currentTest);
      }
    }
    if(outOnly.length >= 1)
      return outOnly;
    return out;
  }

  private static handleHeadingToken(token: Tokens.Heading, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`List token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }
    if(token.text == "Concurrent Query")
    {
      currentTest.queryType = currentTest.queryType || []
      currentTest.queryType.push(TypeOfQuery.ConcurrentQuery)
      currentTest.concurrentQueryProps = currentTest.concurrentQueryProps || {}
    }
    if(token.text == "ECSqlStatement")
    {
      currentTest.queryType = currentTest.queryType || []
      currentTest.queryType.push(TypeOfQuery.ECSqlStatement)
      currentTest.ecsqlStatementProps = currentTest.ecsqlStatementProps || {}
    }
  }

  private static handleListToken(token: Tokens.List, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`List token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }
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

  private static handleCodeToken(token: Tokens.Code, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`Code token found without a test title in file ${markdownFilePath}. Skipping.`);
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
          this.logWarning(`Failed to parse JSON in file ${markdownFilePath}. ${error.message} Skipping.`);
        } else {
          this.logWarning(`Failed to parse JSON in file ${markdownFilePath}. Unknown error. Skipping.`);
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

      this.handleJSONExpectedResults(json, currentTest, markdownFilePath); // TODO: validate the expected results
    } else {
      this.logWarning(`Unknown code language ${token.lang} found in file ${markdownFilePath}. Skipping.`);
    }
  }

  private static handleJSONRowOptionsMetaData(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ECSqlStatement)
    {
      if (isECSqlStatementRowOptions(json.rowOptions)) {
        currentTest.ecsqlStatementProps!.rowOptions = json.rowOptions;    // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
      } else {
        this.logWarning(`Row Options format in file '${markdownFilePath}' test '${currentTest.title}' for type ECSqlStatement failed type guard. Skipping.`);
      }
    }
    else if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ConcurrentQuery)
    {
      if (isConcurrentQueryRowOptions(json.rowOptions)) {
        currentTest.concurrentQueryProps!.rowOptions = json.rowOptions;   // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
      } else {
        this.logWarning(`Row Options format in file '${markdownFilePath}' test '${currentTest.title}' for type Concurrent Query failed type guard. Skipping.`);
      }
    }
    else if(currentTest.queryType === undefined)
    {
      this.logWarning(`Row Options format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard because no suitable header for type of query is specified. Skipping.`);
    }
  }

  private static handleJSONColumnMetadata(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ECSqlStatement)
    {
      if (json.columns.every(isECSqlStatementECDbColumnInfoProps)) {
        currentTest.ecsqlStatementProps!.columnInfo = json.columns;    // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
      } else {
        this.logWarning(`Columns format in file '${markdownFilePath}' test '${currentTest.title}' for type ECSqlStatement failed type guard. Skipping.`);
      }
    }
    else if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ConcurrentQuery)
    {
      if (json.columns.every(isConcurrentQueryECDbColumnInfoProps)) {
        currentTest.concurrentQueryProps!.columnInfo = json.columns;   // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
      } else {
        this.logWarning(`Columns format in file '${markdownFilePath}' test '${currentTest.title}' for type Concurrent Query failed type guard. Skipping.`);
      }
    }
    else if(currentTest.queryType === undefined)
    {
      this.logWarning(`Columns format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard because no suitable header for type of query is specified. Skipping.`);
    }
  }

  private static handleJSONExpectedResults(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ECSqlStatement)
    {
      currentTest.ecsqlStatementProps!.expectedResults = json   // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
    }
    else if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ConcurrentQuery)
    {
      currentTest.concurrentQueryProps!.expectedResults = json    // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
    }
    else if(currentTest.queryType === undefined)
    {
      this.logWarning(`Expected Results format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard because no suitable header for type of query is specified. Skipping.`);
    }
  }

  private static handleTableToken(token: Tokens.Table, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`Table token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }
    this.handleTable(token, currentTest, markdownFilePath);
  }

  private static handleTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ECSqlStatement)
    {
      if (token.header.length > 0 && token.header[0]?.text?.toLowerCase() === "accessstring") {
        this.handleColumnTableECSqlStatement(token, currentTest, markdownFilePath);
      } else {
        this.handleExpectedResultsTableECsqlStatement(token, currentTest, markdownFilePath);
      }
    }
    else if(currentTest.queryType && currentTest.queryType.at(-1) == TypeOfQuery.ConcurrentQuery)
    {
      if (token.header.length > 0 && token.header[0]?.text?.toLowerCase() === "classname") {
        this.handleColumnTableConcurrentQuery(token, currentTest, markdownFilePath);
      } else {
        this.handleExpectedResultsTableConcurrentQuery(token, currentTest, markdownFilePath);
      }
    }
    else if(currentTest.queryType === undefined)
    {
      this.logWarning(`Table format in file '${markdownFilePath}' test '${currentTest.title}' failed type guard because no suitable header for type of query is specified. Skipping.`);
    }
  }

  private static handleColumnTableECSqlStatement(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.ecsqlStatementProps!.columnInfo = currentTest.ecsqlStatementProps!.columnInfo || [];  // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        this.logWarning(`Rows in a column table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }
      const column: ECSqlStatementECDbColumnInfoProps = { accessString: row[0].text };
      for (let i = 1; i < token.header.length; i++) {
        const header = token.header[i].text.toLowerCase();
        const cell = row[i].text;
        switch (header) {
          case "propertyname":
            column.propertyName = cell;
            break;
          case "originpropertyname":
            column.originPropertyName = cell;
            break;
          case "rootclassalias":
            column.rootClassAlias = cell;
            break;
          case "rootclassname":
            column.rootClassName = cell;
            break;
          case "rootclasstablespace":
            column.rootClassTableSpace = cell;
            break;
          case "type":
            column.type = cell;
            break;
          case "isenum":
            column.isEnum = cell.toLowerCase() === "true";
            break;
          case "isgeneratedproperty":
            column.isGeneratedProperty = cell.toLowerCase() === "true";
            break;
          case "issystemproperty":
            column.isSystemProperty = cell.toLowerCase() === "true";
            break;
          case "isdynamicprop":
            column.isDynamicProp = cell.toLowerCase() === "true";
            break;
          default:
            this.logWarning(`Unknown column header ${header} found in file ${markdownFilePath}. Skipping.`);
        }
      }
      currentTest.ecsqlStatementProps!.columnInfo.push(column); // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
    }
  }

  private static handleExpectedResultsTableECsqlStatement(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.ecsqlStatementProps!.expectedResults = currentTest.ecsqlStatementProps!.expectedResults || [];  // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        this.logWarning(`Rows in a column table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }

      const expectedResult: { [key: string]: any } = {};
      for (let i = 0; i < token.header.length; i++) {
        const header = token.header[i].text;
        const cell = row[i].text;
        expectedResult[header] = cell;
      }
      currentTest.ecsqlStatementProps!.expectedResults.push(expectedResult); // We are sure that ecsqlStatementProps will not be undefined because if queryType == TypeOfQuery.ECSqlStatement then ecsqlStatementProps will not be undefined
    }
  }

  private static handleColumnTableConcurrentQuery(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.concurrentQueryProps!.columnInfo = currentTest.concurrentQueryProps!.columnInfo || [];  // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        this.logWarning(`Rows in a column table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }
      const column: ConcurrentQueryECDbColumnInfoProps = { className: row[0].text };
      for (let i = 1; i < token.header.length; i++) {
        const header = token.header[i].text.toLowerCase();
        const cell = row[i].text;
        switch (header) {
          case "accessString":
            column.accessString = cell;
            break;
          case "generated":
            column.generated = cell.toLowerCase() == "true";
            break;
          case "index":
            column.index = parseInt(cell);
            break;
          case "jsonName":
            column.jsonName = cell;
            break;
          case "name":
            column.name = cell;
            break;
          case "extendType":
            column.extendType = cell;
            break;
          case "typeName":
            column.typeName = cell;
            break;
          default:
            this.logWarning(`Unknown column header ${header} found in file ${markdownFilePath}. Skipping.`);
        }
      }
      currentTest.concurrentQueryProps!.columnInfo.push(column);   // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
    }
  }

  private static handleExpectedResultsTableConcurrentQuery(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.concurrentQueryProps!.expectedResults = currentTest.concurrentQueryProps!.expectedResults || [];    // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        this.logWarning(`Rows in a column table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }

      const expectedResult: { [key: string]: any } = {};
      for (let i = 0; i < token.header.length; i++) {
        const header = token.header[i].text;
        const cell = row[i].text;
        expectedResult[header] = cell;
      }
      currentTest.concurrentQueryProps!.expectedResults.push(expectedResult);   // We are sure that concurrentQueryProps will not be undefined because if queryType == TypeOfQuery.ConcurrentQuery then concurrentQueryProps will not be undefined
    }
  }

  private static logWarning(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}