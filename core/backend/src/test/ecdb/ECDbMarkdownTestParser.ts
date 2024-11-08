/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import { marked, Tokens } from "marked";
import { IModelTestUtils } from "../IModelTestUtils";

export interface ECDbTestProps {
  title: string;
  dataset?: string;
  queryType?: TypeOfQuery
  testForConcurrentQuery?: boolean;
  testForECSqlStatement?: boolean;
  sql?: string;
  binders?: ECDbTestBinderProps[];
  errorDuringPrepare?: string;
  stepStatus?: string;
  columnInfoECSqlStatement?: ECSqlStatementECDbColumnInfoProps[];
  columnInfoConcurrentQuery?: ConcurrentQueryECDbColumnInfoProps[];
  expectedResultsConcurrentQuery?: { [key: string]: any }[];
  expectedResultsECSqlStatement?: { [key: string]: any }[];
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

function isECSqlStatementECDbColumnInfoProps(obj: any): obj is ECSqlStatementECDbColumnInfoProps {
  return typeof obj === "object" &&
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

function isConcurrentQueryECDbColumnInfoProps(obj: any): obj is ConcurrentQueryECDbColumnInfoProps {
  return typeof obj === "object" &&
    typeof obj.className === "string" &&
    (obj.accessString === undefined || typeof obj.accessString === "string") &&
    (obj.generated === undefined || typeof obj.generated === "boolean") &&
    (obj.index === undefined || typeof obj.index === "number") &&
    (obj.jsonName === undefined || typeof obj.jsonName === "string") &&
    (obj.name === undefined || typeof obj.name === "string") &&
    (obj.extendType === undefined || typeof obj.extendType === "string") &&
    (obj.typeName === undefined || typeof obj.typeName === "string");
}

export class ECDbMarkdownTestParser {
  public static parse(): ECDbTestProps[] {
    const testAssetsDir = IModelTestUtils.resolveAssetFile("ECDbTests");
    const testFiles = fs.readdirSync(testAssetsDir, "utf-8").filter((fileName) => fileName.toLowerCase().endsWith("ecdbtest.md"));
    const out: ECDbTestProps[] = [];

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
                }
                currentTest = { title: token.text };
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
      }
    }

    return out;
  }

  private static handleHeadingToken(token: Tokens.Heading, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`List token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }
    if(token.text == "Concurrent Query")
    {
      currentTest.testForConcurrentQuery = true
      currentTest.queryType = TypeOfQuery.ConcurrentQuery
    }
    if(token.text == "ECSqlStatement")
    {
      currentTest.testForECSqlStatement = true
      currentTest.queryType = TypeOfQuery.ECSqlStatement
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

      if (typeof json === "object" && Array.isArray(json.columns)) {
        this.handleJSONColumnMetadata(json, currentTest, markdownFilePath);
        return;
      }

      this.handleJSONExpectedResults(json, currentTest, markdownFilePath); // TODO: validate the expected results
    } else {
      this.logWarning(`Unknown code language ${token.lang} found in file ${markdownFilePath}. Skipping.`);
    }
  }

  private static handleJSONColumnMetadata(json: any, currentTest: ECDbTestProps, markdownFilePath: string) {
    if(currentTest.queryType == TypeOfQuery.ECSqlStatement)
    {
      if (json.columns.every(isECSqlStatementECDbColumnInfoProps)) {
        currentTest.columnInfoECSqlStatement = json.columns;
      } else {
        this.logWarning(`Columns format in file '${markdownFilePath}' test '${currentTest.title}' for type ECSqlStatement failed type guard. Skipping.`);
      }
    }
    else if(currentTest.queryType == TypeOfQuery.ConcurrentQuery)
    {
      if (json.columns.every(isConcurrentQueryECDbColumnInfoProps)) {
        currentTest.columnInfoConcurrentQuery = json.columns;
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
    if(currentTest.queryType == TypeOfQuery.ECSqlStatement)
    {
      currentTest.expectedResultsECSqlStatement = json
    }
    else if(currentTest.queryType == TypeOfQuery.ConcurrentQuery)
    {
      currentTest.expectedResultsConcurrentQuery = json
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
    if(currentTest.queryType == TypeOfQuery.ECSqlStatement)
    {
      if (token.header.length > 0 && token.header[0]?.text?.toLowerCase() === "accessstring") {
        this.handleColumnTableECSqlStatement(token, currentTest, markdownFilePath);
      } else {
        this.handleExpectedResultsTableECsqlStatement(token, currentTest, markdownFilePath);
      }
    }
    else if(currentTest.queryType == TypeOfQuery.ConcurrentQuery)
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
    currentTest.columnInfoECSqlStatement = currentTest.columnInfoECSqlStatement || [];
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
      currentTest.columnInfoECSqlStatement.push(column);
    }
  }

  private static handleExpectedResultsTableECsqlStatement(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.expectedResultsECSqlStatement = currentTest.expectedResultsECSqlStatement || [];
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
      currentTest.expectedResultsECSqlStatement.push(expectedResult);
    }
  }

  private static handleColumnTableConcurrentQuery(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.columnInfoConcurrentQuery = currentTest.columnInfoConcurrentQuery || [];
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
      currentTest.columnInfoConcurrentQuery.push(column);
    }
  }

  private static handleExpectedResultsTableConcurrentQuery(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.expectedResultsECSqlStatement = currentTest.expectedResultsECSqlStatement || [];
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
      currentTest.expectedResultsECSqlStatement.push(expectedResult);
    }
  }

  private static logWarning(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}