/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as sinon from "sinon";
import { Guid, IModelStatus } from "@itwin/core-bentley";
import {
  Code, DbQueryRequest, DbQueryResponse, DbResponseKind, DbResponseStatus, DbValueFormat, IModel, PhysicalElementProps, QueryOptions, QueryPropertyMetaData,
  QueryRowFormat, SubCategoryAppearance,
} from "@itwin/core-common";
import { ConcurrentQuery } from "../../ConcurrentQuery";
import { ChannelControl } from "../../ChannelControl";
import { ECDb } from "../../ECDb";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { BriefcaseDb, IModelDb, StandaloneDb } from "../../IModelDb";
import { BriefcaseManager } from "../../BriefcaseManager";
import { IModelJsFs } from "../../IModelJsFs";
import { SpatialCategory } from "../../Category";
import { HubMock } from "../../internal/HubMock";
import { QueryMetadataCache } from "../../internal/QueryMetadataCache";
import { HubWrappers, IModelTestUtils, TestUserType } from "../IModelTestUtils";
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
    await cache.executeCachedQueryRequest(request, exec.execute);
    expect(exec.requests[0]).to.equal(request);
    expect(cache.size).to.equal(0);
  });

  it("asks native for metadata only once per query", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A", "B"));
    const request = makeRequest();

    const first = await cache.executeCachedQueryRequest(request, exec.execute);
    const second = await cache.executeCachedQueryRequest(request, exec.execute);

    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, false]);
    expect(request.includeMetaData).to.be.true; // caller's request is not modified
    expect(second.meta).to.deep.equal(first.meta);
    expect(second.meta).to.deep.equal(makeMeta("A", "B"));
    expect(cache.size).to.equal(1);
  });

  it("serves cached metadata synchronously for primary-connection requests", () => {
    const cache = new QueryMetadataCache();
    const requests: DbQueryRequest[] = [];
    let status = DbResponseStatus.Done;
    const execute = (req: DbQueryRequest): DbQueryResponse => {
      requests.push(req);
      return makeResponse(req.includeMetaData ? makeMeta("A", "B") : [], status);
    };
    const request = makeRequest({ usePrimaryConn: true });

    status = DbResponseStatus.Error;
    expect(cache.executeCachedPrimaryQueryRequest(request, execute).meta).to.deep.equal(makeMeta("A", "B"));
    expect(cache.size).to.equal(0); // failed responses are not cached

    status = DbResponseStatus.Done;
    const first = cache.executeCachedPrimaryQueryRequest(request, execute);
    const second = cache.executeCachedPrimaryQueryRequest(request, execute);
    expect(requests.map((r) => r.includeMetaData)).to.deep.equal([true, true, false]);
    expect(request.includeMetaData).to.be.true;
    expect(second.meta).to.deep.equal(first.meta);
    expect(second.meta).to.not.equal(first.meta);

    status = DbResponseStatus.Cancel;
    expect(cache.executeCachedPrimaryQueryRequest(request, execute).meta).to.deep.equal([]);
    expect(cache.executeCachedPrimaryQueryRequest({ ...request, includeMetaData: false }, execute).meta).to.deep.equal([]);
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
      await cache.executeCachedQueryRequest(request, exec.execute);

    expect(exec.requests.every((r) => r.includeMetaData)).to.be.true;
    expect(cache.size).to.equal(variants.length);
  });

  it("shares one entry across options that do not affect metadata", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    const variants: DbQueryRequest[] = [
      makeRequest({ args: { 1: { type: "id", value: "0x1" } } }),
      makeRequest({ args: { 1: { type: "id", value: "0x2" } } }),
      makeRequest({ limit: { count: 1 } }),
      makeRequest({ limit: { count: 10, offset: 5 } }),
      makeRequest({ rowFormat: QueryRowFormat.UseECSqlPropertyIndexes }),
      makeRequest({ rowFormat: QueryRowFormat.UseECSqlPropertyNames }),
      makeRequest({ rowFormat: QueryRowFormat.UseJsPropertyNames }), // eslint-disable-line @typescript-eslint/no-deprecated
      makeRequest({ priority: 5, restartToken: "token", suppressLogErrors: true, quota: { time: 10 }, delay: 1 }),
    ];
    for (const request of variants)
      await cache.executeCachedQueryRequest(request, exec.execute);

    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, ...variants.slice(1).map(() => false)]);
    expect(cache.size).to.equal(1);
  });

  it("does not let callers mutate cached metadata", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));

    const first = await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    first.meta[0].name = "changed";
    const second = await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    second.meta[0].name = "changed again";
    const third = await cache.executeCachedQueryRequest(makeRequest(), exec.execute);

    expect(third.meta).to.deep.equal(makeMeta("A"));
  });

  it("does not cache metadata from error or non-result responses", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    for (const status of [DbResponseStatus.Error_ECSql_PreparedFailed, DbResponseStatus.QueueFull, DbResponseStatus.Timeout]) {
      exec.status = status;
      await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
      expect(cache.size).to.equal(0);
    }

    exec.status = DbResponseStatus.Done;
    await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, true, true, true]);
    expect(cache.size).to.equal(1);

    exec.status = DbResponseStatus.QueueFull;
    const busy = await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    expect(busy.meta).to.deep.equal([]);
  });

  it("does not cache metadata from a request that was in flight during clear", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("Old"));
    await cache.executeCachedQueryRequest(makeRequest(), async (request) => {
      cache.clear();
      return exec.execute(request);
    });
    expect(cache.size).to.equal(0);
  });

  it("re-requests metadata without the restart token when cleared while a cache hit is in flight", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("Old"));
    const request = makeRequest({ restartToken: "token" });
    await cache.executeCachedQueryRequest(request, exec.execute);

    exec.meta = makeMeta("New");
    const response = await cache.executeCachedQueryRequest(request, async (r) => {
      if (!r.includeMetaData)
        cache.clear();
      return exec.execute(r);
    });

    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, false, true]);
    // A newer request may already own the token; resubmitting with it would cancel that request.
    expect(exec.requests.map((r) => r.restartToken)).to.deep.equal(["token", "token", undefined]);
    expect(request.restartToken).to.equal("token"); // caller's request is not modified
    expect(response.meta).to.deep.equal(makeMeta("New"));
    expect(cache.size).to.equal(1);
  });

  it("returns a cancelled or failed cache hit as is, even when cleared while in flight", async () => {
    for (const status of [DbResponseStatus.Cancel, DbResponseStatus.QueueFull, DbResponseStatus.Error_ECSql_PreparedFailed]) {
      const cache = new QueryMetadataCache();
      const exec = new FakeExecutor(makeMeta("A"));
      const request = makeRequest({ restartToken: "token" });
      await cache.executeCachedQueryRequest(request, exec.execute);

      exec.status = status;
      const response = await cache.executeCachedQueryRequest(request, async (r) => {
        cache.clear();
        return exec.execute(r);
      });

      expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, false]);
      expect(response.status).to.equal(status);
      expect(response.meta).to.deep.equal([]);
    }
  });

  it("clear drops all entries", async () => {
    const cache = new QueryMetadataCache();
    const exec = new FakeExecutor(makeMeta("A"));
    await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    cache.clear();
    expect(cache.size).to.equal(0);
    await cache.executeCachedQueryRequest(makeRequest(), exec.execute);
    expect(exec.requests.map((r) => r.includeMetaData)).to.deep.equal([true, true]);
  });

  it("evicts the least recently used entry when full", async () => {
    const cache = new QueryMetadataCache(2);
    const exec = new FakeExecutor(makeMeta("A"));
    await cache.executeCachedQueryRequest(makeRequest({ query: "q1" }), exec.execute);
    await cache.executeCachedQueryRequest(makeRequest({ query: "q2" }), exec.execute);
    await cache.executeCachedQueryRequest(makeRequest({ query: "q1" }), exec.execute); // hit: q1 becomes most recent
    await cache.executeCachedQueryRequest(makeRequest({ query: "q3" }), exec.execute); // evicts q2
    expect(cache.size).to.equal(2);

    exec.requests.length = 0;
    await cache.executeCachedQueryRequest(makeRequest({ query: "q1" }), exec.execute);
    await cache.executeCachedQueryRequest(makeRequest({ query: "q2" }), exec.execute);
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

/** Spy on both native entry points: worker requests are asynchronous, primary-connection requests complete synchronously. */
function spyQueryRequests() {
  const worker = sinon.spy(ConcurrentQuery, "executeQueryRequest");
  const primary = sinon.spy(ConcurrentQuery, "executePrimaryQueryRequest");
  return {
    get requests(): DbQueryRequest[] {
      const calls: sinon.SinonSpyCall[] = [...worker.getCalls(), ...primary.getCalls()];
      return calls.sort((a, b) => a.calledBefore(b) ? -1 : 1).map((call) => call.args[1] as DbQueryRequest);
    },
    resetHistory: () => { worker.resetHistory(); primary.resetHistory(); },
    restore: () => { worker.restore(); primary.restore(); },
  };
}

/** Read the metadata of a fresh reader and check whether it had to ask native for it, i.e. whether the cache missed. */
async function expectMetadataRequested(db: ECDb | IModelDb, ecsql: string, requested: boolean, config?: QueryOptions): Promise<void> {
  const spy = spyQueryRequests();
  try {
    await readMetaData(db, ecsql, config);
    expect(spy.requests[0].includeMetaData).to.equal(requested);
  } finally {
    spy.restore();
  }
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

      const spy = spyQueryRequests();
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

        expect(spy.requests.map((request) => request.includeMetaData)).to.deep.equal([true, false]);
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

    it("is cleared by clearCaches but kept across saveChanges and abandonChanges", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-clear.ecdb", schemaV1);
      const ecsql = "SELECT * FROM mct.Foo";

      await expectMetadataRequested(ecdb, ecsql, true);
      await expectMetadataRequested(ecdb, ecsql, false);
      ecdb.clearCaches();
      await expectMetadataRequested(ecdb, ecsql, true);
      ecdb.withCachedWriteStatement("INSERT INTO mct.Foo(PropA) VALUES('a')", (stmt) => stmt.stepForInsert());
      ecdb.saveChanges();
      await expectMetadataRequested(ecdb, ecsql, false);
      ecdb.abandonChanges();
      await expectMetadataRequested(ecdb, ecsql, false);
    });

    it("is cleared by dropSchemas", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-drop.ecdb", schemaV1);
      const ecsql = "SELECT * FROM mct.Foo";
      await readMetaData(ecdb, ecsql);
      ecdb.dropSchemas(["MetaCacheTest"]);

      const spy = sinon.spy(ConcurrentQuery, "executeQueryRequest");
      let error: unknown;
      try {
        await readMetaData(ecdb, ecsql);
      } catch (e) {
        error = e;
      }
      expect(error).to.not.be.undefined; // the class is gone, so the query must fail to prepare instead of reusing stale metadata
      expect(spy.args[0][1].includeMetaData).to.be.true;
    });

    it("does not cancel a newer reader that shares the restart token when cleared during a cache hit", async () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "query-metadata-cache-restart.ecdb", schemaV1);
      for (let i = 0; i < 10; ++i)
        ecdb.withCachedWriteStatement(`INSERT INTO mct.Foo(PropA) VALUES('${i}')`, (stmt) => stmt.stepForInsert());
      ecdb.saveChanges();

      const ecsql = "SELECT PropA FROM mct.Foo ORDER BY PropA";
      const config = { restartToken: "shared-token" };
      const expected = (await ecdb.createQueryReader(ecsql, undefined, config).toArray()).map((row) => row[0]);
      expect(expected).to.have.length(10);

      // Once reader A's cache-hit request has returned rows, clear the cache and start reader B with the same token, then
      // let A see its response. A must re-request metadata without the token: native cancels the older of two requests
      // sharing a token, so resubmitting with it would cancel B.
      // (Clearing while A's request is still in flight is not tested here: native then answers A with ShuttingDown and
      // ECSqlReader retries the original request, token included, exactly as it does without the metadata cache.)
      const executeQueryRequest = ConcurrentQuery.executeQueryRequest.bind(ConcurrentQuery);
      let readerB: Promise<any[]> | undefined;
      const requests: DbQueryRequest[] = [];
      sinon.stub(ConcurrentQuery, "executeQueryRequest").callsFake(async (db, request) => {
        requests.push(request);
        const response = await executeQueryRequest(db, request);
        if (readerB === undefined && !request.includeMetaData && request.restartToken === config.restartToken) {
          ecdb.clearCaches();
          readerB = ecdb.createQueryReader(ecsql, undefined, config).toArray();
        }
        return response;
      });

      const resultA = await ecdb.createQueryReader(ecsql, undefined, config).toArray();
      expect(readerB).to.not.be.undefined;
      expect((await readerB!).map((row) => row[0])).to.deep.equal(expected);
      expect(resultA.map((row) => row[0])).to.deep.equal(expected);
      expect(requests.map((r) => ({ includeMetaData: r.includeMetaData, restartToken: r.restartToken }))).to.have.deep.members([
        { includeMetaData: false, restartToken: config.restartToken }, // A's cache hit
        { includeMetaData: true, restartToken: config.restartToken }, // B
        { includeMetaData: true, restartToken: undefined }, // A's re-request after the clear
      ]);
    });
  });

  describe("IModelDb", () => {
    let imodel: StandaloneDb;

    beforeEach(async () => {
      imodel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("QueryMetadataCache", `${Guid.createValue()}.bim`), { rootSubject: { name: "QueryMetadataCache" }, enableTransactions: true });
      await imodel.importSchemaStrings([bisSchema("01.00.00", false)]);
    });

    afterEach(() => imodel.close());

    const fooEcsql = "SELECT * FROM mcbt.Foo";

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

    it("is kept on commit, undo and redo", async () => {
      await readMetaData(imodel, fooEcsql);
      withEditTxn(imodel, (txn) => insertCategory(txn));
      await expectMetadataRequested(imodel, fooEcsql, false);

      expect(imodel.txns.reverseSingleTxn()).to.equal(IModelStatus.Success);
      await expectMetadataRequested(imodel, fooEcsql, false);

      expect(imodel.txns.reinstateTxn()).to.equal(IModelStatus.Success);
      await expectMetadataRequested(imodel, fooEcsql, false);
    });

    it("never needs clearing on undo because undo cannot cross a schema import", async () => {
      withEditTxn(imodel, (txn) => insertCategory(txn));
      await imodel.importSchemaStrings([bisSchema("01.00.01", true)]);
      expect(await readColumnNames(imodel, fooEcsql)).to.include("PropB");

      // Saving a schema txn starts a new undo session, so neither the import nor anything before it can be undone.
      expect(imodel.txns.isUndoPossible).to.be.false;
      expect(imodel.txns.reverseAll()).to.equal(IModelStatus.NothingToUndo);
      withEditTxn(imodel, (txn) => insertCategory(txn));
      expect(imodel.txns.reverseAll()).to.equal(IModelStatus.Success);
      expect(imodel.txns.isUndoPossible).to.be.false;
      expect(await readColumnNames(imodel, fooEcsql)).to.include("PropB");
      expect(await readColumnNames(imodel, fooEcsql, { usePrimaryConn: true })).to.include("PropB");
    });

    it("is kept on abandon and instance-only clearCaches, and cleared by a full clearCaches", async () => {
      await readMetaData(imodel, fooEcsql);
      const txn = new EditTxn(imodel, "abandon");
      txn.start();
      insertCategory(txn);
      txn.end("abandon");
      await expectMetadataRequested(imodel, fooEcsql, false);

      imodel.clearCaches({ instanceCachesOnly: true });
      await expectMetadataRequested(imodel, fooEcsql, false);

      imodel.clearCaches();
      await expectMetadataRequested(imodel, fooEcsql, true);
    });
  });
});

// HubMock.startup stubs CloudSqlite with sinon, so this suite must not call sinon.restore().
describe("createQueryReader metadata cache across briefcases", () => {
  const ecsql = "SELECT * FROM mcbt.Foo ORDER BY PropA";
  const configs: QueryOptions[] = [{}, { usePrimaryConn: true }];

  before(() => HubMock.startup("QueryMetadataCache", KnownTestLocations.outputDir));
  after(() => HubMock.shutdown());

  async function insertFoo(db: BriefcaseDb, props: { propA: string, propB?: number }): Promise<void> {
    await db.locks.acquireLocks({ shared: IModel.dictionaryId });
    const txn = new EditTxn(db, "insert Foo");
    txn.start();
    const [, model] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(txn, IModelTestUtils.getUniqueModelCode(db, "MetaCacheModel"), true);
    const category = SpatialCategory.insert(txn, IModel.dictionaryId, Guid.createValue(), new SubCategoryAppearance());
    const element: PhysicalElementProps = { classFullName: "MetaCacheBisTest:Foo", model, category, code: Code.createEmpty() };
    txn.insertElement({ ...element, ...props });
    txn.end();
  }

  /** Verify both the metadata and the rows a fresh reader returns, on the worker and on the primary connection. */
  async function expectFoo(db: IModelDb, withPropB: boolean, rows: Array<{ propA: string, propB?: number }>) {
    for (const config of configs) {
      const reader = db.createQueryReader(ecsql, undefined, { ...config, rowFormat: QueryRowFormat.UseECSqlPropertyNames });
      const actualRows = await reader.toArray();
      const names = (await reader.getMetaData()).map((p) => p.name);
      expect(names).to.include("PropA");
      expect(names.includes("PropB")).to.equal(withPropB);
      expect(actualRows.map((row) => ({ propA: row.PropA, propB: row.PropB }))).to.deep.equal(rows.map((row) => ({ propA: row.propA, propB: row.propB })));
    }
  }

  async function warm(db: IModelDb) {
    for (const config of configs) {
      await readMetaData(db, ecsql, config);
      await expectMetadataRequested(db, ecsql, false, config);
    }
  }

  it("sees new columns after pulling a schema changeset", async () => {
    const accessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const iTwinId = HubMock.iTwinId;
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "QueryMetadataCachePull" });
    const writer = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken });
    const reader = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken });
    try {
      writer.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      await writer.importSchemaStrings([bisSchema("01.00.00", false)]);
      await insertFoo(writer, { propA: "a" });
      await writer.pushChanges({ accessToken, description: "schema v1" });

      await reader.pullChanges({ accessToken });
      await warm(reader);
      await expectFoo(reader, false, [{ propA: "a" }]);

      await writer.importSchemaStrings([bisSchema("01.00.01", true)]);
      await insertFoo(writer, { propA: "b", propB: 42 });
      await writer.pushChanges({ accessToken, description: "schema v2" });

      await reader.pullChanges({ accessToken });
      await expectFoo(reader, true, [{ propA: "a" }, { propA: "b", propB: 42 }]);
    } finally {
      writer.close();
      reader.close();
    }
  });

  it("sees new columns after replaying a schema change made by another connection", async () => {
    const accessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const iTwinId = HubMock.iTwinId;
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "QueryMetadataCacheReplay" });
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });

    const fsWatcher = { callback: () => { }, close: () => { } };
    const watchStub = sinon.stub(fs, "watch").callsFake(((_filename: fs.PathLike, _opts: fs.WatchOptions, fn: () => void) => {
      fsWatcher.callback = fn;
      return fsWatcher;
    }) as any);
    let writer: BriefcaseDb | undefined;
    let reader: BriefcaseDb | undefined;
    try {
      writer = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
      writer.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      reader = await BriefcaseDb.open({ fileName: briefcaseProps.fileName, watchForChanges: true });

      await writer.importSchemaStrings([bisSchema("01.00.00", false)]);
      await insertFoo(writer, { propA: "a" });
      fsWatcher.callback();
      await warm(reader);
      await expectFoo(reader, false, [{ propA: "a" }]);

      await writer.importSchemaStrings([bisSchema("01.00.01", true)]);
      await insertFoo(writer, { propA: "b", propB: 42 });
      fsWatcher.callback();
      await expectFoo(reader, true, [{ propA: "a" }, { propA: "b", propB: 42 }]);
    } finally {
      reader?.close();
      writer?.close();
      watchStub.restore();
    }
  });
});
