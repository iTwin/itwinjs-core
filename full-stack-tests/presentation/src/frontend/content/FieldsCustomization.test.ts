/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Guid } from "@itwin/core-bentley";
import { InstanceKey, KeySet, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { getFieldByLabel } from "../../Utils";
import {
  buildTestIModelConnection,
  importSchema,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { describeContentTestSuite } from "./Utils";

describeContentTestSuite("Fields' customization", () => {
  it("assigns custom renderer and editor to struct member property", async function () {
    let instanceKey: InstanceKey;
    let testSchema!: ReturnType<typeof importSchema>;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      testSchema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECStructClass typeName="MyStruct">
            <ECProperty propertyName="IntProperty" typeName="int" />
          </ECStructClass>
          <ECEntityClass typeName="TestPhysicalObject" displayLabel="Test Physical Object" modifier="Sealed">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECStructProperty propertyName="StructProperty" typeName="MyStruct" />
          </ECEntityClass>
          `,
      );
      const modelKey = insertPhysicalModelWithPartition({ db, codeValue: "test model" });
      const categoryKey = insertSpatialCategory({ db, codeValue: "test category" });
      instanceKey = insertPhysicalElement({
        db,
        classFullName: testSchema.items.TestPhysicalObject.fullName,
        modelId: modelKey.id,
        categoryId: categoryKey.id,
        structProperty: {
          intProperty: 123,
        },
      });
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "SelectedNodeInstances",
            },
          ],
        },
        {
          ruleType: "ContentModifier",
          class: { schemaName: testSchema.schemaName, className: testSchema.items.MyStruct.fullName },
          propertyOverrides: [
            {
              name: "IntProperty",
              renderer: {
                rendererName: "test-renderer",
              },
              editor: {
                editorName: "test-editor",
              },
            },
          ],
        },
      ],
    };

    const descriptor = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      })
      .then(async (x) => x!.descriptor);
    const structMemberField = getFieldByLabel(descriptor.fields, "IntProperty");
    expect(structMemberField.renderer).to.deep.eq({ name: "test-renderer" });
    expect(structMemberField.editor).to.deep.eq({ name: "test-editor" });
  });

  it("assigns custom renderer and editor to array item property", async function () {
    let instanceKey: InstanceKey;
    let testSchema!: ReturnType<typeof importSchema>;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      testSchema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECEntityClass typeName="TestPhysicalObject" displayLabel="Test Physical Object" modifier="Sealed">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECArrayProperty propertyName="IntProperty" typeName="int" />
          </ECEntityClass>
          `,
      );
      const modelKey = insertPhysicalModelWithPartition({ db, codeValue: "test model" });
      const categoryKey = insertSpatialCategory({ db, codeValue: "test category" });
      instanceKey = insertPhysicalElement({
        db,
        classFullName: testSchema.items.TestPhysicalObject.fullName,
        modelId: modelKey.id,
        categoryId: categoryKey.id,
        intProperty: [123, 456],
      });
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "SelectedNodeInstances",
            },
          ],
        },
        {
          ruleType: "ContentModifier",
          class: { schemaName: testSchema.schemaName, className: testSchema.items.TestPhysicalObject.fullName },
          propertyOverrides: [
            {
              name: "IntProperty[*]",
              renderer: {
                rendererName: "test-renderer",
              },
              editor: {
                editorName: "test-editor",
              },
            },
          ],
        },
      ],
    };

    const descriptor = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      })
      .then(async (x) => x!.descriptor);
    const arrayField = getFieldByLabel(descriptor.fields, "IntProperty");
    assert(arrayField.isPropertiesField() && arrayField.isArrayPropertiesField());
    const arrayItemField = arrayField.itemsField;
    expect(arrayItemField.renderer).to.deep.eq({ name: "test-renderer" });
    expect(arrayItemField.editor).to.deep.eq({ name: "test-editor" });
  });

  it("assigns custom renderer and editor to struct-array member property", async function () {
    let instanceKey: InstanceKey;
    let testSchema!: ReturnType<typeof importSchema>;
    const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
      testSchema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECStructClass typeName="MyStruct">
            <ECProperty propertyName="IntProperty" typeName="int" />
          </ECStructClass>
          <ECEntityClass typeName="TestPhysicalObject" displayLabel="Test Physical Object" modifier="Sealed">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECStructArrayProperty propertyName="StructArrayProperty" typeName="MyStruct" />
          </ECEntityClass>
          `,
      );
      const modelKey = insertPhysicalModelWithPartition({ db, codeValue: "test model" });
      const categoryKey = insertSpatialCategory({ db, codeValue: "test category" });
      instanceKey = insertPhysicalElement({
        db,
        classFullName: testSchema.items.TestPhysicalObject.fullName,
        modelId: modelKey.id,
        categoryId: categoryKey.id,
        structArrayProperty: [
          {
            intProperty: 123,
          },
          {
            intProperty: 456,
          },
        ],
      });
    });

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: "Content",
          specifications: [
            {
              specType: "SelectedNodeInstances",
            },
          ],
        },
        {
          ruleType: "ContentModifier",
          class: { schemaName: testSchema.schemaName, className: testSchema.items.MyStruct.fullName },
          propertyOverrides: [
            {
              name: "IntProperty",
              renderer: {
                rendererName: "test-renderer",
              },
              editor: {
                editorName: "test-editor",
              },
            },
          ],
        },
      ],
    };

    const descriptor = await Presentation.presentation
      .getContentIterator({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      })
      .then(async (x) => x!.descriptor);
    const arrayField = getFieldByLabel(descriptor.fields, "StructArrayProperty");
    assert(arrayField.isPropertiesField() && arrayField.isArrayPropertiesField());
    const structField = arrayField.itemsField;
    assert(structField.isPropertiesField() && structField.isStructPropertiesField());
    const structMemberField = getFieldByLabel(structField.memberFields, "IntProperty");
    expect(structMemberField.renderer).to.deep.eq({ name: "test-renderer" });
    expect(structMemberField.editor).to.deep.eq({ name: "test-editor" });
  });
});
