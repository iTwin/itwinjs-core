/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { QueryBinder, QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { Id64 } from "@itwin/core-bentley";
import { ECSqlStatement } from "../../ECSqlStatement";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { KnownTestLocations } from "../KnownTestLocations";
import { _getStatementCache } from "../../internal/Symbols";

describe("WithQueryReaderTests", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(async () => {
    iModel.close();
  });
  it("check behvaiour if we call clearCaches in between", () => {
    let actualRowCount = 0;
    const expectedInstanceIds = ["0x1", "0xe", "0x10", "0x11", "0x12",
      "0x13", "0x14", "0x15", "0x16", "0x17"];

    expect(() => iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      let loopCount = 0;
      // First loop - read first 10 rows
      while (loopCount < 10) {
        reader.step()
        actualRowCount++;
        loopCount++;
        assert.isDefined(reader.current[0]);
        assert.equal(reader.current[0], expectedInstanceIds[actualRowCount - 1]);
      }
      assert.equal(loopCount, 10);
      iModel.clearCaches();

      reader.step(); // step should fail after clearCaches
    })).to.throw("Step failed");
  });
  it("should throw error if we try to step on a closed iModelDb object", () => {
    const imodelPath = iModel.pathName;
    expect(() => iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      let loopCount = 0;
      while (loopCount < 10) {
        reader.step();
        assert.isDefined(reader.current[0]);
        loopCount++;
      }
      assert.equal(loopCount, 10);
      iModel.close();

      iModel = SnapshotDb.openFile(imodelPath);
      assert.isDefined(reader.current[0]);
      reader.step(); // step should fail after iModelDb is closed
    })).to.throw("Statement is not prepared");
  });
  it("returning reader from withQueryReader callback should throw error if we try to step on it", () => {
    const readerObj = iModel.withQueryReader("SELECT * FROM bis.Element", (reader) => {
      reader.step();
      return reader;
    });
    expect(readerObj.current[0]).to.equal("0x1"); // will not throw error as we are just accessing current row
    expect(() => readerObj.step()).to.throw("Statement is not prepared");
  });
  it("checking rowFormat unspecified case - values accessed by index", () => {
    // Default rowFormat is UseECSqlPropertyIndexes: columns are accessed by their SELECT-order index.
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", (reader) => {
      assert.isTrue(reader.step());
      const id: string = reader.current[0];
      const classId: string = reader.current[1];
      assert.isTrue(Id64.isValid(classId));
      assert.isTrue(Id64.isValid(id));
      assert.equal(id, "0x19");
    });
  });

  it("checking rowFormat UseECSqlPropertyIndexes - values accessed by index", () => {
    const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseECSqlPropertyIndexes).getOptions();
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", (reader) => {
      assert.isTrue(reader.step());
      // Index 0 → ECInstanceId, index 1 → ECClassId
      const id: string = reader.current[0];
      const classId: string = reader.current[1];
      assert.equal(id, "0x19");
      assert.isTrue(Id64.isValid(classId));
      // Swapping column order changes index, not value
    }, undefined, config);
  });

  it("checking rowFormat UseECSqlPropertyNames - values accessed by ECSQL property name", () => {
    const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseECSqlPropertyNames).getOptions();
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", (reader) => {
      assert.isTrue(reader.step());
      const id: string = reader.current.ECInstanceId;
      const classId: string = reader.current.ECClassId;
      assert.equal(id, "0x19");
      assert.isTrue(Id64.isValid(classId));
    }, undefined, config);
  });

  it("checking rowFormat UseJsPropertyNames - values accessed by JavaScript property name", () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const config = new QueryOptionsBuilder().setRowFormat(QueryRowFormat.UseJsPropertyNames).getOptions();
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", (reader) => {
      assert.isTrue(reader.step());
      // ECInstanceId → id, ECClassId → className (resolved to a fully-qualified class name string)
      const id: string = reader.current.id;
      const className: string = reader.current.className;
      assert.equal(id, "0x19");
      // className should be in the form "SchemaName.ClassName"
      assert.equal(className, "BisCore.DrawingCategory");
    }, undefined, config);
  });

  it("checking rowFormat UseECSqlPropertyNames with convertClassIdsToClassNames - ECClassId returned as class name string", () => {
    const config = new QueryOptionsBuilder()
      .setRowFormat(QueryRowFormat.UseECSqlPropertyNames)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      .setConvertClassIdsToNames(true)
      .getOptions();
    iModel.withQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", (reader) => {
      assert.isTrue(reader.step());
      const id: string = reader.current.ECInstanceId;
      const classId: string = reader.current.ECClassId;
      assert.equal(id, "0x19");
      // With convertClassIdsToClassNames, ECClassId is resolved to "SchemaName.ClassName" instead of an Id
      assert.equal(classId, "BisCore.DrawingCategory");
    }, undefined, config);
  });

  describe("statement caching (regression)", () => {
    // `withQueryReader` used to build a fresh `ECSqlStatement` and re-compile the ECSQL on every
    // call (via `ECSqlRowExecutor`), with no caching. Callers such as `IModelTransformer` invoke
    // per-element helpers (e.g. `hasSubModel`) once per element, so on large models this turned one
    // cached ECSQL prepare into N full native compiles - a significant performance regression. The
    // reader now reuses a prepared statement from the owning db's `_statementCache`.
    const sql = "SELECT ECInstanceId FROM bis.Element WHERE ECInstanceId=?";

    afterEach(() => sinon.restore());

    it("reuses a single prepared statement across repeated calls instead of re-preparing", () => {
      iModel.clearCaches();
      const prepareSpy = sinon.spy(ECSqlStatement.prototype, "prepare"); // eslint-disable-line @typescript-eslint/no-deprecated
      for (let i = 0; i < 20; i++) {
        iModel.withQueryReader(sql, (reader) => {
          reader.step();
        }, new QueryBinder().bindId(1, "0x1"));
      }
      expect(prepareSpy.callCount).to.equal(1, "queries with identical ECSQL text should re-use one cached prepared statement");
    });

    it("returns the prepared statement to the db statement cache after use", () => {
      iModel.clearCaches();
      const statementCache = iModel[_getStatementCache]();
      expect(statementCache.size).to.equal(0);
      iModel.withQueryReader(sql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      expect(statementCache.size).to.be.greaterThan(0);
      // A subsequent call with the same SQL must be able to check the cached statement back out.
      const found = statementCache.findAndRemove(sql);
      expect(found, "statement should be cached keyed by its ECSQL text").to.not.be.undefined;
      found?.[Symbol.dispose]();
    });

    it("keeps nested withQueryReader calls on the same SQL independent", () => {
      iModel.clearCaches();
      // A nested reader on the same SQL must get its own statement (findAndRemove hands the outer
      // reader's statement out of the cache), so results do not corrupt each other.
      const outerId = iModel.withQueryReader(sql, (outer) => {
        assert.isTrue(outer.step());
        const innerId = iModel.withQueryReader(sql, (inner) => {
          assert.isTrue(inner.step());
          return inner.current[0] as string;
        }, new QueryBinder().bindId(1, "0xe"));
        expect(innerId).to.equal("0xe");
        // Outer reader's cursor must be unaffected by the nested reader.
        return outer.current[0] as string;
      }, new QueryBinder().bindId(1, "0x1"));
      expect(outerId).to.equal("0x1");
    });

    it("recovers from a prepare failure without poisoning the cache", () => {
      iModel.clearCaches();
      expect(() => iModel.withQueryReader("SELECT * FROM bis.ThisClassDoesNotExist", (reader) => reader.step()))
        .to.throw();
      // The failed prepare must not have cached anything, and later valid queries still work.
      expect(iModel[_getStatementCache]().findAndRemove("SELECT * FROM bis.ThisClassDoesNotExist")).to.be.undefined;
      iModel.withQueryReader(sql, (reader) => {
        assert.isTrue(reader.step());
        expect(reader.current[0]).to.equal("0x1");
      }, new QueryBinder().bindId(1, "0x1"));
    });

    it("also caches for ECDb.withQueryReader (shared ECSqlRowExecutor path)", () => {
      using ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "syncReaderStmtCache.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
      ecdb.saveChanges();
      const ecdbSql = "SELECT ECInstanceId FROM meta.ECClassDef WHERE ECInstanceId=?";
      const prepareSpy = sinon.spy(ECSqlStatement.prototype, "prepare"); // eslint-disable-line @typescript-eslint/no-deprecated
      for (let i = 0; i < 10; i++)
        ecdb.withQueryReader(ecdbSql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      expect(prepareSpy.callCount).to.equal(1, "ECDb.withQueryReader should also reuse a cached prepared statement");
      expect(ecdb[_getStatementCache]().size).to.be.greaterThan(0);
    });
  });
});
