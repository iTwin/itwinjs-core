/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult } from "@itwin/core-bentley";
import { QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { _nativeDb, ECSqlStatement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import * as path from "path";

describe("ECSql Row Adapter Test", () => {
  let imodel1: SnapshotDb;
  let imodel2: SnapshotDb;
  const geomData = Uint8Array.from([
    0xcb, 0x0, 0x80, 0x2, 0x30, 0x0, 0x6, 0x0, 0x0, 0xf8, 0x0, 0x0, 0x0, 0x1, 0x0, 0x0, 0x0, 0x8, 0xd, 0x8, 0x1, 0x1, 0x40, 0x4, 0x0, 0x0, 0x0, 0x30,
    0x0, 0x0, 0x0, 0x1c, 0x0, 0x0, 0x0, 0x18, 0x0, 0x14, 0x0, 0xc, 0x5, 0x1e, 0x11, 0x1, 0x8, 0x6, 0x0, 0x7, 0x5, 0x18, 0x1, 0x1, 0xc, 0x1, 0x1, 0x0,
    0xf0, 0x1, 0x24, 0x9, 0x1, 0x40, 0xb, 0x0, 0x0, 0x0, 0xa8, 0x0, 0x0, 0x0, 0x62, 0x67, 0x30, 0x30, 0x30, 0x31, 0x66, 0x62, 0x10, 0x5, 0x17, 0x10,
    0xa, 0x0, 0xe, 0x0, 0x7, 0x5, 0x42, 0x0, 0xa, 0x5, 0x10, 0x8, 0x0, 0x7, 0xc, 0x5, 0x8, 0xc8, 0x6, 0x0, 0x7c, 0x0, 0x4, 0x0, 0x6, 0x0, 0x0, 0x0,
    0xbc, 0xb7, 0x46, 0x93, 0xcb, 0x78, 0x23, 0x40, 0xd4, 0xf2, 0xd1, 0xd9, 0x36, 0x97, 0xa4, 0x3c, 0x4, 0xe1, 0x8c, 0xf, 0x67, 0x74, 0xcd, 0xbc, 0x59,
    0x3d, 0xd2, 0xd1, 0xfb, 0xc6, 0xd2, 0xbc, 0xb4, 0xba, 0x5b, 0xc3, 0xbb, 0xec, 0xa5, 0xbc, 0xbd, 0xd, 0x28, 0x5, 0x3f, 0x8, 0x0, 0xd8, 0x3c, 0x9, 0x8,
    0x20, 0xd0, 0xbc, 0x90, 0x3c, 0xa7, 0x92, 0x2, 0x12, 0x9e, 0x11, 0x10, 0x4, 0x3c, 0xba, 0x32, 0x28, 0x0, 0x24, 0xe0, 0xbc, 0x18, 0x2d, 0x44, 0x54,
    0xfb, 0x21, 0xf9, 0xbf, 0x9, 0x8, 0x24, 0x9, 0x40, 0x1, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0]);
  before(async () => {

    imodel1 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test_ec_4003.bim"));
  });

  after(async () => {
    imodel1.close();
    imodel2.close();
  });

  /* =============================================QueryRowFormat:UseJsPropertyNames================================================================*/

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseJsPropertyNames, classIdsToClassNames: true }", async () => {
    const doNotConvertClassIdsToClassNamesWhenAliased = true;
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "BisCore.DrawingCategory",
          className_1: "BisCore.DrawingCategory",
        },
        readerResult: {
          id: "0x19",
          id_1: "0x19",
          className: "BisCore.DrawingCategory",
          className_1: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "BisCore.SubjectOwnsPartitionElements",
        },
        readerResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "BisCore.SubjectOwnsPartitionElements",
          "parent.id": "0x1",
          "parent.relClassName": "BisCore.SubjectOwnsPartitionElements",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
        readerResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
        readerResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
        readerResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
        readerResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
    builder.setConvertClassIdsToNames(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow(), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseJsPropertyNames, classIdsToClassNames: false }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "0x4c",
          className_1: "0x4c",
        },
        readerResult: {
          id: "0x19",
          id_1: "0x19",
          className: "0x4c",
          className_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "0xcf",
        },
        readerResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          id: "0x19",
          className: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          id: "0x19",
          className: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
    builder.setConvertClassIdsToNames(false);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseJsPropertyNames, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseJsPropertyNames, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseJsPropertyNames, classIdsToClassNames: undefined }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "0x4c",
          className_1: "0x4c",
        },
        readerResult: {
          id: "0x19",
          id_1: "0x19",
          className: "BisCore.DrawingCategory",
          className_1: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "0xcf",
        },
        readerResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "BisCore.SubjectOwnsPartitionElements",
          "parent.id": "0x1",
          "parent.relClassName": "BisCore.SubjectOwnsPartitionElements",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            id: "0x1",
            relClassName: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            id: "0x1",
            relClassName: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            id: "0x1",
            relClassName: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseJsPropertyNames);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseJsPropertyNames }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseJsPropertyNames }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  /* ==============================================QueryRowFormat:UseECSqlPropertyNames==========================================================*/

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: true }", async () => {
    const doNotConvertClassIdsToClassNamesWhenAliased = true;
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "BisCore.DrawingCategory",
          ECClassId_1: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "BisCore.DrawingCategory",
          ECClassId_1: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "BisCore.SubjectOwnsPartitionElements",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "BisCore.SubjectOwnsPartitionElements",
          Id: "0x1",
          RelECClassId: "BisCore.SubjectOwnsPartitionElements",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          A: "0x19",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          A: "0x19",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          A: "0x1",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          E: "0x12",
          F: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          E: "0x12",
          F: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          A: "0x1",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          E: "0x12",
          F: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          E: "0x12",
          F: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyNames);
    builder.setConvertClassIdsToNames(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: false }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          A: "0x19",
          B: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          A: "0x19",
          B: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyNames);
    builder.setConvertClassIdsToNames(false);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyNames, classIdsToClassNames: undefined }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          A: "0x19",
          B: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          A: "0x19",
          B: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyNames);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyNames }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  /* ============================================QueryRowFormat:UseECSqlPropertyIndexes============================================================*/

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: true }", async () => {
    const doNotConvertClassIdsToClassNamesWhenAliased = true;
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: ["0x19", "0x19", "BisCore.DrawingCategory", "BisCore.DrawingCategory"],
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "BisCore.DrawingCategory",
          ECClassId_1: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: ["0x1", "BisCore.SubjectOwnsPartitionElements", "0x1", "0xcf"],
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "BisCore.SubjectOwnsPartitionElements",
          Id: "0x1",
          RelECClassId: "BisCore.SubjectOwnsPartitionElements",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "BisCore.DrawingCategory"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "BisCore.DrawingCategory"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "BisCore.PartitionOriginatesFromRepository", "0x1c", "BisCore.PhysicalPartition", "0x12", "BisCore.RepositoryLink"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "BisCore.PartitionOriginatesFromRepository", "0x1c", "BisCore.PhysicalPartition", "0x12", "BisCore.RepositoryLink"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory"],
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory"],
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory"],
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory"],
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink"],
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink"],
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink"],
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink"],
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", "BisCore.ModelContainsElements"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", "BisCore.ModelContainsElements"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "BisCore.PartitionOriginatesFromRepository", "0x1c", "BisCore.PhysicalPartition", "0x12", "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", "BisCore.ModelContainsElements"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "BisCore.PartitionOriginatesFromRepository", "0x1c", "BisCore.PhysicalPartition", "0x12", "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", "BisCore.ModelContainsElements"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements"],
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements"],
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements"],
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository", "0x1c", doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition", "0x12", doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink", {
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        }, "0x1", doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements"],
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyIndexes);
    builder.setConvertClassIdsToNames(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: false }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: ["0x19", "0x19", "0x4c", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: ["0x1", "0xcf", "0x1", "0xcf"],
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyIndexes);
    builder.setConvertClassIdsToNames(false);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes, classIdsToClassNames: undefined }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: ["0x19", "0x19", "0x4c", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: ["0x1", "0xcf", "0x1", "0xcf"],
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: ["0x19", "0x4c"],
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: [{
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: ["0x1", "0xa8", "0x1c", "0xb4", "0x12", "0xa9", {
          Id: "0x1",
          RelECClassId: "0x40",
        }, "0x1", "0x40"],
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setRowFormat(QueryRowFormat.UseECSqlPropertyIndexes);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  /* =============================================QueryRowFormat:undefined================================================================*/

  it("verify return values for system properties with flags { rowFormat: undefined, classIdsToClassNames: true }", async () => {
    const doNotConvertClassIdsToClassNamesWhenAliased = true;
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "BisCore.DrawingCategory",
          className_1: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "BisCore.DrawingCategory",
          ECClassId_1: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "BisCore.SubjectOwnsPartitionElements",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "BisCore.SubjectOwnsPartitionElements",
          Id: "0x1",
          RelECClassId: "BisCore.SubjectOwnsPartitionElements",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "BisCore.DrawingCategory",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "BisCore.PartitionOriginatesFromRepository",
          sourceId: "0x1c",
          sourceClassName: "BisCore.PhysicalPartition",
          targetId: "0x12",
          targetClassName: "BisCore.RepositoryLink",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          a: "0x19",
          b: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0x4c" : "BisCore.DrawingCategory",
        },
        readerResult: {
          A: "0x19",
          B: "BisCore.DrawingCategory",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "BisCore.PartitionOriginatesFromRepository",
          "sourceId": "0x1c",
          "sourceClassName": "BisCore.PhysicalPartition",
          "targetId": "0x12",
          "targetClassName": "BisCore.RepositoryLink",
          "model": {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          "model.id": "0x1",
          "model.relClassName": "BisCore.ModelContainsElements",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "BisCore.PartitionOriginatesFromRepository",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "BisCore.PhysicalPartition",
          TargetECInstanceId: "0x12",
          TargetECClassId: "BisCore.RepositoryLink",
          Model: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          Id: "0x1",
          RelECClassId: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          a: "0x1",
          b: "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: "BisCore.PhysicalPartition",
          e: "0x12",
          f: "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa8" : "BisCore.PartitionOriginatesFromRepository",
          c: "0x1c",
          d: doNotConvertClassIdsToClassNamesWhenAliased ? "0xb4" : "BisCore.PhysicalPartition",
          e: "0x12",
          f: doNotConvertClassIdsToClassNamesWhenAliased ? "0xa9" : "BisCore.RepositoryLink",
          g: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          h: "0x1",
          i: doNotConvertClassIdsToClassNamesWhenAliased ? "0x40" : "BisCore.ModelContainsElements",
        },
        readerResult: {
          A: "0x1",
          B: "BisCore.PartitionOriginatesFromRepository",
          C: "0x1c",
          D: "BisCore.PhysicalPartition",
          E: "0x12",
          F: "BisCore.RepositoryLink",
          G: {
            Id: "0x1",
            RelECClassId: "BisCore.ModelContainsElements",
          },
          H: "0x1",
          I: "BisCore.ModelContainsElements",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setConvertClassIdsToNames(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ classIdsToClassNames: true }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: undefined, classIdsToClassNames: false }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "0x4c",
          className_1: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "0xcf",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setConvertClassIdsToNames(false);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({ classIdsToClassNames: false }), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags { rowFormat: undefined, classIdsToClassNames: undefined }", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "SELECT a.ECInstanceId, b.ECInstanceId, a.ECClassId, b.ECClassId FROM BisCore.Element a, BisCore.Element b LIMIT 1",
        statementResult: {
          id: "0x19",
          id_1: "0x19",
          className: "0x4c",
          className_1: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECInstanceId_1: "0x19",
          ECClassId: "0x4c",
          ECClassId_1: "0x4c",
        },
      },
      {
        query: "SELECT Parent.Id,Parent.RelECClassId, Parent.Id myParentId, Parent.RelECClassId myParentRelClassId FROM BisCore.Element WHERE Parent.Id IS NOT NULL LIMIT 1",
        statementResult: {
          "myParentId": "0x1",
          "myParentRelClassId": "0xcf",
          "parent.id": "0x1",
          "parent.relClassName": "0xcf",
        },
        readerResult: {
          myParentId: "0x1",
          myParentRelClassId: "0xcf",
          Id: "0x1",
          RelECClassId: "0xcf",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId FROM Bis.Element LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId FROM Bis.Element) LIMIT 1",
        statementResult: {
          id: "0x19",
          className: "0x4c",
        },
        readerResult: {
          ECInstanceId: "0x19",
          ECClassId: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId, ECClassId, SourceECInstanceId, SourceECClassId, TargetECInstanceid, TargetECClassId FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          id: "0x1",
          className: "0xa8",
          sourceId: "0x1c",
          sourceClassName: "0xb4",
          targetId: "0x12",
          targetClassName: "0xa9",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          a: "0x19",
          b: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B FROM Bis.Element LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B FROM Bis.Element) LIMIT 1",
        statementResult: {
          a: "0x19",
          b: "0x4c",
        },
        readerResult: {
          A: "0x19",
          B: "0x4c",
        },
      },
      {
        query: "SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId a, ECClassId b, SourceECInstanceId c, SourceECClassId d, TargetECInstanceid e, TargetECClassId f FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
      },
      {
        query: "SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT * FROM (SELECT ECInstanceId A, ECClassId B, SourceECInstanceId C, SourceECClassId D, TargetECInstanceid E, TargetECClassId F FROM Bis.ElementRefersToElements) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
        },
      },
      {
        query: "SELECT Model, Model.Id, Model.RelECClassId from Bis.Element limit 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT Model, Model.Id, Model.RelECClassId from Bis.Element) LIMIT 1",
        statementResult: {
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId, r.ECClassId, r.SourceECInstanceId, r.SourceECClassId, r.TargetECInstanceid, r.TargetECClassId, ele.Model, ele.Model.Id, ele.Model.RelECClassId FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          "id": "0x1",
          "className": "0xa8",
          "sourceId": "0x1c",
          "sourceClassName": "0xb4",
          "targetId": "0x12",
          "targetClassName": "0xa9",
          "model": {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          "model.id": "0x1",
          "model.relClassName": "0x40",
        },
        readerResult: {
          ECInstanceId: "0x1",
          ECClassId: "0xa8",
          SourceECInstanceId: "0x1c",
          SourceECClassId: "0xb4",
          TargetECInstanceId: "0x12",
          TargetECClassId: "0xa9",
          Model: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          Id: "0x1",
          RelECClassId: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId a, r.ECClassId b, r.SourceECInstanceId c, r.SourceECClassId d, r.TargetECInstanceid e, r.TargetECClassId f, ele.Model g, ele.Model.Id h, ele.Model.RelECClassId i FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
      },
      {
        query: "SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
      {
        query: "SELECT * FROM (SELECT r.ECInstanceId A, r.ECClassId B, r.SourceECInstanceId C, r.SourceECClassId D, r.TargetECInstanceid E, r.TargetECClassId F, ele.Model G, ele.Model.Id H, ele.Model.RelECClassId I FROM Bis.ElementRefersToElements r JOIN Bis.Element ele ON ele.ECInstanceId = r.SourceECInstanceId) LIMIT 1",
        statementResult: {
          a: "0x1",
          b: "0xa8",
          c: "0x1c",
          d: "0xb4",
          e: "0x12",
          f: "0xa9",
          g: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          h: "0x1",
          i: "0x40",
        },
        readerResult: {
          A: "0x1",
          B: "0xa8",
          C: "0x1c",
          D: "0xb4",
          E: "0x12",
          F: "0xa9",
          G: {
            Id: "0x1",
            RelECClassId: "0x40",
          },
          H: "0x1",
          I: "0x40",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      imodel1.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({}), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      imodel2.withPreparedStatement(testQuery.query, (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step(), "expected DbResult.BE_SQLITE_ROW");
        assert.deepEqual(stmt.getRow({}), testQuery.statementResult, `(ECSqlStatement) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
      });

      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  /* =============================================abbreviateBlobs:true================================================================*/

  it("verify return values for system properties with flags abbreviateBlobs:true", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "select GeometryStream from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          GeometryStream: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select GeometryStream from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          GeometryStream: "{\"bytes\":203}",
        },
      },
      {
        query: "select GeometryStream a from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          a: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select GeometryStream a from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          a: "{\"bytes\":203}",
        },
      },
      {
        query: "select GeometryStream A from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          A: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select GeometryStream A from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          A: "{\"bytes\":203}",
        },
      },
      {
        query: "select r.GeometryStream from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          GeometryStream: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select r.GeometryStream from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          GeometryStream: "{\"bytes\":203}",
        },
      },
      {
        query: "select r.GeometryStream a from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          a: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select r.GeometryStream a from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          a: "{\"bytes\":203}",
        },
      },
      {
        query: "select r.GeometryStream A from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          A: "{\"bytes\":203}",
        },
      },
      {
        query: "select * from (select r.GeometryStream A from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          A: "{\"bytes\":203}",
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setAbbreviateBlobs(true);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags abbreviateBlobs:false", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "select GeometryStream from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select GeometryStream a from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream a from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select GeometryStream A from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream A from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select r.GeometryStream from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select r.GeometryStream a from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream a from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select r.GeometryStream A from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream A from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    builder.setAbbreviateBlobs(false);
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

  it("verify return values for system properties with flags abbreviateBlobs:undefined", async () => {
    /* eslint-disable @typescript-eslint/naming-convention  */
    const testQueries = [
      //
      {
        query: "select GeometryStream from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select GeometryStream a from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream a from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select GeometryStream A from bis.GeometricElement3d LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select * from (select GeometryStream A from bis.GeometricElement3d) LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select r.GeometryStream from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          GeometryStream: geomData,
        },
      },
      {
        query: "select r.GeometryStream a from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream a from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          a: geomData,
        },
      },
      {
        query: "select r.GeometryStream A from bis.GeometricElement3d r LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
      {
        query: "select * from (select r.GeometryStream A from bis.GeometricElement3d r) LIMIT 1",
        readerResult: {
          A: geomData,
        },
      },
    ];
    /* eslint-enable @typescript-eslint/naming-convention  */
    const builder = new QueryOptionsBuilder();
    // With ECDb Profile 4002
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel1.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel1[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel1.query() must return latest one row");
    }
    // With ECDb Profile 4003
    for (const testQuery of testQueries) {
      let hasRow = false;
      for await (const row of imodel2.createQueryReader(testQuery.query, undefined, builder.getOptions())) {
        assert.deepEqual(row.toRow(), testQuery.readerResult, `(ECSqlReader) "${testQuery.query}" does not match expected result (${path.basename(imodel2[_nativeDb].getFilePath())})`);
        hasRow = true;
      }
      assert.isTrue(hasRow, "imodel2.query() must return latest one row");
    }
  });

});
