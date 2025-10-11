/* eslint-disable @typescript-eslint/naming-convention */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { SchemaProps } from "../../Deserialization/JsonProps";
import { SchemaInfo } from "../../Interfaces";
import { SchemaKey } from "../../SchemaKey";
import { SchemaContext } from "../../Context";
import { enableIncrementalSchemaLoading, IncrementalSchemaLocater } from "../../IncrementalLoading/IncrementalSchemaLocater";
import { SchemaMatchType } from "../../ECObjects";
import { ECSchemaNamespaceUris } from "../../Constants";
import { Schema } from "../../Metadata/Schema";

class TestSchemaLocater extends IncrementalSchemaLocater {
  public async loadSchemaInfos(_context: SchemaContext): Promise<Iterable<SchemaInfo>> {
    throw new Error("Implementation will be provided by the test.");
  }
  public override async loadSchema(schemaInfo: SchemaInfo, context: SchemaContext): Promise<Schema> {
    return super.loadSchema(schemaInfo, context);
  }
  public async getSchemaPartials(_schemaKey: SchemaKey): Promise<[SchemaProps, ...SchemaProps[]] | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
  public async getSchemaJson(_schemaKey: SchemaKey, _context: SchemaContext): Promise<SchemaProps | undefined> {
    throw new Error("Implementation will be provided by the test.");
  }
  public async supportPartialSchemaLoading(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe("IncrementalSchemaLocater Tests", () => {
  let context: SchemaContext;
  let locater: TestSchemaLocater;

  before(() => {
    enableIncrementalSchemaLoading(true);
  });

  after(() => {
    enableIncrementalSchemaLoading(false);
  });

  beforeEach(() => {
    sinon.restore();
    locater = new TestSchemaLocater();
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("get schema info, same context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = sinon.stub(locater, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, context);
    expect(schemaInfoA).to.not.be.undefined;
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, context);
    expect(schemaInfoB).to.not.be.undefined;

    expect(spy.callCount).to.be.equal(1);
  });

  it("get schema info, different context", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = sinon.stub(locater, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);

    const schemaInfoA = await locater.getSchemaInfo(schemaKeyA, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoA).to.not.be.undefined;
    const schemaInfoB = await locater.getSchemaInfo(schemaKeyB, SchemaMatchType.Exact, new SchemaContext());
    expect(schemaInfoB).to.not.be.undefined;

    expect(spy.callCount).to.be.equal(2);
  });

  it("locate valid schema with multiple references", async () => {
    const schemaKeyA = new SchemaKey("SchemaA", 1, 1, 1);
    const schemaKeyB = new SchemaKey("SchemaB", 1, 1, 1);
    const schemaKeyC = new SchemaKey("SchemaC", 1, 1, 1);
    const spy = sinon.stub(locater, "loadSchemaInfos").resolves([
      { schemaKey: schemaKeyA, references: [{ schemaKey: schemaKeyB }, { schemaKey: schemaKeyC }], alias: "SchemaA" },
      { schemaKey: schemaKeyB, references: [], alias: "SchemaB" },
      { schemaKey: schemaKeyC, references: [{ schemaKey: schemaKeyB }], alias: "SchemaC" },
    ]);
    sinon.stub(locater, "getSchemaPartials").resolves([
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyA.name,
        version: schemaKeyA.version.toString(),
        alias: "SchemaA",
        description: "Test description",
        references: [
          { name: schemaKeyB.name, version: schemaKeyB.version.toString() },
          { name: schemaKeyC.name, version: schemaKeyC.version.toString() }
        ]
      },
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyB.name,
        version: schemaKeyB.version.toString(),
        alias: "SchemaB",
        references: []
      },
      {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: schemaKeyC.name,
        version: schemaKeyC.version.toString(),
        alias: "SchemaC",
        references: [
          { name: schemaKeyB.name, version: schemaKeyB.version.toString() }
        ]
      },
    ]);

    const schemaA = await context.getSchema(schemaKeyA, SchemaMatchType.Exact);
    expect(schemaA).to.not.be.undefined;
    expect(schemaA).has.nested.property("description", "Test description");
    expect(schemaA).has.nested.property("schemaKey.name", "SchemaA");
    expect(schemaA).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
    expect(schemaA).has.nested.property("references").satisfies((refs: any) => {
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaB"));
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaC"));
      return true;
    });

    const schemaC = await context.getSchema(schemaKeyC, SchemaMatchType.Exact);
    expect(schemaC).to.not.be.undefined;
    expect(schemaC).has.nested.property("schemaKey.name", "SchemaC");
    expect(schemaC).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
    expect(schemaC).has.nested.property("references").satisfies((refs: any) => {
      expect(refs).satisfies((refs2: any) => refs2.some((ref: any) => Schema.isSchema(ref) && ref.schemaKey.name === "SchemaB"));
      return true;
    });

    expect(spy.callCount).to.be.equal(1, "loadSchemaInfos should be called only once.");
  });

  it("getSchema called multiple times for same schema", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaD" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaD"
    }]);

    // locater should not cache the schema.
    const spy = sinon.spy(locater, "loadSchema");
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);

    expect(spy.callCount).to.be.equal(2);
  });

  it("getSchema, wait till resolved, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    sinon.stub(locater, "getSchemaJson").resolves({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        "Category": {
          schemaItemType: "EntityClass",
          name: "Category",
          label: "This is Category",
        }
      }
    });

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");

    await schema!.loadingController!.wait();

    expect(schema).to.not.be.undefined;
    expect(schema).to.be.equal(schema);
    await expect(schema!.getEntityClass("Category")).to.be.eventually.not.undefined;
  });

  it("getSchema, wait till resolved, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);
    sinon.stub(locater, "getSchemaJson").resolves({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "SchemaA",
      version: "01.01.01",
      alias: "SchemaA",
      items: {
        "Category": {
          schemaItemType: "EntityClass",
          name: "Category",
          baseClass: "SchemaA.BadBaseClass",
        }
      }
    } as any);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");

    await expect(schema!.loadingController!.wait()).to.be.rejectedWith("Unable to locate SchemaItem SchemaA.BadBaseClass.");
  });

  it("getSchema synchronously, returns undefined", () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    expect(context.getSchemaSync(schemaKey), "Incremental Schema loading does not support synchronous loading.").is.undefined;
  });

  it("getSchema which does not exist, returns undefined", async () => {
    sinon.stub(locater, "loadSchemaInfos").resolves([]);

    const schemaKey = new SchemaKey("DoesNotExist");
    const result = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    assert.isUndefined(result);
  });

  it("getSchema, full version, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaD" }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaD", 1, 1, 2), SchemaMatchType.Exact, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, latest, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 2, 0, 2);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(schemaKey, SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).to.not.be.undefined;
    expect(schema).has.nested.property("schemaKey.name", "SchemaA");
    expect(schema).has.nested.property("schemaKey.version").satisfies((v: any) => v.toString() === "01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaA" }]);
    sinon.stub(locater, "getSchemaPartials").resolves([{
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaA"
    }]);

    const schema = await locater.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible, context);
    expect(schema).to.be.undefined;
  });

  it("getSchema, partial schema loading is not supported, fallback to full schema load.", async () => {
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);
    sinon.stub(locater, "loadSchemaInfos").resolves([{ schemaKey, references: [], alias: "SchemaD" }]);
    sinon.stub(locater, "supportPartialSchemaLoading").resolves(false);
    const getJsonSpy = sinon.stub(locater, "getSchemaJson").resolves({
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: schemaKey.name,
      version: schemaKey.version.toString(),
      alias: "SchemaD"
    });

    // locater should not cache the schema.
    const getPartialSpy = sinon.spy(locater, "getSchemaPartials");
    await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);

    expect(getPartialSpy.callCount).to.be.equal(0, "getSchemaPartials should not be called.");
    expect(getJsonSpy.callCount).to.be.equal(1, "getSchemaJson should be called once.");
  });

  it("getSchemaInfo, incremental schema loading is disabled, returns undefined", async () => {
    try {
      enableIncrementalSchemaLoading(false);
      const schemaKey = new SchemaKey("SchemaA", 1, 0, 0);
      const spy = sinon.stub(locater, "loadSchemaInfos").resolves([
        { schemaKey, references: [], alias: "SchemaA" },
      ]);
      const schemaInfo = await locater.getSchemaInfo(schemaKey, SchemaMatchType.Exact, context);
      expect(schemaInfo).to.be.undefined;
      expect(spy.callCount).to.be.equal(0);
    }
    finally {
      enableIncrementalSchemaLoading(true);
    }
  });

  it("getSchema, incremental schema loading is disabled, returns undefined", async () => {
    try {
      enableIncrementalSchemaLoading(false);
      const schemaKey = new SchemaKey("SchemaD", 1, 0, 0);
      const spy = sinon.stub(locater, "loadSchemaInfos").resolves([
        { schemaKey, references: [], alias: "SchemaA" },
      ]);
      const schema = await locater.getSchema(schemaKey, SchemaMatchType.Exact, context);
      expect(schema).to.be.undefined;
      expect(spy.callCount).to.be.equal(0);
    }
    finally {
      enableIncrementalSchemaLoading(true);
    }
  });
});
