
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECSchemaNamespaceUris, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { RpcIncrementalSchemaLocater } from "../RpcIncrementalSchemaLocater";
import { DbQueryResponse, DbResponseKind, DbResponseStatus, IModelReadRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "../ECSchemaRpcInterface";
import { expect } from "chai";
import * as sinon from "sinon";

// RpcIncrementalSchemaLocater derives from IncrementalSchemaLocater and ECSqlSchemaLocater, so
// the basic functionality is already tested in their tests. This test suite verifies the expected
// behaviour of the RPC specific implementation.
describe("RpcIncrementalSchemaLocater Tests", () => {

  let imodelReadInterface: IModelReadRpcInterface;
  let ecschemaRpcInterface: ECSchemaRpcInterface;

  const schemaInfoColumns = ["name", "version", "references", "alias"];

  beforeEach(() => {
    sinon.stub(IModelReadRpcInterface, "getClient").returns(imodelReadInterface = {
      queryRows: async () => { throw new Error("Method must be implemented in the tests."); },
    } as any);
    sinon.stub(ECSchemaRpcInterface, "getClient").returns(ecschemaRpcInterface = {
      getSchemaJSON: async () => { throw new Error("Method must be implemented in the tests."); },
    } as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("get schema info, schema found", async () => {
    const schemaKey = SchemaKey.parseString("TestSchema.1.0.0");
    sinon.stub(imodelReadInterface, "queryRows").returns(toQueryResult(schemaInfoColumns, [
      { name: schemaKey.name, version: schemaKey.version.toString(), references: "[]", alias: "ts" }
    ]));

    const locater = new RpcIncrementalSchemaLocater({ key: "rpc-test-imodel" });
    const schemaInfo = await locater.getSchemaInfo(schemaKey, SchemaMatchType.Latest, new SchemaContext());

    expect(schemaInfo).is.not.undefined;
    expect(schemaInfo).has.property("schemaKey").that.satisfies((key: SchemaKey) => key.matches(schemaKey));
    expect(schemaInfo).has.property("alias").that.equals("ts");
    expect(schemaInfo).has.property("references").that.is.empty;
  });

  it("get schema info, schema not found, return undefined", async () => {
    sinon.stub(imodelReadInterface, "queryRows").returns(toQueryResult(schemaInfoColumns, []));

    const schemaKey = SchemaKey.parseString("TestSchema.1.0.0");
    const locater = new RpcIncrementalSchemaLocater({ key: "rpc-test-imodel" });
    const schemaInfo = await locater.getSchemaInfo(schemaKey, SchemaMatchType.Latest, new SchemaContext());

    expect(schemaInfo).to.be.undefined;
  });

  it("get schema, incrementally", async () => {
    const context = new SchemaContext();
    const locater = new RpcIncrementalSchemaLocater({ key: "rpc-test-imodel" });
    context.addLocater(locater);

    const schemaKey = SchemaKey.parseString("TestSchema.1.0.0");
    sinon.stub(imodelReadInterface, "queryRows")
      .onCall(0).returns(toQueryResult(schemaInfoColumns, [
        { name: schemaKey.name, version: schemaKey.version.toString(), references: "[]", alias: "ts" },
        { name: "ECDbMeta", version: "4.0.3", references: "[]", alias: "ecdb" },
      ]))
      .onCall(1).returns(toQueryResult(["name", "version", "alias", "references", "items"], [
        {
          name: schemaKey.name,
          version: schemaKey.version.toString(),
          alias: "ts",
          references: "[]",
          items: "[]",
        }
      ]))
      .returns(toQueryResult(["schema", "items"], [
        {
          schema: `{
            "name": "${schemaKey.name}",
            "version": "${schemaKey.version.toString()}",
            "alias": "ts",
            "label": "Test Schema",
            "description": "This is a test schema."
          }`,
        }
      ]));

    const schema = await context.getSchema(schemaKey, SchemaMatchType.Latest);

    expect(schema).is.not.undefined;
    expect(schema).has.property("schemaKey").that.satisfies((key: SchemaKey) => key.matches(schemaKey));
    expect(schema).has.property("alias").that.equals("ts");

    expect(schema).has.property("loadingController").that.is.not.undefined;
    expect(schema).has.a.nested.property("loadingController.inProgress").that.is.true;
    await schema!.loadingController?.wait();

    expect(schema).has.property("label", "Test Schema");
    expect(schema).has.property("description", "This is a test schema.");
  });

  it("get schema, unsupported metaschema", async () => {
    const schemaKey = SchemaKey.parseString("TestSchema.1.0.0");
    sinon.stub(imodelReadInterface, "queryRows").returns(toQueryResult(schemaInfoColumns, [
      { name: schemaKey.name, version: schemaKey.version.toString(), references: "[]", alias: "ts" },
      { name: "ECDbMeta", version: "4.0.1", references: "[]", alias: "ecdb" },
    ]));

    sinon.stub(ecschemaRpcInterface, "getSchemaJSON").returns(Promise.resolve({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "ts"
    }));

    const locater = new RpcIncrementalSchemaLocater({ key: "rpc-test-imodel" });
    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Latest, new SchemaContext());

    expect(schema).is.not.undefined;
    expect(schema).has.property("schemaKey").that.satisfies((key: SchemaKey) => key.matches(schemaKey));
    expect(schema).has.property("alias").that.equals("ts");
  });

  it("get schema, schema not found, return undefined", async () => {
    const schemaKey = SchemaKey.parseString("TestSchema.1.0.0");
    sinon.stub(imodelReadInterface, "queryRows").returns(toQueryResult(schemaInfoColumns, []));

    const locater = new RpcIncrementalSchemaLocater({ key: "rpc-test-imodel" });
    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Latest, new SchemaContext());

    expect(schema).is.undefined;
  });
});

/**
 * This is a very simple helper function to translate a set of rows into a DbQueryResponse.
 * It does not handle different row formats or property order.
 */
async function toQueryResult(columns: Array<string>, rows: Array<{ [column: string]: any }>): Promise<DbQueryResponse> {
  return {
    kind: DbResponseKind.ECSql,
    status: DbResponseStatus.Done,
    stats: {} as any,
    rowCount: rows.length,
    meta: columns.map((column, i) => ({ name: column, jsonName: column, index: i } as any)),
    data: rows.map(row => columns.map(k => row[k])),
  };
}