/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EntityClass, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { StandaloneDb } from "../../IModelDb";
import { IModelIncrementalSchemaLocater } from "../../IModelIncrementalSchemaLocater";
import { IModelTestUtils } from "../IModelTestUtils";

// Class names such as __proto__ and constructor are valid ECNames but also members of Object.prototype.
describe("Incremental schema loading of names that are members of Object.prototype", () => {
  const objectPrototypeMembers = Object.getOwnPropertyNames(Object.prototype);
  let iModel: StandaloneDb;

  before(async () => {
    const fileName = IModelTestUtils.prepareOutputFile("IncrementalSchemaLocater", "ObjectPrototypeNames.bim");
    iModel = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "ObjectPrototypeNames" } });
    await iModel.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="PrototypeNames" alias="pn" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="__proto__"><BaseClass>bis:PhysicalElement</BaseClass></ECEntityClass>
        <ECEntityClass typeName="constructor"><BaseClass>__proto__</BaseClass></ECEntityClass>
        <ECStructClass typeName="toString"/>
      </ECSchema>`]);
  });

  after(() => iModel.close());

  afterEach(() => {
    expect(Object.getOwnPropertyNames(Object.prototype)).to.deep.equal(objectPrototypeMembers);
  });

  for (const useMultipleQueries of [true, false]) {
    it(`loads all classes with useMultipleQueries: ${useMultipleQueries}`, async () => {
      const context = new SchemaContext();
      context.addLocater(new IModelIncrementalSchemaLocater(iModel, { useMultipleQueries }));

      const schema = await context.getSchema(new SchemaKey("PrototypeNames", 1, 0, 0));
      expect(schema).to.not.be.undefined;
      expect([...schema!.getItems()].map((item) => item.name).sort()).to.deep.equal(["__proto__", "constructor", "toString"]);

      await schema!.loadingController?.wait();
      const derived = await schema!.getItem("constructor", EntityClass);
      expect(derived?.baseClass?.name).to.equal("__proto__");
      expect(Object.keys(schema!.toJSON().items!).sort()).to.deep.equal(["__proto__", "constructor", "toString"]);
    });
  }
});
