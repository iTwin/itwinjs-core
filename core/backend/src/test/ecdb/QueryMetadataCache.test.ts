/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { DbQueryRequest, DbQueryResponse, DbResponseKind, DbResponseStatus, DbValueFormat, QueryOptions, QueryPropertyMetaData, QueryRowFormat, SubCategoryAppearance } from "@itwin/core-common";
import { ConcurrentQuery } from "../../ConcurrentQuery";
import { ECDb } from "../../ECDb";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { SpatialCategory } from "../../Category";
import { QueryMetadataCache } from "../../internal/QueryMetadataCache";
import { _queryMetadataCache } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

function makeMeta(...names: string[]): QueryPropertyMetaData[] {
  return names.map((name, index) => ({ className: "", accessString: name, generated: false, index, jsonName: name.toLowerCase(), name, extendType: "", typeName: "string" }));
}

function makeResponse(meta: QueryPropertyMetaData[], status = DbResponseStatus.Done): DbQueryResponse {
  return {
    stats: { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 },
    status,
    kind: DbResponseKind.ECSql,
    meta,
    data: [],
    rowCount: 0,
  };
}

function makeRequest(props?: Partial<DbQueryRequest>): DbQueryRequest {
  return { query: "SELECT 1", includeMetaData: true, ...props };
}

/** A fake native executor: returns `meta` when metadata is requested, an empty array otherwise. */
class FakeExecutor {
  public readonly requests: DbQueryRequest[] = [];
  public status = DbResponseStatus.Done;
  public constructor(public meta: QueryPropertyMetaData[]) { }
  public readonly execute = async (request: DbQueryRequest): Promise<DbQueryResponse> => {
    this.requests.push(request);
    return makeResponse(request.includeMetaData ? this.meta.map((p) => ({ ...p })) : [], this.status);
  };
}

describe("QueryMetadataCache", () => {
  it("passes through requests that do not ask for metadata", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    const request = makeRequest({ includeMetaData: false });
    await cache.execute(request, exec.execute);
    expect(exec.requests[0]).to.equal(request);
    expect(cache.size).to.equal(0);
  });

  it("asks native for metadata only once per query", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A", "B"));
    const request = makeRequest();

    const first = await cache.execute(request, exec.execute);
    const second = await cache.execute(request, exec.execute);

    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, false]);
    expect(request.includeMetaData).to.be.true; // caller's request is not modified
    expect(second.meta).to.deep.equal(first.meta);
    expect(second.meta).to.deep.equal(makeMeta("A", "B"));
    expect(cache.size).to.equal(1);
  });

  it("keys entries by every option that affects metadata", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    const variants: DbQueryRequest[] = [
      makeRequest(),
      makeRequest({ query: "SELECT 2" }),
      makeRequest({ valueFormat: DbValueFormat.JsNames }),
      makeRequest({ abbreviateBlobs: true }),
      makeRequest({ convertClassIdsToClassNames: true }),
      makeRequest({ usePrimaryConn: true }),
    ];
    for (const request of variants)
      await cache.execute(request, exec.execute);

    expect(exec.requests.every((r) => r.includeMetaData)).to.be.true;
    expect(cache.size).to.equal(variants.length);
  });

  it("does not let callers mutate cached metadata", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));

    const first = await cache.execute(makeRequest(), exec.execute);
    first.meta[0].name = "changed";
    const second = await cache.execute(makeRequest(), exec.execute);
    second.meta[0].name = "changed again";
    const third = await cache.execute(makeRequest(), exec.execute);

    expect(third.meta).to.deep.equal(makeMeta("A"));
  });

  it("does not cache metadata from error or non-result responses", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    for (const status of [DbResponseStatus.Error_ECSql_PreparedFailed, DbResponseStatus.QueueFull, DbResponseStatus.Timeout]) {
      exec.status = status;
      await cache.execute(makeRequest(), exec.execute);
      expect(cache.size).to.equal(0);
    }

    exec.status = DbResponseStatus.Done;
    await cache.execute(makeRequest(), exec.execute);
    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, true, true, true]);
    expect(cache.size).to.equal(1);

    exec.status = DbResponseStatus.QueueFull;
    const busy = await cache.execute(makeRequest(), exec.execute);
    expect(busy.meta).to.deep.equal([]);
  });

  it("does not cache metadata from a request that was in flight during clear", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("Old"));
    await cache.execute(makeRequest(), async (request) => {
      cache.clear();
      return exec.execute(request);
    });
    expect(cache.size).to.equal(0);
  });

  it("re-requests metadata when cleared while a cache hit is in flight", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("Old"));
    await cache.execute(makeRequest(), exec.execute);

    exec.meta = makeMeta("New");
    const response = await cache.execute(makeRequest(), async (request) => {
      if (!request.includeMetaData)
        cache.clear();
      return exec.execute(request);
    });

    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, false, true]);
    expect(response.meta).to.deep.equal(makeMeta("New"));
  });

  it("clear drops all entries", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    await cache.execute(makeRequest(), exec.execute);
    cache.clear();
    expect(cache.size).to.equal(0);
    await cache.execute(makeRequest(), exec.execute);
    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, true]);
  });

  it("evicts the least recently used entry when full", async () => {
    const cache = new QueryMetadataCache(2);
    const exec = new FakeExecutor(makeMeta("A"));
    await cache.execute(makeRequest({ query: "q1" }), exec.execute);
    await cache.execute(makeRequest({ query: "q2" }), exec.execute);
    await cache.execute(makeRequest({ query: "q1" }), exec.execute); // hit: q1 becomes most recent
    await cache.execute(makeRequest({ query: "q3" }), exec.execute); // evicts q2
    expect(cache.size).to.equal(2);

    exec.requests.length = 0;
    await cache.execute(makeRequest({ query: "q1" }), exec.execute);
    await cache.execute(makeRequest({ query: "q2" }), exec.execute);
    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([false, true]);
  });
});

const schemaV1 = `<ECSchema schemaName="MetaCacheTest" alias="mct" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECEntityClass typeName="Foo">
    <ECProperty propertyName="PropA" typeName="string"/>
  </ECEntityClass>
</ECSchema>`;

const schemaV2 = `<ECSchema schemaName="MetaCacheTest" alias="mct" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECEntityClass typeName="Foo">
    <ECProperty propertyName="PropA" typeName="string"/>
    <ECProperty propertyName="PropB" typeName="int"/>
  </ECEntityClass>
</ECSchema>`;

const bisSchema = (version: string, withPropB: boolean) => `<ECSchema schemaName="MetaCacheBisTest" alias="mcbt" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  <ECEntityClass typeName="Foo">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="PropA" typeName="string"/>
    ${withPropB ? `<ECProperty propertyName="PropB" typeName="int"/>` : ""}
  </ECEntityClass>
</ECSchema>`;

async function readMetaData(db: ECDb | IModelDb, ecsql: string, config?: QueryOptions): Promise<QueryPropertyMetaData[]> {
  return db.createQueryReader(ecsql, undefined, config).getMetaData();
}

async function readColumnNames(db: ECDb | IModelDb, ecsql: string, config?: QueryOptions): Promise<string[]> {
  return (await readMetaData(db, ecsql, config)).map((p) => p.name);
}

describe("createQueryReader metadata cache", () => {
  afterEach(() => sinon.restore());

  describe("ECDb", () => {
    const outDir = KnownTestLocations.outputDir;

    function importSchemaXml(ecdb: ECDb, xml: string) {
      const schemaPath = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
      IModelJsFs.writeFileSync(schemaPath, xml);
      try {
        ecdb.importSchema(schemaPath);
      } finally {
        IModelJsFs.unlinkSync(schemaPath);
      }
    }

    it("sends includeMetaData:false for later readers of the same query and returns equal metadata", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-hit.ecdb", schemaV1);
      ecdb.withCachedWriteStatement("INSERT INTO mct.Foo(PropA) VALUES('a')", (stmt) => stmt.stepForInsert());
      ecdb.saveChanges();

      const spy = sinon.spy(ConcurrentQuery, "executeQueryRequest");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      for (const config of [{}, { usePrimaryConn: true }, { rowFormat: QueryRowFormat.UseJsPropertyNames }, { abbreviateBlobs: true }]) {
        spy.resetHistory();
        const ecsql = "SELECT * FROM mct.Foo";
        const firstReader = ecdb.createQueryReader(ecsql, undefined, config);
        const firstRows = await firstReader.toArray();
        const firstMeta = await firstReader.getMetaData();
        const secondReader = ecdb.createQueryReader(ecsql, undefined, config);
        const secondRows = await secondReader.toArray();
        const secondMeta = await secondReader.getMetaData();

        expect(spy.args.map((args) => args[1].includeMetaData)).to.deep.equal([true, false]);
        expect(secondMeta).to.deep.equal(firstMeta);
        expect(secondRows).to.deep.equal(firstRows);
        expect(secondMeta.map((p) => p.name)).to.deep.equal(["ECInstanceId", "ECClassId", "PropA"]);
      }
    });

    it("returns rows keyed by the cached metadata", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-rows.ecdb", schemaV1);
      ecdb.withCachedWriteStatement("INSERT INTO mct.Foo(PropA) VALUES('a')", (stmt) => stmt.stepForInsert());
      ecdb.saveChanges();

      const ecsql = "SELECT PropA FROM mct.Foo";
      for (let i = 0; i < 2; ++i) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const reader = ecdb.createQueryReader(ecsql, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames });
        expect(await reader.step()).to.be.true;
        expect(reader.current.toRow()).to.deep.equal({ propA: "a" });
        expect(reader.current.propA).to.equal("a");
        expect(reader.current[0]).to.equal("a");
      }
    });

    it("is cleared by importSchema so SELECT * sees new columns", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-schema.ecdb", schemaV1);
      const ecsql = "SELECT * FROM mct.Foo";
      expect(await readColumnNames(ecdb, ecsql)).to.deep.equal(["ECInstanceId", "ECClassId", "PropA"]);
      expect(await readColumnNames(ecdb, ecsql, { usePrimaryConn: true })).to.deep.equal(["ECInstanceId", "ECClassId", "PropA"]);

      importSchemaXml(ecdb, schemaV2);

      expect(await readColumnNames(ecdb, ecsql)).to.deep.equal(["ECInstanceId", "ECClassId", "PropA", "PropB"]);
      expect(await readColumnNames(ecdb, ecsql, { usePrimaryConn: true })).to.deep.equal(["ECInstanceId", "ECClassId", "PropA", "PropB"]);
    });

    it("is cleared by clearCaches, saveChanges and abandonChanges", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-clear.ecdb", schemaV1);
      const spy = sinon.spy(ConcurrentQuery, "executeQueryRequest");
      const ecsql = "SELECT * FROM mct.Foo";
      const expectMetadataRequested = async (requested: boolean) => {
        spy.resetHistory();
        await readMetaData(ecdb, ecsql);
        expect(spy.args[0][1].includeMetaData).to.equal(requested);
      };

      await expectMetadataRequested(true);
      await expectMetadataRequested(false);
      ecdb.clearCaches();
      await expectMetadataRequested(true);
      ecdb.saveChanges();
      await expectMetadataRequested(true);
      ecdb.abandonChanges();
      await expectMetadataRequested(true);
      await expectMetadataRequested(false);
    });
  });

  describe("IModelDb", () => {
    let imodel: StandaloneDb;

    beforeEach(async () => {
      imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("QueryMetadataCache", `${Guid.createValue()}.bim`), { rootSubject: { name: "QueryMetadataCache" }, enableTransactions: true });
      await imodel.importSchemaStrings([bisSchema("01.00.00", false)]);
    });

    afterEach(() => imodel.close());

    async function populate() {
      await readMetaData(imodel, "SELECT * FROM mcbt.Foo");
      expect(imodel[_queryMetadataCache].size).to.equal(1);
    }

    function insertCategory(txn: EditTxn) {
      SpatialCategory.insert(txn, IModelDb.dictionaryId, Guid.createValue(), new SubCategoryAppearance());
    }

    it("sends includeMetaData:false for later readers of the same query", async () => {
      const spy = sinon.spy(ConcurrentQuery, "executeQueryRequest");
      const first = await readMetaData(imodel, "SELECT ECInstanceId, CodeValue FROM bis.Element");
      const second = await readMetaData(imodel, "SELECT ECInstanceId, CodeValue FROM bis.Element");
      expect(spy.args.map((args) => args[1].includeMetaData)).to.deep.equal([true, false]);
      expect(second).to.deep.equal(first);
    });

    it("is cleared by a schema import so SELECT * sees new columns", async () => {
      const ecsql = "SELECT * FROM mcbt.Foo";
      for (const config of [{}, { usePrimaryConn: true }]) {
        const names = await readColumnNames(imodel, ecsql, config);
        expect(names).to.include("PropA");
        expect(names).to.not.include("PropB");
      }

      await imodel.importSchemaStrings([bisSchema("01.00.01", true)]);

      for (const config of [{}, { usePrimaryConn: true }]) {
        const names = await readColumnNames(imodel, ecsql, config);
        expect(names).to.include("PropA");
        expect(names).to.include("PropB");
      }
    });

    it("is cleared on commit, undo and redo", async () => {
      await populate();
      withEditTxn(imodel, (txn) => insertCategory(txn));
      expect(imodel[_queryMetadataCache].size).to.equal(0);

      await populate();
      imodel.txns.reverseSingleTxn();
      expect(imodel[_queryMetadataCache].size).to.equal(0);

      await populate();
      imodel.txns.reinstateTxn();
      expect(imodel[_queryMetadataCache].size).to.equal(0);
    });

    it("is cleared on abandon and clearCaches", async () => {
      await populate();
      const txn = new EditTxn(imodel, "abandon");
      txn.start();
      insertCategory(txn);
      txn.end("abandon");
      expect(imodel[_queryMetadataCache].size).to.equal(0);

      await populate();
      imodel.clearCaches({ instanceCachesOnly: true });
      expect(imodel[_queryMetadataCache].size).to.equal(0);

      await populate();
      imodel.clearCaches();
      expect(imodel[_queryMetadataCache].size).to.equal(0);
    });
  });
});
