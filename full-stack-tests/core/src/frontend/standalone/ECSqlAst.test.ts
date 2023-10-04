/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSqlExpr
 */

import { assert } from "chai";
import {
  AssignmentExpr,
  BetweenExpr,
  BinaryBooleanExpr, BinaryValueExpr,
  CastExpr,
  ClassNameExpr,
  CteBlockExpr,
  CteBlockRefExpr,
  CteExpr,
  DeleteStatementExpr,
  DerivedPropertyExpr,
  ECSqlOptionsClauseExpr,
  Expr,
  ExprType,
  FromClauseExpr,
  FuncCallExpr,
  GroupByClauseExpr,
  HavingClauseExpr,
  IIFExpr,
  InExpr,
  InsertStatementExpr,
  IsNullExpr,
  IsOfTypeExpr,
  LikeExpr,
  LimitClauseExpr,
  LiteralExpr,
  LiteralValueType,
  MemberFuncCallExpr,
  NotExpr,
  OrderByClauseExpr,
  OrderBySpecExpr,
  ParameterExpr,
  PropertyNameExpr,
  QualifiedJoinExpr,
  SearchCaseExpr,
  SelectExpr,
  SelectionClauseExpr,
  SelectStatementExpr,
  SetClauseExpr,
  StatementExpr,
  SubqueryExpr,
  SubqueryRefExpr,
  SubqueryTestExpr,
  TableValuedFuncExpr,
  UnaryValueExpr,
  UpdateStatementExpr,
  UsingRelationshipJoinExpr,
  WhereClauseExp,
} from "@itwin/ecsql-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("ECSql Abstract Syntax Tree", () => {
  let conn: IModelConnection;

  async function toNormalizeECSql(ecsql: string) {
    return (await parseECSql(ecsql)).toECSql();
  }
  async function parseECSql(ecsql: string) {
    const reader = conn.createQueryReader(`PRAGMA PARSE_TREE("${ecsql}") ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`);
    if (await reader.step()) {
      return StatementExpr.deserialize(JSON.parse(reader.current[0]));
    }
    throw new Error("unable to get parse tree.");
  }

  function printTree(expr: Expr, indent: number = 0) {
    process.stdout.write(`${"".padEnd(indent, ".")}${expr.expType}${"".padEnd(30 - (indent + expr.expType.length), " ")}${expr.toECSql()}\n`);
    indent += 3;
    for (const child of expr.children)
      printTree(child, indent);
  }

  before(async () => {
    await TestUtility.startFrontend();
    conn = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    await conn.close();
    await TestUtility.shutdownFrontend();
  });

  it("parse (|, &, <<, >>, +, -, %, /, *) binary & unary", async () => {
    const tests = [
      {
        orignalECSql: "SELECT (1 & 2 ) | (3 << 4 ) >> (5/ 6) * (7 + 8) + (4 % 9) + (-10) + (+20) - (~45)",
        expectedECSql: "SELECT (((1 & 2) | (3 << 4)) >> ((((((5 / 6) * (7 + 8)) + (4 % 9)) + -10) + +20) - ~45))",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse DATE, TIME & TIMESTAMP", async () => {
    const tests = [
      {
        orignalECSql: "SELECT TIMESTAMP '2013-02-09T12:00:00'",
        expectedECSql: "SELECT TIMESTAMP '2013-02-09T12:00:00'",
      },
      {
        orignalECSql: "SELECT DATE '2012-01-18'",
        expectedECSql: "SELECT DATE '2012-01-18'",
      },
      {
        orignalECSql: "SELECT TIME '13:35:16'",
        expectedECSql: "SELECT TIME '13:35:16'",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse NULL, NUMBER, STRING, TRUE, FALSE & ||", async () => {
    const tests = [
      {
        orignalECSql: "SELECT TRUE, FALSE",
        expectedECSql: "SELECT TRUE, FALSE",
      },
      {
        orignalECSql: "SELECT NULL",
        expectedECSql: "SELECT NULL",
      },
      {
        orignalECSql: "SELECT  3.14159265358",
        expectedECSql: "SELECT 3.14159265358",
      },
      {
        orignalECSql: "SELECT  314159",
        expectedECSql: "SELECT 314159",
      },
      {
        orignalECSql: "SELECT  'Hello, World'",
        expectedECSql: "SELECT 'Hello, World'",
      },
      {
        orignalECSql: "SELECT  'Hello'|| ',' || 'World'",
        expectedECSql: "SELECT (('Hello' || ',') || 'World')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse (!=, =, >, <, >=, <=, OR, AND)", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF((1 != 2) OR (4 = 5) AND ( 4 > 8 ) OR (4 < 5) OR (4 <= 5) AND ( 4 >= 6 ), 'True', 'False')",
        expectedECSql: "SELECT IIF(((((1 <> 2) OR ((4 = 5) AND (4 > 8))) OR (4 < 5)) OR ((4 <= 5) AND (4 >= 6))), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse CASE-WHEN-THEN", async () => {
    const tests = [
      {
        orignalECSql: "SELECT CASE WHEN 4>5 THEN NULL WHEN 1 IS NOT NULL THEN 'Hello' ELSE 'Bye' END",
        expectedECSql: "SELECT CASE WHEN (4 > 5) THEN NULL WHEN (1 IS NOT NULL) THEN 'Hello' ELSE 'Bye' END",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse [NOT] LIKE", async () => {
    const tests = [
      {
        orignalECSql: "select IIF(('Hello, World' LIKE '\\%World' escape '\\') , 2, 3)",
        expectedECSql: "SELECT IIF('Hello, World' LIKE '\\%World' ESCAPE '\\', 2, 3)",
      },
      {
        orignalECSql: "select IIF(('Hello, World' LIKE '%World') , 2, 3)",
        expectedECSql: "SELECT IIF('Hello, World' LIKE '%World', 2, 3)",
      }
      ,
      {
        orignalECSql: "select IIF(('Hello, World' NOT LIKE '%World') , 2, 3)",
        expectedECSql: "SELECT IIF('Hello, World' NOT LIKE '%World', 2, 3)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse [NOT] IN(select|list)", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF( 3 IN (SELECT 1 AS N UNION SELECT 2), 'True', 'False')",
        expectedECSql: "SELECT IIF(3 IN (SELECT 1 [N] UNION SELECT 2), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF( 3 IN (1,2,3), 'True', 'False')",
        expectedECSql: "SELECT IIF(3 IN (1, 2, 3), 'True', 'False')",
      }
      ,
      {
        orignalECSql: "SELECT IIF( 3 NOT IN (1,2,3), 'True', 'False')",
        expectedECSql: "SELECT IIF(3 NOT IN (1, 2, 3), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse IS [NOT] NULL", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF( NULL IS NULL, 'True', 'False')",
        expectedECSql: "SELECT IIF((NULL IS NULL), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF( NULL IS NOT NULL, 'True', 'False')",
        expectedECSql: "SELECT IIF((NULL IS NOT NULL), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF( 1 IS NOT NULL, 'True', 'False')",
        expectedECSql: "SELECT IIF((1 IS NOT NULL), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse IS [NOT] (type[,...])", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF( 3 IS (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False')",
        expectedECSql: "SELECT IIF(3 IS (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF( 3 IS NOT (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False')",
        expectedECSql: "SELECT IIF(3 IS NOT (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse (NOT expr)", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF(NOT 3, 'True', 'False')",
        expectedECSql: "SELECT IIF((NOT 3), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF( (NOT (NOT (NOT (NOT 3)))), 'True', 'False')",
        expectedECSql: "SELECT IIF((NOT (NOT (NOT (NOT 3)))), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse [NOT] EXISTS (<subquery>)", async () => {
    const tests = [
      {
        orignalECSql: "SELECT IIF(EXISTS(SELECT 1), 'True', 'False')",
        expectedECSql: "SELECT IIF(EXISTS(SELECT 1), 'True', 'False')",
      },
      {
        orignalECSql: "SELECT IIF(NOT EXISTS(SELECT 1), 'True', 'False')",
        expectedECSql: "SELECT IIF((NOT EXISTS(SELECT 1)), 'True', 'False')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse CAST(<expr> AS [TEXT | INTEGER | REAL | BLOB | TIMESTAMP])", async () => {
    const tests = [
      {
        orignalECSql: "SELECT CAST(1 AS TEXT)",
        expectedECSql: "SELECT CAST(1 AS TEXT)",
      },
      {
        orignalECSql: "SELECT CAST(1 AS INTEGER)",
        expectedECSql: "SELECT CAST(1 AS INTEGER)",
      },
      {
        orignalECSql: "SELECT CAST(1 AS REAL)",
        expectedECSql: "SELECT CAST(1 AS REAL)",
      },
      {
        orignalECSql: "SELECT CAST(1 AS BLOB)",
        expectedECSql: "SELECT CAST(1 AS BLOB)",
      },
      {
        orignalECSql: "SELECT CAST(1 AS TIMESTAMP)",
        expectedECSql: "SELECT CAST(1 AS TIMESTAMP)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse SELECT DISTINCT|ALL/SUM(DISTINCT|ALL <expr>) ", async () => {
    const tests = [
      {
        orignalECSql: "SELECT ECInstanceId FROM meta.ECClassDef",
        expectedECSql: "SELECT [ECInstanceId] FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT DISTINCT ECInstanceId FROM meta.ECClassDef",
        expectedECSql: "SELECT DISTINCT [ECInstanceId] FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT ALL ECInstanceId FROM meta.ECClassDef",
        expectedECSql: "SELECT ALL [ECInstanceId] FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT SUM(DISTINCT ECInstanceId) FROM meta.ECClassDef",
        expectedECSql: "SELECT SUM(DISTINCT [ECInstanceId]) FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT SUM(ALL ECInstanceId) FROM meta.ECClassDef",
        expectedECSql: "SELECT SUM(ALL [ECInstanceId]) FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT SUM(ECInstanceId) FROM meta.ECClassDef",
        expectedECSql: "SELECT SUM([ECInstanceId]) FROM [ECDbMeta].[ECClassDef]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse func(args...)", async () => {
    const tests = [
      {
        orignalECSql: "SELECT INSTR('First', 'Second')",
        expectedECSql: "SELECT INSTR('First', 'Second')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse ECSQLOPTIONS", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X=3",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X = 3",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse Subquery", async () => {
    const tests = [
      {
        orignalECSql: "SELECT d.a FROM (SELECT b.Name a FROM meta.ECClassDef b) d",
        expectedECSql: "SELECT [d].[a] FROM (SELECT [b].[Name] [a] FROM [ECDbMeta].[ECClassDef] [b]) [d]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse LIMIT <expr> [OFFSET <expr>]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef LIMIT 10+33",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] LIMIT (10 + 33)",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef LIMIT 10+33 OFFSET 44",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] LIMIT (10 + 33) OFFSET 44",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse GROUP BY [expr...] HAVING [expr...]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef GROUP BY Name",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] GROUP BY [Name]",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef GROUP BY [Name] HAVING COUNT(*)>2",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] GROUP BY [Name] HAVING (COUNT(*) > 2)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse ORDER BY [expr...]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef ORDER BY Name ASC, ECInstanceId DESC",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] ORDER BY [Name] ASC, [ECInstanceId] DESC",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef ORDER BY NAME, DISPLAYLABEL",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] ORDER BY [NAME], [DISPLAYLABEL]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse CTE", async () => {
    const tests = [
      {
        orignalECSql: "WITH RECURSIVE c(i) AS (SELECT 1 UNION SELECT i+1 FROM c WHERE i < 10 ORDER BY 1) SELECT i FROM c",
        expectedECSql: "WITH RECURSIVE [c]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [c] WHERE ([i] < 10) ORDER BY 1) SELECT [i] FROM [c]",
      },
      {
        orignalECSql: "WITH c(i) AS (SELECT 1 UNION SELECT i+1 FROM c WHERE i < 10 ORDER BY 1) SELECT i FROM c",
        expectedECSql: "WITH [c]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [c] WHERE ([i] < 10) ORDER BY 1) SELECT [i] FROM [c]",
      },
      {
        orignalECSql: "WITH c(i) AS (SELECT 1 UNION SELECT i+1 FROM c WHERE i < 10 ORDER BY 1), d(i) AS (SELECT 1 UNION SELECT i+1 FROM d WHERE i < 100 ORDER BY 1) SELECT * FROM c,d",
        expectedECSql: "WITH [c]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [c] WHERE ([i] < 10) ORDER BY 1), [d]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [d] WHERE ([i] < 100) ORDER BY 1) SELECT [c].[i], [d].[i] FROM [c], [d]",
      },
      {
        orignalECSql: "WITH c(a,b,c) AS (SELECT ECInstanceId, ECClassId, Name FROM meta.ECClassDef) SELECT * FROM c",
        expectedECSql: "WITH [c]([a], [b], [c]) AS (SELECT [ECInstanceId], [ECClassId], [Name] FROM [ECDbMeta].[ECClassDef]) SELECT [c].[a], [c].[b], [c].[c] FROM [c]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  // experimental feature cannot be set from frontend as of now.
  it("parse $, $->prop", async () => {
    const tests = [
      {
        orignalECSql: "SELECT $ FROM Meta.ECClassDef",
        expectedECSql: "SELECT $ FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT $->[Name], $-> DisplayLabel, $ -> Nothing FROM Meta.ECClassDef",
        expectedECSql: "SELECT $->[Name], $->[DisplayLabel], $->[Nothing] FROM [ECDbMeta].[ECClassDef]",
      },
      // {
      //   orignalECSql: "SELECT $->Name, $-> DisplayLabel, $ -> Nothing FROM Meta.ECClassDef WHERE $->Name LIKE '%Hellp' ORDER BY $->ECInstanceId DESC",
      //   expectedECSql: "SELECT $->[Name], $->[DisplayLabel], $->[Nothing] FROM [ECDbMeta].[ECClassDef] WHERE $->[Name] LIKE '%Hellp' ORDER BY $->[ECInstanceId] DESC",
      // },
      {
        orignalECSql: "SELECT e.$->[Name], e.$-> DisplayLabel, e.$ -> Nothing FROM Meta.ECClassDef e",
        expectedECSql: "SELECT [e].$->[Name], [e].$->[DisplayLabel], [e].$->[Nothing] FROM [ECDbMeta].[ECClassDef] [e]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse ?, :<param-name>", async () => {
    const tests = [
      {
        orignalECSql: "SELECT ?",
        expectedECSql: "SELECT ?",
      },
      {
        orignalECSql: "SELECT :param1",
        expectedECSql: "SELECT :param1",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse <from> JOIN <to> USING rel [FORWARD|BACKWARD]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef JOIN meta.ECPropertyDef USING meta.ClassOwnsLocalProperties",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] JOIN [ECDbMeta].[ECPropertyDef] USING [ECDbMeta].[ClassOwnsLocalProperties]",
      },
      {
        orignalECSql: "SELECT 1 FROM bis.Element a JOIN bis.Element b USING bis.ElementOwnsChildElements FORWARD",
        expectedECSql: "SELECT 1 FROM [BisCore].[Element] [a] JOIN [BisCore].[Element] [b] USING [BisCore].[ElementOwnsChildElements] FORWARD",
      },
      {
        orignalECSql: "SELECT 1 FROM bis.Element a JOIN bis.Element b USING bis.ElementOwnsChildElements BACKWARD",
        expectedECSql: "SELECT 1 FROM [BisCore].[Element] [a] JOIN [BisCore].[Element] [b] USING [BisCore].[ElementOwnsChildElements] BACKWARD",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse <from> [INNER] [OUTER] JOIN <to> [ON <exp>]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] INNER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef INNER JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] INNER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse <from> RIGHT [OUTER] JOIN <to> [ON <exp>]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef RIGHT JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] RIGHT OUTER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef RIGHT OUTER JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] RIGHT OUTER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse <from> FULL [OUTER] JOIN <to> [ON <exp>]", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef FULL JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] FULL OUTER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
      {
        orignalECSql: "SELECT 1 FROM meta.ECClassDef FULL OUTER JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] FULL OUTER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse UNION | UNION ALL | INTERSECT | EXCEPT", async () => {
    const tests = [
      {
        orignalECSql: "SELECT a.ECInstanceId FROM meta.ECClassDef a UNION SELECT b.ECInstanceId FROM meta.ECPropertyDef b",
        expectedECSql: "SELECT [a].[ECInstanceId] FROM [ECDbMeta].[ECClassDef] [a] UNION SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]",
      },
      {
        orignalECSql: "SELECT a.ECInstanceId FROM meta.ECClassDef a UNION ALL SELECT b.ECInstanceId FROM meta.ECPropertyDef b",
        expectedECSql: "SELECT [a].[ECInstanceId] FROM [ECDbMeta].[ECClassDef] [a] UNION ALL SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]",
      },
      {
        orignalECSql: "SELECT a.ECInstanceId FROM meta.ECClassDef a INTERSECT SELECT b.ECInstanceId FROM meta.ECPropertyDef b",
        expectedECSql: "SELECT [a].[ECInstanceId] FROM [ECDbMeta].[ECClassDef] [a] INTERSECT SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]",
      },
      {
        orignalECSql: "SELECT a.ECInstanceId FROM meta.ECClassDef a EXCEPT SELECT b.ECInstanceId FROM meta.ECPropertyDef b",
        expectedECSql: "SELECT [a].[ECInstanceId] FROM [ECDbMeta].[ECClassDef] [a] EXCEPT SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]",
      },

    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse SELECT (<subquery>) FROM", async () => {
    const tests = [
      {
        orignalECSql: "SELECT (SELECT b.ECInstanceId FROM meta.ECPropertyDef b) AS S  FROM [ECDbMeta].[ECClassDef] a",
        expectedECSql: "SELECT (SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]) [S] FROM [ECDbMeta].[ECClassDef] [a]",
      },
      {
        orignalECSql: "SELECT (SELECT 1 UNION SELECT 2) FROM meta.ECClassDef a",
        expectedECSql: "SELECT (SELECT 1 UNION SELECT 2) FROM [ECDbMeta].[ECClassDef] [a]",
      },
      {
        orignalECSql: "SELECT  1 FROM [ECDbMeta].[ECClassDef] [a] WHERE (SELECT [b].[ECInstanceId] FROM meta.ECPropertyDef b) = 1",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef] [a] WHERE ((SELECT [b].[ECInstanceId] FROM [ECDbMeta].[ECPropertyDef] [b]) = 1)",
      },

    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse ALL | ONLY <classname>", async () => {
    const tests = [
      {
        orignalECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef]",
        expectedECSql: "SELECT 1 FROM [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT 1 FROM ONLY [ECDbMeta].[ECClassDef]",
        expectedECSql: "SELECT 1 FROM ONLY [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT 1 FROM ALL [ECDbMeta].[ECClassDef]",
        expectedECSql: "SELECT 1 FROM ALL [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT 1 FROM +ALL [ECDbMeta].[ECClassDef]",
        expectedECSql: "SELECT 1 FROM +ALL [ECDbMeta].[ECClassDef]",
      },
      {
        orignalECSql: "SELECT 1 FROM +ONLY [ECDbMeta].[ECClassDef]",
        expectedECSql: "SELECT 1 FROM +ONLY [ECDbMeta].[ECClassDef]",
      },

    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse tablevalue function FROM json1.json_tree()", async () => {
    const tests = [
      {
        orignalECSql: "select * from  json1.json_tree('{}') where key='gravity'",
        expectedECSql: "SELECT [key], [value], [type], [atom], [parent], [fullkey], [path] FROM [json1].[json_tree]('{}') WHERE ([key] = 'gravity')",
      },
      {
        orignalECSql: "select s.key, s.[value], s.type from  json1.json_tree('{}') s where s.key='gravity'",
        expectedECSql: "SELECT [s].[key], [s].[value], [s].[type] FROM [json1].[json_tree]('{}') [s] WHERE ([s].[key] = 'gravity')",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse SELECT, WHERE, FROM, GROUP BY, HAVING, ORDER BY, LIMIT & ECSQLOPTIONS", async () => {
    const tests = [
      {
        orignalECSql: "select count(*) from bis.element where codevalue lIKE '%s' group by ecclassid having count(*)>0 order by UserLabel limit 1 offset 10 ECSQLOPTIONS x=3",
        expectedECSql: "SELECT COUNT(*) FROM [BisCore].[Element] WHERE [codevalue] LIKE '%s' GROUP BY [ecclassid] HAVING (COUNT(*) > 0) ORDER BY [UserLabel] LIMIT 1 OFFSET 10 ECSQLOPTIONS x = 3",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  // require read/write connection from frontend.
  it.skip("parse INSERT", async () => {
    const tests = [
      {
        orignalECSql: "INSERT INTO Bis.Subject(ECInstanceId) VALUES(1)",
        expectedECSql: "INSERT INTO [BisCore].[Subject] ([ECInstanceId]) VALUES(1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  // require read/write connection from frontend.
  it.skip("parse DELETE", async () => {
    const tests = [
      {
        orignalECSql: "DELETE FROM Bis.Subject WHERE ECInstanceId = 1",
        expectedECSql: "DELETE FROM [BisCore].[Subject] WHERE ([ECInstanceId] = 1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  // require read/write connection from frontend.
  it.skip("parse UPDATE", async () => {
    const tests = [
      {
        orignalECSql: "UPDATE Bis.Subject SET CodeValue ='hello' WHERE ECInstanceId =1",
        expectedECSql: "UPDATE [BisCore].[Subject] SET [CodeValue] = 'hello' WHERE ([ECInstanceId] = 1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, await toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse complex query", async () => {
    const ecsql = `
    WITH RECURSIVE
      f0(i) AS (SELECT 1 UNION SELECT i+1 FROM f0 WHERE i < 10 ORDER BY 1),
      f1(i) AS (SELECT 3.14159265358),
      f2(i) AS (SELECT IIF((1 != 2) OR (4 = 5) AND ( 4 > 8 ) OR (4 < 5) OR (4 <= 5) AND ( 4 >= 6 ), 'True', 'False') i),
      f3(i) AS (SELECT 1 FROM bis.Element t0 JOIN bis.Element t1 USING bis.ElementOwnsChildElements FORWARD),
      f4(i) AS (SELECT 1 FROM bis.Element t0 JOIN bis.Element t1 USING bis.ElementOwnsChildElements BACKWARD),
      f5(i) AS (
        SELECT 1 FROM meta.ECClassDef
          JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId
          WHERE ECClassDef.ECInstanceId = :param1
      )
      SELECT
        (1 & 2 ) | (3 << 4 ) >> (5/ 6) * (7 + 8) + (4 % 9) + (-10) + (+20) - (~45) c0,
        TIMESTAMP '2013-02-09T12:00:00' c1,
        DATE '2012-01-18' c2,
        TIME '13:35:16' c3,
        TRUE c4,
        FALSE c5,
        3.14159265358 c6,
        314159 c7,
        'Hello, World' c8,
        'Hello'|| ',' || 'World' c9,
        IIF((1 != 2) OR (4 = 5) AND ( 4 > 8 ) OR (4 < 5) OR (4 <= 5) AND ( 4 >= 6 ), 'True', 'False') c10,
        CASE WHEN 4>5 THEN NULL WHEN 1 IS NOT NULL THEN 'Hello' ELSE 'Bye' END  c11,
        IIF(('Hello, World' LIKE '\\%World' escape '\\') , 2, 3)  c12,
        IIF(('Hello, World' LIKE '%World') , 2, 3)  c13,
        IIF(('Hello, World' NOT LIKE '%World') , 2, 3)  c14,
        IIF( 3 IN (SELECT 1 AS N UNION SELECT 2), 'True', 'False')  c15,
        IIF( 3 IN (1,2,3), 'True', 'False') c16,
        IIF( 3 NOT IN (1,2,3), 'True', 'False')  c17,
        IIF( NULL IS NULL, 'True', 'False')  c18,
        IIF( NULL IS NOT NULL, 'True', 'False')  c19,
        IIF( 1 IS NOT NULL, 'True', 'False')  c20,
        IIF( 3 IS (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False') c21,
        IIF( 3 IS NOT (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False') c22,
        IIF(NOT 3, 'True', 'False') c23,
        IIF( (NOT (NOT (NOT (NOT 3)))), 'True', 'False') c24,
        IIF(EXISTS(SELECT 1), 'True', 'False') c25,
        IIF(NOT EXISTS(SELECT 1), 'True', 'False') c26,
        CAST(1 AS TEXT) c27,
        CAST(1 AS INTEGER) c28,
        CAST(1 AS REAL) c29,
        CAST(1 AS BLOB) c30,
        CAST(1 AS TIMESTAMP) c31,
        INSTR('First', 'Second') c32,
        f0.i  c33,
        f1.i  c34,
        f2.i  c35,
        k0.ECInstanceId c36
      FROM f0, f1, f2, f3, f4, f5, meta.ECClassDef k0, (
        SELECT ECInstanceId FROM meta.ECClassDef
        UNION
        SELECT DISTINCT ECInstanceId FROM meta.ECClassDef
        UNION ALL
        SELECT ALL ECInstanceId FROM meta.ECClassDef
        EXCEPT
        SELECT SUM(DISTINCT ECInstanceId) FROM meta.ECClassDef
        INTERSECT
        SELECT SUM(ECInstanceId) FROM meta.ECClassDef GROUP BY ECClassId HAVING COUNT(*)> 1
      ) k1
      WHERE f0.i = f1.i AND k0.ECInstanceId = ? + 2
      GROUP BY k0.ECClassId,k0.DisplayLabel HAVING COUNT(*)> 1
      ORDER BY k0.Name ASC, k0.ECInstanceId DESC
      LIMIT 33 OFFSET ? + :param2
      ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X=3`;
    /** expected result (indented for readablity)
     * WITH RECURSIVE
        [f0]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [f0] WHERE ([i] < 10) ORDER BY 1),
        [f1]([i]) AS (SELECT 3.14159265358),
        [f2]([i]) AS (SELECT IIF(((((1 <> 2) OR ((4 = 5) AND (4 > 8))) OR (4 < 5)) OR ((4 <= 5) AND (4 >= 6))), 'True', 'False') [i]),
        [f3]([i]) AS (SELECT 1 FROM [BisCore].[Element] [t0] JOIN [BisCore].[Element] [t1] USING [BisCore].[ElementOwnsChildElements] FORWARD),
        [f4]([i]) AS (SELECT 1 FROM [BisCore].[Element] [t0] JOIN [BisCore].[Element] [t1] USING [BisCore].[ElementOwnsChildElements] BACKWARD),
        [f5]([i]) AS (
          SELECT 1 FROM [ECDbMeta].[ECClassDef]
          INNER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId])
          WHERE ([ECClassDef].[ECInstanceId] = :param1)
        )
        SELECT
          (((1 & 2) | (3 << 4)) >> ((((((5 / 6) * (7 + 8)) + (4 % 9)) + -10) + +20) - ~45)) [c0],
          TIMESTAMP '2013-02-09T12:00:00' [c1],
          DATE '2012-01-18' [c2],
          TIME '13:35:16' [c3],
          TRUE [c4],
          FALSE [c5],
          3.14159265358 [c6],
          314159 [c7],
          'Hello, World' [c8],
          (('Hello' || ',') || 'World') [c9],
          IIF(((((1 <> 2) OR ((4 = 5) AND (4 > 8))) OR (4 < 5)) OR ((4 <= 5) AND (4 >= 6))), 'True', 'False') [c10],
          CASE WHEN (4 > 5) THEN NULL WHEN (1 IS NOT NULL) THEN 'Hello' ELSE 'Bye' END [c11],
          IIF('Hello, World' LIKE '\%World' ESCAPE '\', 2, 3) [c12],
          IIF('Hello, World' LIKE '%World', 2, 3) [c13],
          IIF('Hello, World' NOT LIKE '%World', 2, 3) [c14],
          IIF(3 IN (SELECT 1 [N] UNION SELECT 2), 'True', 'False') [c15],
          IIF(3 IN (1, 2, 3), 'True', 'False') [c16], IIF(3 NOT IN (1, 2, 3), 'True', 'False') [c17],
          IIF((NULL IS NULL), 'True', 'False') [c18], IIF((NULL IS NOT NULL), 'True', 'False') [c19],
          IIF((1 IS NOT NULL), 'True', 'False') [c20],
          IIF(3 IS (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False') [c21],
          IIF(3 IS NOT (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False') [c22],
          IIF((NOT 3), 'True', 'False') [c23], IIF((NOT (NOT (NOT (NOT 3)))), 'True', 'False') [c24],
          IIF(EXISTS(SELECT 1), 'True', 'False') [c25], IIF((NOT EXISTS(SELECT 1)), 'True', 'False') [c26],
          CAST(1 AS TEXT) [c27],
          CAST(1 AS INTEGER) [c28],
          CAST(1 AS REAL) [c29],
          CAST(1 AS BLOB) [c30],
          CAST(1 AS TIMESTAMP) [c31],
          INSTR('First', 'Second') [c32],
          [f0].[i] [c33],
          [f1].[i] [c34],
          [f2].[i] [c35],
          [k0].[ECInstanceId] [c36]
        FROM [f0], [f1], [f2], [f3], [f4], [f5], [ECDbMeta].[ECClassDef] [k0],
          (SELECT [ECInstanceId] FROM [ECDbMeta].[ECClassDef]
          UNION SELECT DISTINCT [ECInstanceId] FROM [ECDbMeta].[ECClassDef]
          UNION ALL SELECT ALL [ECInstanceId] FROM [ECDbMeta].[ECClassDef]
          EXCEPT SELECT SUM(DISTINCT [ECInstanceId]) FROM [ECDbMeta].[ECClassDef]
          INTERSECT SELECT SUM([ECInstanceId]) FROM [ECDbMeta].[ECClassDef]
            GROUP BY [ECClassId] HAVING (COUNT(*) > 1)) [k1]
            WHERE (([f0].[i] = [f1].[i]) AND ([k0].[ECInstanceId] = (? + 2))
          )
        GROUP BY [k0].[ECClassId], [k0].[DisplayLabel]
        HAVING (COUNT(*) > 1)
        ORDER BY [k0].[Name] ASC, [k0].[ECInstanceId] DESC LIMIT 33 OFFSET (? + :param2)
        ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X = 3
     */
    const expected = "WITH RECURSIVE [f0]([i]) AS (SELECT 1 UNION SELECT ([i] + 1) FROM [f0] WHERE ([i] < 10) ORDER BY 1), [f1]([i]) AS (SELECT 3.14159265358), [f2]([i]) AS (SELECT IIF(((((1 <> 2) OR ((4 = 5) AND (4 > 8))) OR (4 < 5)) OR ((4 <= 5) AND (4 >= 6))), 'True', 'False') [i]), [f3]([i]) AS (SELECT 1 FROM [BisCore].[Element] [t0] JOIN [BisCore].[Element] [t1] USING [BisCore].[ElementOwnsChildElements] FORWARD), [f4]([i]) AS (SELECT 1 FROM [BisCore].[Element] [t0] JOIN [BisCore].[Element] [t1] USING [BisCore].[ElementOwnsChildElements] BACKWARD), [f5]([i]) AS (SELECT 1 FROM [ECDbMeta].[ECClassDef] INNER JOIN [ECDbMeta].[ECPropertyDef] ON ([ECPropertyDef].[Class].[Id] = [ECClassDef].[ECInstanceId]) WHERE ([ECClassDef].[ECInstanceId] = :param1)) SELECT (((1 & 2) | (3 << 4)) >> ((((((5 / 6) * (7 + 8)) + (4 % 9)) + -10) + +20) - ~45)) [c0], TIMESTAMP '2013-02-09T12:00:00' [c1], DATE '2012-01-18' [c2], TIME '13:35:16' [c3], TRUE [c4], FALSE [c5], 3.14159265358 [c6], 314159 [c7], 'Hello, World' [c8], (('Hello' || ',') || 'World') [c9], IIF(((((1 <> 2) OR ((4 = 5) AND (4 > 8))) OR (4 < 5)) OR ((4 <= 5) AND (4 >= 6))), 'True', 'False') [c10], CASE WHEN (4 > 5) THEN NULL WHEN (1 IS NOT NULL) THEN 'Hello' ELSE 'Bye' END [c11], IIF('Hello, World' LIKE '\\%World' ESCAPE '\\', 2, 3) [c12], IIF('Hello, World' LIKE '%World', 2, 3) [c13], IIF('Hello, World' NOT LIKE '%World', 2, 3) [c14], IIF(3 IN (SELECT 1 [N] UNION SELECT 2), 'True', 'False') [c15], IIF(3 IN (1, 2, 3), 'True', 'False') [c16], IIF(3 NOT IN (1, 2, 3), 'True', 'False') [c17], IIF((NULL IS NULL), 'True', 'False') [c18], IIF((NULL IS NOT NULL), 'True', 'False') [c19], IIF((1 IS NOT NULL), 'True', 'False') [c20], IIF(3 IS (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False') [c21], IIF(3 IS NOT (ALL [ECDbMeta].[ECClassDef], ONLY [ECDbMeta].[ECPropertyDef]), 'True', 'False') [c22], IIF((NOT 3), 'True', 'False') [c23], IIF((NOT (NOT (NOT (NOT 3)))), 'True', 'False') [c24], IIF(EXISTS(SELECT 1), 'True', 'False') [c25], IIF((NOT EXISTS(SELECT 1)), 'True', 'False') [c26], CAST(1 AS TEXT) [c27], CAST(1 AS INTEGER) [c28], CAST(1 AS REAL) [c29], CAST(1 AS BLOB) [c30], CAST(1 AS TIMESTAMP) [c31], INSTR('First', 'Second') [c32], [f0].[i] [c33], [f1].[i] [c34], [f2].[i] [c35], [k0].[ECInstanceId] [c36] FROM [f0], [f1], [f2], [f3], [f4], [f5], [ECDbMeta].[ECClassDef] [k0], (SELECT [ECInstanceId] FROM [ECDbMeta].[ECClassDef] UNION SELECT DISTINCT [ECInstanceId] FROM [ECDbMeta].[ECClassDef] UNION ALL SELECT ALL [ECInstanceId] FROM [ECDbMeta].[ECClassDef] EXCEPT SELECT SUM(DISTINCT [ECInstanceId]) FROM [ECDbMeta].[ECClassDef] INTERSECT SELECT SUM([ECInstanceId]) FROM [ECDbMeta].[ECClassDef] GROUP BY [ECClassId] HAVING (COUNT(*) > 1)) [k1] WHERE (([f0].[i] = [f1].[i]) AND ([k0].[ECInstanceId] = (? + 2))) GROUP BY [k0].[ECClassId], [k0].[DisplayLabel] HAVING (COUNT(*) > 1) ORDER BY [k0].[Name] ASC, [k0].[ECInstanceId] DESC LIMIT 33 OFFSET (? + :param2) ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X = 3";
    assert.equal(expected, await toNormalizeECSql(ecsql));
  });
  describe("test methods", () => {
    it("test Expr.findInstancesOf<T>()", async () => {
      const stmt = new SelectStatementExpr(
        new SelectExpr(
          new SelectionClauseExpr([
            new DerivedPropertyExpr(
              new PropertyNameExpr("ECInstanceId")),
            new DerivedPropertyExpr(
              new PropertyNameExpr("CodeValue"))]),
          "ALL",
          new FromClauseExpr([
            new ClassNameExpr("bis", "Element"),
          ]),
          new WhereClauseExp(
            new BinaryBooleanExpr(
              "=",
              new PropertyNameExpr("ECInstanceId"),
              new LiteralExpr(LiteralValueType.Raw, "1")))),
      );
      const expected = "SELECT ALL [ECInstanceId], [CodeValue] FROM [bis].[Element] WHERE ([ECInstanceId] = 1)";
      assert.equal(stmt.toECSql(), expected);
      assert.equal(stmt.findInstancesOf<SelectExpr>(SelectExpr).length, 1);
      assert.equal(stmt.findInstancesOf<SelectionClauseExpr>(SelectionClauseExpr).length, 1);
      assert.equal(stmt.findInstancesOf<DerivedPropertyExpr>(DerivedPropertyExpr).length, 2);
      assert.equal(stmt.findInstancesOf<PropertyNameExpr>(PropertyNameExpr).length, 3);
      assert.equal(stmt.findInstancesOf<WhereClauseExp>(WhereClauseExp).length, 1);
      assert.equal(stmt.findInstancesOf<BinaryBooleanExpr>(BinaryBooleanExpr).length, 1);
      assert.equal(stmt.findInstancesOf<LiteralExpr>(LiteralExpr).length, 1);
      assert.equal(stmt.findInstancesOf<ClassNameExpr>(ClassNameExpr).length, 1);
      assert.equal(stmt.findInstancesOf<FromClauseExpr>(FromClauseExpr).length, 1);
    });
    it("test Expr.traverse()", async () => {
      const stmt = new SelectStatementExpr(
        new SelectExpr(
          new SelectionClauseExpr([
            new DerivedPropertyExpr(
              new PropertyNameExpr("ECInstanceId")),
            new DerivedPropertyExpr(
              new PropertyNameExpr("CodeValue"))]),
          undefined,
          new FromClauseExpr([
            new ClassNameExpr("bis", "Element"),
          ]),
          new WhereClauseExp(
            new BinaryBooleanExpr(
              "=",
              new PropertyNameExpr("ECInstanceId"),
              new ParameterExpr()))),
      );
      const expected = "SELECT [ECInstanceId], [CodeValue] FROM [bis].[Element] WHERE ([ECInstanceId] = ?)";
      assert.equal(stmt.toECSql(), expected);
      const exprs: Expr[] = [];
      stmt.traverse((expr) => {
        exprs.push(expr);
      });
      assert.equal(exprs[0].expType, ExprType.SelectStatement);
      assert.equal(exprs[1].expType, ExprType.Select);
      assert.equal(exprs[2].expType, ExprType.SelectionClause);
      assert.equal(exprs[3].expType, ExprType.DerivedProperty);
      assert.equal(exprs[4].expType, ExprType.PropertyName);
      assert.equal(exprs[5].expType, ExprType.DerivedProperty);
      assert.equal(exprs[6].expType, ExprType.PropertyName);
      assert.equal(exprs[7].expType, ExprType.FromClause);
      assert.equal(exprs[8].expType, ExprType.ClassName);
      assert.equal(exprs[9].expType, ExprType.WhereClause);
      assert.equal(exprs[10].expType, ExprType.BinaryBoolean);
      assert.equal(exprs[11].expType, ExprType.PropertyName);
      assert.equal(exprs[12].expType, ExprType.Parameter);
      assert.equal(exprs.length, 13);
    });
    it("test Expr.type", async () => {
      assert.equal(ExprType.Assignment, AssignmentExpr.type);
      assert.equal(ExprType.Between, BetweenExpr.type);
      assert.equal(ExprType.BinaryBoolean, BinaryBooleanExpr.type);
      assert.equal(ExprType.BinaryValue, BinaryValueExpr.type);
      assert.equal(ExprType.Cast, CastExpr.type);
      assert.equal(ExprType.ClassName, ClassNameExpr.type);
      assert.equal(ExprType.Cte, CteExpr.type);
      assert.equal(ExprType.CteBlock, CteBlockExpr.type);
      assert.equal(ExprType.CteBlockRef, CteBlockRefExpr.type);
      assert.equal(ExprType.DeleteStatement, DeleteStatementExpr.type);
      assert.equal(ExprType.DerivedProperty, DerivedPropertyExpr.type);
      assert.equal(ExprType.ECSqlOptionsClause, ECSqlOptionsClauseExpr.type);
      assert.equal(ExprType.FromClause, FromClauseExpr.type);
      assert.equal(ExprType.FuncCall, FuncCallExpr.type);
      assert.equal(ExprType.GroupByClause, GroupByClauseExpr.type);
      assert.equal(ExprType.HavingClause, HavingClauseExpr.type);
      assert.equal(ExprType.IIF, IIFExpr.type);
      assert.equal(ExprType.In, InExpr.type);
      assert.equal(ExprType.InsertStatement, InsertStatementExpr.type);
      assert.equal(ExprType.IsNull, IsNullExpr.type);
      assert.equal(ExprType.IsOfType, IsOfTypeExpr.type);
      assert.equal(ExprType.Like, LikeExpr.type);
      assert.equal(ExprType.LimitClause, LimitClauseExpr.type);
      assert.equal(ExprType.Literal, LiteralExpr.type);
      assert.equal(ExprType.MemberFuncCall, MemberFuncCallExpr.type);
      assert.equal(ExprType.Not, NotExpr.type);
      assert.equal(ExprType.OrderByClause, OrderByClauseExpr.type);
      assert.equal(ExprType.OrderBySpec, OrderBySpecExpr.type);
      assert.equal(ExprType.Parameter, ParameterExpr.type);
      assert.equal(ExprType.PropertyName, PropertyNameExpr.type);
      assert.equal(ExprType.QualifiedJoin, QualifiedJoinExpr.type);
      assert.equal(ExprType.SearchCase, SearchCaseExpr.type);
      assert.equal(ExprType.Select, SelectExpr.type);
      assert.equal(ExprType.SelectionClause, SelectionClauseExpr.type);
      assert.equal(ExprType.SelectStatement, SelectStatementExpr.type);
      assert.equal(ExprType.SetClause, SetClauseExpr.type);
      assert.equal(ExprType.Subquery, SubqueryExpr.type);
      assert.equal(ExprType.SubqueryRef, SubqueryRefExpr.type);
      assert.equal(ExprType.SubqueryTest, SubqueryTestExpr.type);
      assert.equal(ExprType.TableValuedFunc, TableValuedFuncExpr.type);
      assert.equal(ExprType.Unary, UnaryValueExpr.type);
      assert.equal(ExprType.UpdateStatement, UpdateStatementExpr.type);
      assert.equal(ExprType.UsingRelationshipJoin, UsingRelationshipJoinExpr.type);
      assert.equal(ExprType.WhereClause, WhereClauseExp.type);
    });
    it.skip("test print tree", async () => {
      const ecsql = "select el.ECInstanceId as id, count(*) as instances from bis.element el where el.codevalue lIKE '%s' group by el.ecclassid having count(*)>0 order by el.UserLabel limit 1 offset 10 ECSQLOPTIONS x=3";
      const selectStmt = await parseECSql(ecsql);
      printTree(selectStmt);

    });
    it("test ClassNameExpr.fromECSql()", async () => {
      assert.equal(ClassNameExpr.fromECSql("+all Bis.Element").toECSql(), "+ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("+all Bis:Element").toECSql(), "+ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("+only Bis.Element").toECSql(), "+ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("+only Bis:Element").toECSql(), "+ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" + all  Bis.Element ").toECSql(), "+ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" + all  Bis:Element ").toECSql(), "+ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" + only  Bis.Element ").toECSql(), "+ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" + only  Bis:Element ").toECSql(), "+ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" all  Bis.Element ").toECSql(), "ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" all  Bis:Element ").toECSql(), "ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" only  Bis.Element ").toECSql(), "ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" only  Bis:Element ").toECSql(), "ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("all Bis.Element").toECSql(), "ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("all Bis:Element").toECSql(), "ALL [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("only Bis.Element").toECSql(), "ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("only Bis:Element").toECSql(), "ONLY [Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("Bis:Element").toECSql(), "[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("Bis.Element").toECSql(), "[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("[Bis]:[Element]").toECSql(), "[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("[Bis].[Element]").toECSql(), "[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("tbl.Bis:Element").toECSql(), "[tbl].[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("tbl.Bis.Element").toECSql(), "[tbl].[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("[tbl].[Bis]:[Element]").toECSql(), "[tbl].[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql("[tbl]:[Bis].[Element]").toECSql(), "[tbl].[Bis].[Element]");
      assert.equal(ClassNameExpr.fromECSql(" + only  Bis.Element as el").toECSql(), "+ONLY [Bis].[Element] [el]");
      assert.equal(ClassNameExpr.fromECSql(" + only  Bis:Element  el ").toECSql(), "+ONLY [Bis].[Element] [el]");
      assert.equal(ClassNameExpr.fromECSql(" + only  tbl:Bis.Element as el").toECSql(), "+ONLY [tbl].[Bis].[Element] [el]");
      assert.equal(ClassNameExpr.fromECSql(" + only  tbl:Bis:Element  el ").toECSql(), "+ONLY [tbl].[Bis].[Element] [el]");
    });
  });
});
