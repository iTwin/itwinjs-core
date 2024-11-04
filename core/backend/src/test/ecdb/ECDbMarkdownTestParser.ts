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
  sql?: string;
  binders?: ECDbTestBinderProps[];
  errorDuringPrepare?: string;
  stepStatus?: string;
  columns?: ECDbColumnInfoProps[];
  expectedResults?: { [key: string]: any }[];
}

export interface ECDbTestBinderProps {
  indexOrName: string;
  type: string;
  value: string;
}

export interface ECDbColumnInfoProps {
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
            if (currentTest !== undefined) {
              out.push(currentTest);
            }
            currentTest = { title: token.text };
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

  private static handleHeadingToken(token: Tokens.Heading, currentTest: ECDbTestProps | undefined, out: ECDbTestProps[]): ECDbTestProps {
    if (currentTest !== undefined) {
      out.push(currentTest);
    }
    return { title: token.text };
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
      const json = JSON.parse(token.text);
      if (!Array.isArray(json)) {
        this.logWarning(`Expected an array of expected results in file ${markdownFilePath}. Skipping.`);
        return;
      }
      currentTest.expectedResults = json; // TODO: validate the expected results
    } else {
      this.logWarning(`Unknown code language ${token.lang} found in file ${markdownFilePath}. Skipping.`);
    }
  }

  private static handleTableToken(token: Tokens.Table, currentTest: ECDbTestProps | undefined, markdownFilePath: string) {
    if (currentTest === undefined) {
      this.logWarning(`Table token found without a test title in file ${markdownFilePath}. Skipping.`);
      return;
    }
    if (token.header.length > 0 && token.header[0]?.text?.toLowerCase() === "accessstring") {
      this.handleColumnTable(token, currentTest, markdownFilePath);
    } else {
      this.handleExpectedResultsTable(token, currentTest, markdownFilePath);
    }
  }

  private static handleColumnTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.columns = currentTest.columns || [];
    for (const row of token.rows) {
      if (row.length < 1 || row.length !== token.header.length) {
        this.logWarning(`Rows in a column table must have a minimum of 1 cell, and as many cells as there are headers. ${markdownFilePath}. Skipping.`);
        continue;
      }
      const column: ECDbColumnInfoProps = { accessString: row[0].text };
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
      currentTest.columns.push(column);
    }
  }

  private static handleExpectedResultsTable(token: Tokens.Table, currentTest: ECDbTestProps, markdownFilePath: string) {
    currentTest.expectedResults = currentTest.expectedResults || [];
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
      currentTest.expectedResults.push(expectedResult);
    }
  }

  private static logWarning(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}