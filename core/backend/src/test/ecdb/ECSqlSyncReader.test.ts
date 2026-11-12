/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import * as path from "node:path";
import { QueryBinder, QueryOptionsBuilder, QueryPropertyMetaData, QueryRowFormat } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { ECDb } from "../../ECDb";
import { _nativeDb } from "../../internal/Symbols";
import { SyncReaderRowFlags } from "../../ECSqlRowExecutor";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelJsFs } from "../../IModelJsFs";
import { SynchronousQueryOptions } from "../../ECSqlSyncReader";

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

      // Rows already read ahead are still returned; stepping past them must fail.
      while (reader.step())
        assert.isDefined(reader.current[0]);
    })).to.throw("Step failed");
  });
  function readCountedRows(db: IModelDb | ECDb) {
    const ecsql = "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < ?) SELECT x FROM cnt";
    // Read-only dbs read ahead in batches of 4 -> 16 -> 64 -> 128 rows, so these counts cover each boundary and its neighbours.
    for (const rowCount of [1, 3, 4, 5, 19, 20, 21, 83, 84, 85, 211, 212, 213, 339, 340, 341, 1000]) {
      const values = db.withQueryReader(ecsql, (reader) => {
        const rows: number[] = [];
        while (reader.step())
          rows.push(reader.current[0]);
        assert.isFalse(reader.step(), "stepping after the end keeps returning false");
        return rows;
      }, QueryBinder.from([rowCount]));
      expect(values).to.deep.equal(Array.from({ length: rowCount }, (_, i) => i + 1), `rowCount=${rowCount}`);
    }
  }

  it("returns every row in order across read-ahead batch boundaries", () => {
    assert.isTrue(iModel.isReadonly);
    readCountedRows(iModel);
  });

  it("returns every row in order from a writable db", () => {
    using ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "syncReaderWritableRowOrder.ecdb");
    readCountedRows(ecdb);
  });

  function readMixedRows(db: IModelDb | ECDb) {
    // Infinity cannot be written as JSON, so those rows are rendered individually between JSON-rendered rows.
    const ecsql = "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 100) SELECT x, CASE WHEN x % 2 = 0 THEN NULL ELSE x END, CASE WHEN x % 7 = 0 THEN 1e308 * 10 ELSE x * 2 END FROM cnt";
    const rows = db.withQueryReader(ecsql, (reader) => {
      const result: any[][] = [];
      while (reader.step())
        result.push([reader.current[0], reader.current[1], reader.current[2]]);
      return result;
    });
    expect(rows).to.deep.equal(Array.from({ length: 100 }, (_, i) => {
      const x = i + 1;
      return [x, x % 2 === 0 ? undefined : x, x % 7 === 0 ? Infinity : x * 2];
    }));
  }

  it("returns null cells as undefined and non-finite values from read-ahead batches", () => {
    readMixedRows(iModel);
  });

  it("returns null cells as undefined and non-finite values from a writable db", () => {
    using ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "syncReaderMixedRows.ecdb");
    readMixedRows(ecdb);
  });

  it("returns the same rows whether the native batch is rendered as JSON or cell by cell", () => {
    const readNative = (ecsql: string, renderAsJson: boolean, options: SynchronousQueryOptions = {}) => {
      let rowFlags = SyncReaderRowFlags.DoNotConvertClassIdsToClassNamesWhenAliased;
      if (options.abbreviateBlobs)
        rowFlags |= SyncReaderRowFlags.AbbreviateBlobs;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (options.convertClassIdsToClassNames)
        rowFlags |= SyncReaderRowFlags.ClassIdsToClassNames;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (options.rowFormat === QueryRowFormat.UseJsPropertyNames)
        rowFlags |= SyncReaderRowFlags.UseJsName;
      const out: any[] = [];
      const reader = iModel[_nativeDb].prepareECSqlBatchReader(ecsql, undefined, rowFlags, 0, out);
      try {
        expect(out[0]).to.be.undefined;
        const rows: any[] = [];
        for (;;) {
          const batch = reader.stepBatch(16, renderAsJson);
          if (typeof batch === "number") {
            expect(batch).to.equal(DbResult.BE_SQLITE_DONE);
            return rows;
          }
          if (renderAsJson)
            expect(batch).to.be.a("string");
          rows.push(...(typeof batch === "string" ? JSON.parse(batch) : batch));
        }
      } finally {
        reader.dispose();
      }
    };

    for (const ecsql of [
      "SELECT * FROM bis.Element",
      "SELECT * FROM bis.GeometricElement3d",
      "SELECT ECInstanceId,ECClassId,Model,Parent,Origin,BBoxLow,BBoxHigh FROM bis.GeometricElement3d ORDER BY ECInstanceId",
    ]) {
      for (const options of [
        {},
        { convertClassIdsToClassNames: true },
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        { rowFormat: QueryRowFormat.UseJsPropertyNames, convertClassIdsToClassNames: true },
        { abbreviateBlobs: true },
        {},
      ]) {
        const expected = readNative(ecsql, false, options);
        assert.isAbove(expected.length, 0);
        const actual = iModel.withQueryReader(ecsql, (reader) => {
          const rows: any[] = [];
          while (reader.step())
            rows.push(reader.current.toArray());
          return rows;
        }, undefined, { ...options });
        expect(actual).to.deep.equal(expected, ecsql);
      }
    }
    const blobs = readNative("SELECT GeometryStream FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL", false);
    assert.isAbove(blobs.length, 0);
    assert.isTrue(blobs.every((row) => row[0] instanceof Uint8Array));
  });

  it("preserves non-finite mapped double values when using the prepared renderer", () => {
    const schema = `<ECSchema schemaName="SyncRendering" alias="sr" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Sample"><ECProperty propertyName="Amount" typeName="double"/></ECEntityClass>
    </ECSchema>`;
    using ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "syncReaderMappedDoubles.ecdb", schema);
    for (const value of ["42.0", "1e308 * 10", "-1e308 * 10", "43.0"])
      ecdb.withCachedWriteStatement(`INSERT INTO sr.Sample(Amount) VALUES(${value})`, (stmt) => stmt.stepForInsert());
    ecdb.saveChanges();
    const actual = ecdb.withQueryReader("SELECT Amount FROM sr.Sample ORDER BY ECInstanceId", (reader) => reader.toArray());
    expect(actual).to.deep.equal([[42], [Infinity], [-Infinity], [43]]);
  });

  it("restarts from the first row when a query is reused after an early exit", () => {
    const ecsql = "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt WHERE x < 500) SELECT x FROM cnt";
    for (const take of [1, 4, 5, 30]) {
      const values = iModel.withQueryReader(ecsql, (reader) => {
        const rows: number[] = [];
        while (rows.length < take && reader.step())
          rows.push(reader.current[0]);
        return rows;
      });
      expect(values).to.deep.equal(Array.from({ length: take }, (_, i) => i + 1));
    }
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

  /** Records the native readers leased by `withQueryReader` on `db`. N-API prototype methods are not configurable,
   * so the native db and each reader are instrumented through own properties.
   */
  function instrumentSyncReaders(db: IModelDb | ECDb) {
    const nativeDb = db[_nativeDb];
    const prepare = nativeDb.prepareECSqlBatchReader.bind(nativeDb);
    const statementIds: number[] = [];
    const getMetadataSpy = sinon.spy();
    Object.defineProperty(nativeDb, "prepareECSqlBatchReader", {
      configurable: true,
      value: (ecsql: string, args: any[] | undefined, rowFlags: number, maxRows: number, out: any[], logErrors?: boolean) => {
        const reader = prepare(ecsql, args, rowFlags, maxRows, out, logErrors);
        statementIds.push(out[1]);
        expect(out[1]).to.equal(reader.getStatementId());
        const getMetadata = reader.getMetadata.bind(reader);
        Object.defineProperty(reader, "getMetadata", {
          configurable: true,
          value: () => {
            getMetadataSpy();
            return getMetadata();
          },
        });
        return reader;
      },
    });
    return {
      statementIds,
      getMetadataSpy,
      [Symbol.dispose]: () => { delete (nativeDb as any).prepareECSqlBatchReader; },
    };
  }

  describe("statement caching (regression)", () => {
    // `withQueryReader` used to build a fresh statement and re-compile the ECSQL on every call. Callers such as
    // `IModelTransformer` invoke per-element helpers (e.g. `hasSubModel`) once per element, so on large models this
    // turned one cached ECSQL prepare into N full native compiles. The reader now leases a prepared statement from
    // the native concurrent query statement cache of the primary connection.
    const sql = "SELECT ECInstanceId FROM bis.Element WHERE ECInstanceId=?";

    afterEach(() => sinon.restore());

    it("reuses a single prepared statement across repeated calls instead of re-preparing", () => {
      iModel.clearCaches();
      using readers = instrumentSyncReaders(iModel);
      for (let i = 0; i < 20; i++) {
        iModel.withQueryReader(sql, (reader) => {
          reader.step();
        }, new QueryBinder().bindId(1, "0x1"));
      }
      expect(readers.statementIds).to.have.lengthOf(20);
      expect(new Set(readers.statementIds).size).to.equal(1, "queries with identical ECSQL text should re-use one cached prepared statement");
    });

    it("keeps nested withQueryReader calls on the same SQL independent", () => {
      iModel.clearCaches();
      using readers = instrumentSyncReaders(iModel);
      // A nested reader on the same SQL must get its own statement while the outer one is leased,
      // so results do not corrupt each other.
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
      expect(readers.statementIds[0]).to.not.equal(readers.statementIds[1]);
    });

    it("recovers from a prepare failure without poisoning the cache", () => {
      iModel.clearCaches();
      const invalidSql = "SELECT * FROM bis.ThisClassDoesNotExist";
      expect(() => iModel.withQueryReader(invalidSql, (reader) => reader.step())).to.throw();
      expect(() => iModel.withQueryReader(invalidSql, (reader) => reader.step())).to.throw();

      using readers = instrumentSyncReaders(iModel);
      for (let i = 0; i < 2; i++) {
        iModel.withQueryReader(sql, (reader) => {
          assert.isTrue(reader.step());
          expect(reader.current[0]).to.equal("0x1");
        }, new QueryBinder().bindId(1, "0x1"));
      }
      expect(new Set(readers.statementIds).size).to.equal(1);
    });

    it("releases the executor and cached statement when binding fails during reader construction", () => {
      iModel.clearCaches();
      iModel.withQueryReader(sql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      const listenerCount = iModel.onBeforeClose.numberOfListeners;

      using readers = instrumentSyncReaders(iModel);
      expect(() => iModel.withQueryReader(sql, () => undefined, new QueryBinder().bindId("missing", "0x1"))).to.throw("Failed to bind parameters");
      expect(iModel.onBeforeClose.numberOfListeners).to.equal(listenerCount);
      expect(readers.statementIds).to.have.lengthOf(0, "a reader is not created when binding fails");

      iModel.withQueryReader(sql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      iModel.withQueryReader(sql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      expect(new Set(readers.statementIds).size).to.equal(1, "the statement leased before the bind failure should be returned to the cache");
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
      using readers = instrumentSyncReaders(ecdb);
      for (let i = 0; i < 10; i++)
        ecdb.withQueryReader(ecdbSql, (reader) => reader.step(), new QueryBinder().bindId(1, "0x1"));
      expect(new Set(readers.statementIds).size).to.equal(1, "ECDb.withQueryReader should also reuse a cached prepared statement");
    });
  });

  describe("metadata caching", () => {
    // Column metadata depends only on the prepared statement and the row-adaptor options, so it is cached
    // per native statement id instead of being fetched from native code on every withQueryReader call.
    const sql = "SELECT ECInstanceId, ECClassId, CodeValue, GeometryStream FROM bis.GeometricElement3d WHERE ECInstanceId=?";
    let elementId: string;

    before(() => {
      elementId = iModel.withQueryReader("SELECT ECInstanceId FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL LIMIT 1", (reader) => {
        assert.isTrue(reader.step());
        return reader.current[0] as string;
      });
    });

    afterEach(() => sinon.restore());

    function readMetadata(options: SynchronousQueryOptions): { meta: QueryPropertyMetaData[], row: any } {
      return iModel.withQueryReader(sql, (reader) => {
        assert.isTrue(reader.step());
        return { meta: reader.getMetaData(), row: reader.current.toRow() };
      }, new QueryBinder().bindId(1, elementId), options);
    }

    it("returns metadata matching the row options when the same statement is reused with different options", () => {
      const optionSets: SynchronousQueryOptions[] = [
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
        { rowFormat: QueryRowFormat.UseECSqlPropertyNames },
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        { rowFormat: QueryRowFormat.UseJsPropertyNames, abbreviateBlobs: true },
        { rowFormat: QueryRowFormat.UseECSqlPropertyNames, abbreviateBlobs: true },
        { rowFormat: QueryRowFormat.UseECSqlPropertyNames, convertClassIdsToClassNames: true },
      ];

      // Expected metadata comes from a freshly prepared statement for each option set.
      const expected = optionSets.map((options) => {
        iModel.clearCaches();
        return readMetadata({ ...options }).meta;
      });
      expect(expected[0].map((p) => p.jsonName)).to.deep.equal(["id", "className", "codeValue", "geometryStream"]);
      expect(expected[1].map((p) => p.name)).to.deep.equal(["ECInstanceId", "ECClassId", "CodeValue", "GeometryStream"]);

      iModel.clearCaches();
      for (let pass = 0; pass < 2; pass++) {
        optionSets.forEach((options, i) => {
          const { meta, row } = readMetadata({ ...options });
          expect(meta).to.deep.equal(expected[i]);
          const geometryStream = row[options.rowFormat === QueryRowFormat.UseECSqlPropertyNames ? "GeometryStream" : "geometryStream"];
          if (options.abbreviateBlobs)
            expect(geometryStream).to.be.a("string").and.match(/^\{"bytes":\d+\}$/);
          else
            expect(geometryStream).to.be.instanceOf(Uint8Array);
        });
      }
    });

    it("fetches native metadata once per statement and row options", () => {
      using readers = instrumentSyncReaders(iModel);
      const getMetadataSpy = readers.getMetadataSpy;
      iModel.clearCaches();
      const options = { rowFormat: QueryRowFormat.UseECSqlPropertyNames };
      for (let i = 0; i < 10; i++)
        readMetadata({ ...options });
      expect(getMetadataSpy.callCount).to.equal(1);

      readMetadata({ ...options, abbreviateBlobs: true });
      readMetadata({ ...options, abbreviateBlobs: true });
      expect(getMetadataSpy.callCount).to.equal(2, "different row options need their own metadata");

      iModel.clearCaches();
      readMetadata({ ...options });
      expect(getMetadataSpy.callCount).to.equal(3, "a re-prepared statement must not reuse cached metadata");
    });

    it("does not share metadata objects between calls", () => {
      iModel.clearCaches();
      const options = { rowFormat: QueryRowFormat.UseECSqlPropertyNames };
      const expected = structuredClone(readMetadata({ ...options }).meta);

      iModel.withQueryReader(sql, (reader) => {
        assert.isTrue(reader.step());
        const readerMeta = reader.getMetaData();
        readerMeta[0].name = "Changed";
        readerMeta[0].index = 3;
        readerMeta.reverse();
        const proxyMeta = reader.current.getMetaData();
        proxyMeta.push({ ...proxyMeta[0], name: "Extra" });
      }, new QueryBinder().bindId(1, elementId), options);

      const { meta, row } = readMetadata({ ...options });
      expect(meta).to.deep.equal(expected);
      expect(row.ECInstanceId).to.equal(elementId);
    });

    it("isolates metadata exposed only through the row proxy, including nested readers", () => {
      const options = { rowFormat: QueryRowFormat.UseECSqlPropertyNames };
      const expected = structuredClone(readMetadata({ ...options }).meta);
      iModel.withQueryReader(sql, (outer) => {
        assert.isTrue(outer.step());
        const outerMeta = outer.current.getMetaData();
        iModel.withQueryReader(sql, (inner) => {
          assert.isTrue(inner.step());
          const innerMeta = inner.current.getMetaData();
          expect(innerMeta).to.deep.equal(expected);
          innerMeta[0].name = "Changed";
          innerMeta.reverse();
        }, new QueryBinder().bindId(1, elementId), { ...options });
        expect(outerMeta).to.deep.equal(expected);
        outerMeta[0].name = "OuterChanged";
        outerMeta.push({ ...outerMeta[0], name: "Extra" });
      }, new QueryBinder().bindId(1, elementId), { ...options });
      expect(readMetadata({ ...options }).meta).to.deep.equal(expected);
    });

    it("returns metadata for queries that produce no rows", () => {
      iModel.clearCaches();
      const options = { rowFormat: QueryRowFormat.UseECSqlPropertyNames };
      const expected = readMetadata({ ...options }).meta;
      for (let i = 0; i < 3; i++) {
        iModel.withQueryReader(sql, (reader) => {
          expect(reader.step()).to.be.false;
          expect(reader.getMetaData()).to.deep.equal(expected);
        }, new QueryBinder().bindId(1, "0xffffff"), options);
        iModel.withQueryReader(sql, (reader) => {
          expect(reader.getMetaData()).to.deep.equal(expected);
          expect(reader.toArray()).to.deep.equal([]);
        }, new QueryBinder().bindId(1, "0xffffff"), options);
      }
    });

    it("reflects a schema import between calls", () => {
      const schemaXml = (version: string, extraProperty: string) => `<ECSchema schemaName="Test" alias="ts" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
            ${extraProperty}
          </ECEntityClass>
        </ECSchema>`;
      using ecdb = ECDbTestHelper.createECDb(KnownTestLocations.outputDir, "syncReaderMetadataCache.ecdb", schemaXml("01.00.00", ""));
      ecdb.withCachedWriteStatement("INSERT INTO ts.Foo(n) VALUES(1)", (stmt) => stmt.stepForInsert());
      ecdb.saveChanges();

      const fooSql = "SELECT * FROM ts.Foo";
      const options = { rowFormat: QueryRowFormat.UseECSqlPropertyNames };
      const readNames = () => ecdb.withQueryReader(fooSql, (reader) => {
        assert.isTrue(reader.step());
        return reader.getMetaData().map((p) => p.name);
      }, undefined, options);
      expect(readNames()).to.deep.equal(["ECInstanceId", "ECClassId", "n"]);
      expect(readNames()).to.deep.equal(["ECInstanceId", "ECClassId", "n"]);

      const schemaPath = path.join(KnownTestLocations.outputDir, "syncReaderMetadataCache.ecschema.xml");
      IModelJsFs.writeFileSync(schemaPath, schemaXml("01.00.01", `<ECProperty propertyName="m" typeName="string"/>`));
      ecdb.importSchema(schemaPath);
      ecdb.saveChanges();

      expect(readNames()).to.deep.equal(["ECInstanceId", "ECClassId", "n", "m"]);
    });
  });
});
