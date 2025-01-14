/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Guid, using } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { Content, ContentSpecificationTypes, DefaultContentDisplayTypes, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationManager } from "@itwin/presentation-frontend";
import {
  buildTestIModelConnection,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { collect, getFieldByLabel } from "../../Utils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Primitive properties", () => {
  it("sets constraints for numeric type properties", async function () {
    let elementKey!: InstanceKey;
    const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
      const schema = importSchema(
        this,
        db,
        `
            <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
            <ECEntityClass typeName="X">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="Prop1" typeName="int" />
              <ECProperty propertyName="Prop2" typeName="int" minimumValue="0" maximumValue="2" />
              <ECProperty propertyName="Prop3" typeName="int" minimumValue="0" />
              <ECProperty propertyName="Prop4" typeName="int" maximumValue="2" />
            </ECEntityClass>
          `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      elementKey = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
        ["Prop1"]: 2,
        ["Prop2"]: 2,
        ["Prop3"]: 2,
        ["Prop4"]: 2,
      });
    });

    const content = await getContent(imodel, elementKey);
    const field1 = getFieldByLabel(content.descriptor.fields, "Prop1");
    const field2 = getFieldByLabel(content.descriptor.fields, "Prop2");
    const field3 = getFieldByLabel(content.descriptor.fields, "Prop3");
    const field4 = getFieldByLabel(content.descriptor.fields, "Prop4");

    expect(field1.isPropertiesField()).to.be.true;
    expect(field2.isPropertiesField()).to.be.true;
    expect(field3.isPropertiesField()).to.be.true;
    expect(field4.isPropertiesField()).to.be.true;

    assert(field1.isPropertiesField());
    assert(field2.isPropertiesField());
    assert(field3.isPropertiesField());
    assert(field4.isPropertiesField());

    expect(field1.properties.length).to.eq(1);
    expect(field2.properties.length).to.eq(1);
    expect(field3.properties.length).to.eq(1);
    expect(field4.properties.length).to.eq(1);

    expect(field1.properties[0].property.constraints).to.be.undefined;
    expect(field2.properties[0].property.constraints).to.deep.eq({ minimumValue: 0, maximumValue: 2 });
    expect(field3.properties[0].property.constraints).to.deep.eq({ minimumValue: 0 });
    expect(field4.properties[0].property.constraints).to.deep.eq({ maximumValue: 2 });
  });

  it("creates constraints for string type properties", async function () {
    let elementKey!: InstanceKey;
    const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
      const schema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECEntityClass typeName="X">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECProperty propertyName="Prop1" typeName="string" />
            <ECProperty propertyName="Prop2" typeName="string" minimumLength="1" maximumLength="5" />
            <ECProperty propertyName="Prop3" typeName="string" minimumLength="1" />
            <ECProperty propertyName="Prop4" typeName="string" maximumLength="5" />
          </ECEntityClass>
        `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      elementKey = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
        ["Prop1"]: "test1",
        ["Prop2"]: "test2",
        ["Prop3"]: "test3",
        ["Prop4"]: "test4",
      });
    });

    const content = await getContent(imodel, elementKey);
    const field1 = getFieldByLabel(content.descriptor.fields, "Prop1");
    const field2 = getFieldByLabel(content.descriptor.fields, "Prop2");
    const field3 = getFieldByLabel(content.descriptor.fields, "Prop3");
    const field4 = getFieldByLabel(content.descriptor.fields, "Prop4");

    expect(field1.isPropertiesField()).to.be.true;
    expect(field2.isPropertiesField()).to.be.true;
    expect(field3.isPropertiesField()).to.be.true;
    expect(field4.isPropertiesField()).to.be.true;

    assert(field1.isPropertiesField());
    assert(field2.isPropertiesField());
    assert(field3.isPropertiesField());
    assert(field4.isPropertiesField());

    expect(field1.properties.length).to.eq(1);
    expect(field2.properties.length).to.eq(1);
    expect(field3.properties.length).to.eq(1);
    expect(field4.properties.length).to.eq(1);

    expect(field1.properties[0].property.constraints).to.be.undefined;
    expect(field2.properties[0].property.constraints).to.deep.eq({ minimumLength: 1, maximumLength: 5 });
    expect(field3.properties[0].property.constraints).to.deep.eq({ minimumLength: 1 });
    expect(field4.properties[0].property.constraints).to.deep.eq({ maximumLength: 5 });
  });

  it("creates constraints for array type properties", async function () {
    let elementKey!: InstanceKey;
    const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
      const schema = importSchema(
        this,
        db,
        `
        <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
        <ECEntityClass typeName="X">
          <BaseClass>bis:PhysicalElement</BaseClass>
          <ECArrayProperty propertyName="Prop1" typeName="string" />
          <ECArrayProperty propertyName="Prop2" typeName="string" minOccurs="1" maxOccurs="unbounded"  />
          <ECArrayProperty propertyName="Prop3" typeName="string" minOccurs="1" />
          <ECArrayProperty propertyName="Prop4" typeName="string" maxOccurs="5"  />
        </ECEntityClass>
      `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      elementKey = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
        ["Prop1"]: ["test1"],
        ["Prop2"]: ["test2"],
        ["Prop3"]: ["test3"],
        ["Prop4"]: ["test4"],
      });
    });

    const content = await getContent(imodel, elementKey);
    const field1 = getFieldByLabel(content.descriptor.fields, "Prop1");
    const field2 = getFieldByLabel(content.descriptor.fields, "Prop2");
    const field3 = getFieldByLabel(content.descriptor.fields, "Prop3");
    const field4 = getFieldByLabel(content.descriptor.fields, "Prop4");

    expect(field1.isPropertiesField()).to.be.true;
    expect(field2.isPropertiesField()).to.be.true;
    expect(field3.isPropertiesField()).to.be.true;
    expect(field4.isPropertiesField()).to.be.true;

    assert(field1.isPropertiesField());
    assert(field2.isPropertiesField());
    assert(field3.isPropertiesField());
    assert(field4.isPropertiesField());

    expect(field1.properties.length).to.eq(1);
    expect(field2.properties.length).to.eq(1);
    expect(field3.properties.length).to.eq(1);
    expect(field4.properties.length).to.eq(1);

    // ECArrayProperty doesn't have a way to determine if minOccurs and maxOccurs are defined. By default:
    // - minOccurs is set to 0;
    // - maxOccurs is set to 2147483647 (2^31 - 1).
    // If maxOccurs is set to "unbounded" then maxOccurs is set to 2147483647.
    expect(field1.properties[0].property.constraints).to.deep.eq({ minOccurs: 0, maxOccurs: 2147483647 });
    expect(field2.properties[0].property.constraints).to.deep.eq({ minOccurs: 1, maxOccurs: 2147483647 });
    expect(field3.properties[0].property.constraints).to.deep.eq({ minOccurs: 1, maxOccurs: 2147483647 });
    expect(field4.properties[0].property.constraints).to.deep.eq({ minOccurs: 0, maxOccurs: 5 });
  });
});

async function getContent(imodel: IModelConnection, key: InstanceKey): Promise<Content> {
  const keys = new KeySet([key]);
  const ruleset: Ruleset = {
    id: Guid.createValue(),
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      },
    ],
  };

  return using(PresentationManager.create(), async (manager) => {
    const descriptor = await manager.getContentDescriptor({
      imodel,
      rulesetOrId: ruleset,
      keys,
      displayType: DefaultContentDisplayTypes.Grid,
    });
    expect(descriptor).to.not.be.undefined;
    const content = await manager
      .getContentIterator({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor! })
      .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
    expect(content).to.not.be.undefined;
    return content!;
  });
}
