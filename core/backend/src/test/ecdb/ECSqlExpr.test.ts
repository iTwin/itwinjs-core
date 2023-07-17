/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ECDb, ECDbOpenMode, IModelHost } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { AllOrDistinctOp, BinaryBooleanExpr, BinaryBooleanOp, BinaryValueExpr, BinaryValueOp, BooleanExpr, ClassNameExpr, DerivedPropertyExpr, FromClauseExpr, GroupByClauseExpr, LiteralExpr, LiteralValueType, PropertyNameExpr, SelectExpr, SelectStatementExpr, SelectionClauseExpr, StatementExpr, WhereClauseExp } from "../../ECSqlExpr";

describe.only("ECSql Exprs", () => {
  let ecdb: ECDb;

  function parseStatement(ecsql: string) {
    const parseNode = ecdb.getECSqlParseTree(ecsql);
    return StatementExpr.deserialize(parseNode);
  }

  function toNormalizeECSql(ecsql: string) {
    return parseStatement(ecsql).toECSql();
  }

  before(async () => {
    await IModelHost.startup();
    ecdb = new ECDb();
    ecdb.openDb(IModelTestUtils.resolveAssetFile("test.bim"), ECDbOpenMode.ReadWrite);
    ecdb.withPreparedStatement("PRAGMA experimental_features_enabled=true", (stmt) => stmt.step());
  });

  after(async () => {
    ecdb.closeDb();
  });

  it("parse (|, &, <<, >>, +, -, %, /, *) binary & unary", async () => {
    const tests = [
      {
        orignalECSql: "SELECT (1 & 2 ) | (3 << 4 ) >> (5/ 6) * (7 + 8) + (4 % 9) + (-10) + (+20) - (~45)",
        expectedECSql: "SELECT (((1 & 2) | (3 << 4)) >> ((((((5 / 6) * (7 + 8)) + (4 % 9)) + -10) + +20) - ~45))",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
    }
  });
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
      {
        orignalECSql: "SELECT $->Name, $-> DisplayLabel, $ -> Nothing FROM Meta.ECClassDef WHERE $->Name LIKE '%Hellp' ORDER BY $->ECInstanceId DESC",
        expectedECSql: "SELECT $->[Name], $->[DisplayLabel], $->[Nothing] FROM [ECDbMeta].[ECClassDef] WHERE $->[Name] LIKE '%Hellp' ORDER BY $->[ECInstanceId] DESC",
      },
      {
        orignalECSql: "SELECT e.$->[Name], e.$-> DisplayLabel, e.$ -> Nothing FROM Meta.ECClassDef e",
        expectedECSql: "SELECT [e].$->[Name], [e].$->[DisplayLabel], [e].$->[Nothing] FROM [ECDbMeta].[ECClassDef] [e]",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
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
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse INSERT", async () => {
    const tests = [
      {
        orignalECSql: "INSERT INTO Bis.Subject(ECInstanceId) VALUES(1)",
        expectedECSql: "INSERT INTO [BisCore].[Subject] ([ECInstanceId]) VALUES(1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse DELETE", async () => {
    const tests = [
      {
        orignalECSql: "DELETE FROM Bis.Subject WHERE ECInstanceId = 1",
        expectedECSql: "DELETE FROM [BisCore].[Subject] WHERE ([ECInstanceId] = 1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
    }
  });
  it("parse UPDATE", async () => {
    const tests = [
      {
        orignalECSql: "UPDATE Bis.Subject SET CodeValue ='hello' WHERE ECInstanceId =1",
        expectedECSql: "UPDATE [BisCore].[Subject] SET [CodeValue] = 'hello' WHERE ([ECInstanceId] = 1)",
      },
    ];
    for (const test of tests) {
      assert.equal(test.expectedECSql, toNormalizeECSql(test.orignalECSql));
      assert.equal(test.expectedECSql, toNormalizeECSql(test.expectedECSql));
    }
  });
  function reviver(name: string, _value: any) {
    console.log(name);
  }
  it("build SelectStatementExpr", async () => {
    const stmt = new SelectStatementExpr(
      new SelectExpr(
        new SelectionClauseExpr([
          new DerivedPropertyExpr(
            new PropertyNameExpr("ECInstanceId")),
          new DerivedPropertyExpr(
            new PropertyNameExpr("CodeValue"))]),
        AllOrDistinctOp.All,
        new FromClauseExpr([
          new ClassNameExpr("bis", "Element")
        ]),
        new WhereClauseExp(
          new BinaryBooleanExpr(
            BinaryBooleanOp.EqualTo,
            new PropertyNameExpr("ECInstanceId"),
            new LiteralExpr(LiteralValueType.Raw, "1"))))
    );
    const expected = "SELECT ALL [ECInstanceId], [CodeValue] FROM [bis].[Element] WHERE ([ECInstanceId] = 1)";
    assert.equal(stmt.toECSql(), expected);
  });
});
