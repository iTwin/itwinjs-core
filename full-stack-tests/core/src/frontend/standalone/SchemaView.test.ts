/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, ECSqlReader, IModelReadRpcInterface } from "@itwin/core-common";
import {
  SchemaManifest, SchemaManifestReferenceRow, SchemaManifestSchemaRow, SchemaViewBlob, SchemaViewDataProvider, schemaViewFormatVersion, SchemaViewManager,
} from "@itwin/ecschema-metadata";
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("SchemaViewManager RPC loading", () => {
  let connection: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, true);
    connection = await TestSnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    await connection?.close();
    await TestUtility.shutdownFrontend();
  });

  it("loads and accumulates schema fragments through queryRows RPC", async () => {
    const rpcClient = IModelReadRpcInterface.getClientForRouting(connection.routingContext.token);
    const rpcProps = connection.getRpcProps();
    const queries: string[] = [];
    const executor: DbRequestExecutor<DbQueryRequest, DbQueryResponse> = {
      execute: async (request) => {
        queries.push(request.query);
        return rpcClient.queryRows(rpcProps, request);
      },
    };

    function createQueryReader(ecsql: string): ECSqlReader {
      return new ECSqlReader(executor, ecsql);
    }

    async function fetchBlob(pragma: string): Promise<SchemaViewBlob> {
      // ConcurrentQuery does not paginate PRAGMAs; read the single row without requesting another page.
      const result = await createQueryReader(pragma).next();
      if (result.done)
        throw new Error(`${pragma} returned no rows`);
      const data = result.value.data;
      const schemaToken = result.value.schemaToken;
      assert.instanceOf(data, Uint8Array);
      assert.isString(schemaToken);
      assert.isNotEmpty(schemaToken);
      return { data: data as Uint8Array, schemaToken: schemaToken as string };
    }

    async function fetchManifest(): Promise<SchemaManifest> {
      const schemaRows: SchemaManifestSchemaRow[] = [];
      for await (const row of createQueryReader("SELECT ECInstanceId, Name, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef")) {
        schemaRows.push({
          ecInstanceId: Id64.getLocalId(row[0]),
          name: row[1],
          versionMajor: row[2],
          versionWrite: row[3],
          versionMinor: row[4],
        });
      }

      const referenceRows: SchemaManifestReferenceRow[] = [];
      for await (const row of createQueryReader("SELECT SourceECInstanceId, TargetECInstanceId FROM meta.SchemaHasSchemaReferences")) {
        referenceRows.push({
          sourceECInstanceId: Id64.getLocalId(row[0]),
          targetECInstanceId: Id64.getLocalId(row[1]),
        });
      }
      return SchemaManifest.fromRows(schemaRows, referenceRows);
    }

    async function fetchSchemaToken(): Promise<string> {
      const result = await createQueryReader("PRAGMA checksum(schema_token)").next();
      if (result.done)
        throw new Error("PRAGMA checksum(schema_token) returned no rows");
      const schemaToken = result.value.sha3_256;
      assert.isString(schemaToken);
      assert.isNotEmpty(schemaToken);
      return schemaToken as string;
    }

    const dataProvider: SchemaViewDataProvider = {
      fetchFullBlob: async () => fetchBlob(`PRAGMA schema_view(${schemaViewFormatVersion})`),
      fetchFragmentBlob: async (schemaNames) => fetchBlob(`PRAGMA schema_view_fragment('v${schemaViewFormatVersion};${schemaNames.join(",")}')`),
      fetchManifest,
      fetchSchemaToken,
    };
    const manager = new SchemaViewManager(dataProvider);

    const bisCoreView = await manager.getSchemaView({ schemas: ["BisCore"] });
    const bisCoreElement = bisCoreView.findClass("BisCore:Element");
    assert.exists(bisCoreElement);
    assert.isUndefined(bisCoreView.getSchema("Generic"));

    const queryCountAfterInitialLoad = queries.length;
    const repeatedBisCoreView = await manager.getSchemaView({ schemas: ["BisCore"] });
    assert.strictEqual(repeatedBisCoreView, bisCoreView);
    assert.strictEqual(queries.length, queryCountAfterInitialLoad);

    const queryCountBeforeGeneric = queries.length;
    const genericView = await manager.getSchemaView({ schemas: ["Generic"] });
    assert.strictEqual(genericView, bisCoreView);
    assert.exists(genericView.getSchema("BisCore"));
    const physicalObject = genericView.findClass("Generic:PhysicalObject");
    assert.exists(physicalObject);
    assert.isTrue(physicalObject!.is("BisCore:PhysicalElement"));
    assert.isTrue(physicalObject!.is(bisCoreElement!));

    const genericQueries = queries.slice(queryCountBeforeGeneric);
    assert.lengthOf(genericQueries, 1);
    assert.include(genericQueries[0], `PRAGMA schema_view_fragment('v${schemaViewFormatVersion};`);
    assert.notInclude(genericQueries[0].toLowerCase(), "biscore");
    assert.isEmpty(queries.filter((query) => /^pragma schema_view(?:\(|$)/i.test(query.trim())));
  });
});
