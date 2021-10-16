/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { SequentialLogMatcher } from "../SequentialLogMatcher";

// cspell:ignore mirukuru ibim

async function executeQuery(iModel: IModelDb, ecsql: string, bindings?: any[] | object, abbreviateBlobs?: boolean): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, QueryBinder.from(bindings), QueryRowFormat.UseJsPropertyNames, { abbreviateBlobs })) {
    rows.push(row);
  }
  return rows;
}

describe("Common table expression support in ECSQL", () => {
  let imodel1: SnapshotDb;

  before(async () => {
    imodel1 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(async () => {
    imodel1.close();
  });
  it("collect base properties recursively", async () => {
    const query = `
        WITH RECURSIVE
            base_classes (aId, aParentId, aPath, aDepth) AS (
                SELECT c.ECInstanceId, null, c.Name, 0  FROM meta.ECClassDef c WHERE c.Name=?
                UNION ALL
                SELECT c.ECInstanceId, cbc.TargetECInstanceId, aPath || '/' || c.Name, aDepth + 1
                    FROM meta.ECClassDef c
                        JOIN meta.ClassHasBaseClasses cbc ON cbc.SourceECInstanceId = c.ECInstanceId
                        JOIN base_classes  ON aId = cbc.TargetECInstanceId
                ORDER BY 1
            )
        SELECT group_concat( DISTINCT p.Name) prop from base_classes join meta.ECPropertyDef p on p.Class.id = aId`;
    const rows = await executeQuery(imodel1, query, ["Element"]);
    const expected = ["BBoxHigh", "BBoxLow", "Category", "GeometryStream", "Origin", "Rotation", "TypeDefinition", "CodeScope", "CodeSpec", "CodeValue", "FederationGuid", "JsonProperties", "LastMod", "Model", "Parent", "UserLabel", "Description", "Rank", "IsPrivate", "Recipe", "Data", "Type", "Angle", "Pitch", "Roll", "Yaw", "BaseModel", "Extents", "RotationAngle", "CategorySelector", "DisplayStyle", "Properties", "Name", "InSpatialIndex", "Enabled", "ModelSelector", "EyePoint", "FocusDistance", "IsCameraOn", "LensAngle", "RepositoryGuid", "Url", "PaletteName", "Height", "Scale", "SheetTemplate", "Width", "Border", "BorderTemplate", "Flags", "Format", "View", "DrawingModel", "ViewAttachment"];
    const actual = (rows[0].prop as string).split(",");
    assert.sameOrderedMembers(actual, expected);
  });

  it("generate mandelbrot set", async () => {
    const rows = await executeQuery(imodel1, `
      WITH RECURSIVE
        [xaxis]([x]) AS(
          VALUES (- 2.0)
          UNION ALL
          SELECT [x] + 0.05
          FROM   [xaxis]
          WHERE  [x] < 1.2
        ),
        [yaxis]([y]) AS(
          VALUES (- 1.0)
          UNION ALL
          SELECT [y] + 0.1
          FROM   [yaxis]
          WHERE  [y] < 1.0
        ),
        [m]([iter], [cx], [cy], [x], [y]) AS(
          SELECT
                0,
                [x],
                [y],
                0.0,
                0.0
          FROM   [xaxis],
                [yaxis]
          UNION ALL
          SELECT
                [iter] + 1,
                [cx],
                [cy],
                [x] * [x] - [y] * [y] + [cx],
                2.0 * [x] * [y] + [cy]
          FROM   [m]
          WHERE  ([x] * [x] + [y] * [y]) < 4.0 AND [iter] < 28
        ),
        [m2]([iter], [cx], [cy]) AS(
          SELECT
                MAX ([iter]),
                [cx],
                [cy]
          FROM   [m]
          GROUP  BY
                    [cx],
                    [cy]
        ),
        [a]([t]) AS(
          SELECT GROUP_CONCAT (SUBSTR (' .+*#', 1 + (CASE WHEN [iter] / 7 > 4 THEN 4 ELSE [iter] / 7 END), 1), '')
          FROM   [m2]
          GROUP  BY [cy]
        )
      SELECT GROUP_CONCAT (RTRIM ([t]), CHAR (0xa)) mandelbrot_set
      FROM   [a];
    `);

    const expected =
      "                                    ....#\n" +
      "                                   ..#*..\n" +
      "                                 ..+####+.\n" +
      "                            .......+####....   +\n" +
      "                           ..##+*##########+.++++\n" +
      "                          .+.##################+.\n" +
      "              .............+###################+.+\n" +
      "              ..++..#.....*#####################+.\n" +
      "             ...+#######++#######################.\n" +
      "          ....+*################################.\n" +
      " #############################################...\n" +
      "          ....+*################################.\n" +
      "             ...+#######++#######################.\n" +
      "              ..++..#.....*#####################+.\n" +
      "              .............+###################+.+\n" +
      "                          .+.##################+.\n" +
      "                           ..##+*##########+.++++\n" +
      "                            .......+####....   +\n" +
      "                                 ..+####+.\n" +
      "                                   ..#*..\n" +
      "                                    ....#\n" +
      "                                    +.";
    assert(rows[0].mandelbrot_set === expected);
  });

  it("basic cte test", async () => {
    let rows = [];
    rows = await executeQuery(imodel1, `
      WITH RECURSIVE
        cnt (x,y) AS (
            SELECT 100, 200
            UNION ALL
            SELECT x+1, 200 FROM cnt WHERE x<210
        )
      SELECT * from cnt`);
    assert(rows.length === 111);

    rows = await executeQuery(imodel1, `
      WITH RECURSIVE
        cnt (x,y) AS (
            SELECT 100, 200
        )
      SELECT * from cnt`);

    let slm = new SequentialLogMatcher();
    // these two are generated by sqlite
    slm.append().error().category("ECDb").message(/BE_SQLITE_ERROR duplicate WITH table name/gm);
    assert(rows.length === 1);
    try {
      rows = await executeQuery(imodel1, `
        WITH
          cte_1 (a,b,c) AS (
            SELECT 100, 400, 300
          ),
          cte_1 (a,b,c) AS (
            SELECT 100, 400, 300
          )
        SELECT * from cte_1`);
      assert(false);
    } catch {
      assert(true); // should fail as cte_1 is used for two ct expression.
    }
    assert.isTrue(slm.finishAndDispose());
    slm = new SequentialLogMatcher();
    // these two are generated by ECSQL. Its not clear why this message is logged twice.
    slm.append().error().category("ECDb").message(/Common table 'cte_1' has 3 values for columns 2/gm);
    try {
      rows = await executeQuery(imodel1, `
        WITH
        cte_1 (a,b,c) AS (
          SELECT 100, 400
        )
        SELECT * from cte_1`);
      assert(false);
    } catch {
      assert(true); // number are to ct expression does not match select
    }
    assert.isTrue(slm.finishAndDispose());
  });
});
