/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECSchemaToTs } from "../ecschema2ts";
import { assert } from "chai";
import * as utils from "./utilities/utils";
import { SchemaContext } from "@bentley/ecschema-metadata";
import { SchemaXmlFileLocater } from "@bentley/ecschema-locaters";

describe("BisCore Cache test", () => {
  it("For ECEntity class with BaseClass in BisCore, find the correct BisCore props interface to extend", () => {
    const schemaXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="MyDomain" alias="mydomain" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>

        <ECEntityClass typeName="Building" modifier="Sealed">
          <BaseClass>bis:SpatialLocationElement</BaseClass>
          <BaseClass>bis:IParentElement</BaseClass>
        </ECEntityClass>
      </ECSchema>`;

    const expectedSchemaString =
`import { ClassRegistry, Schema, Schemas } from "@bentley/imodeljs-backend";
import * as elementsModule from "./MyDomainElements";

export class MyDomain extends Schema {
  public static get schemaName(): string { return "MyDomain"; }

  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(MyDomain.name))
      Schemas.registerSchema(MyDomain);
  }

  protected constructor() {
    super();
    ClassRegistry.registerModule(elementsModule, MyDomain);
  }
}\n\n`;

    const expectedElementString =
`import { SpatialLocationElement, IModelDb } from "@bentley/imodeljs-backend";
import { GeometricElement3dProps } from "@bentley/imodeljs-common";

export class Building extends SpatialLocationElement {
  public static get className(): string { return "Building"; }

  public constructor (props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}\n\n`;

    const schemaLocator = new SchemaXmlFileLocater();
    schemaLocator.addSchemaSearchPath(utils.getAssetsDir() + "schema3.2");
    const context = new SchemaContext();
    context.addLocater(schemaLocator);

    const schema = utils.deserializeXml(context, schemaXml);
    const ecschema2ts = new ECSchemaToTs();
    const { schemaTsString, elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);
    assert.equal(schemaTsString, expectedSchemaString);
    assert.equal(propsTsString, `\n`);
    assert.equal(elemTsString, expectedElementString);
  });
});
