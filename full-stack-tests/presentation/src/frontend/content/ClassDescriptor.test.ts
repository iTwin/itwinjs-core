/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { ContentSpecificationTypes, DefaultContentDisplayTypes, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { describeContentTestSuite, filterFieldsByClass, filterFieldsByClassIntersection, getFieldLabels } from "./Utils.js";
import { getFieldByLabel } from "../../Utils.js";
import {
  buildTestIModelConnection,
  importSchema,
  insertElementAspect,
  insertExternalSource,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertRepositoryLink,
  insertSpatialCategory,
} from "../../IModelSetupUtils.js";

describeContentTestSuite("Class descriptor", ({ getDefaultSuiteIModel }) => {
  const createRuleset = (schemaName: string, className: string): Ruleset => ({
    id: Guid.createValue(),
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [
          {
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName,
              classNames: [className],
              arePolymorphic: true,
            },
            handlePropertiesPolymorphically: true,
          },
        ],
      },
    ],
  });

  it("creates base class descriptor usable for subclasses", async () => {
    const imodel = await getDefaultSuiteIModel();
    const schemaView = await imodel.getSchemaView();

    const descriptorGeometricElement = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("BisCore", "GeometricElement"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    // sanity check - ensure filtering the fields by the class we used for request doesn't filter out anything
    const fieldsGeometricElement = filterFieldsByClass(descriptorGeometricElement!.fields, schemaView.findClass("BisCore.GeometricElement")!);
    expect(getFieldLabels(fieldsGeometricElement)).to.deep.eq(getFieldLabels(descriptorGeometricElement!));

    // request properties of Generic.PhysicalObject and ensure it's matches our filtered result of `descriptorGeometricElement`
    const descriptorPhysicalObject = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("Generic", "PhysicalObject"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    const fieldsPhysicalObject = filterFieldsByClass(descriptorGeometricElement!.fields, schemaView.findClass("Generic.PhysicalObject")!);
    expect(getFieldLabels(fieldsPhysicalObject)).to.deep.eq(getFieldLabels(descriptorPhysicalObject!));

    // request properties of PCJ_TestSchema.TestClass and ensure it's matches our filtered result of `descriptorGeometricElement`
    const descriptorTestClass = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("PCJ_TestSchema", "TestClass"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });
    const fieldsTestClass = filterFieldsByClass(descriptorGeometricElement!.fields, schemaView.findClass("PCJ_TestSchema.TestClass")!);
    expect(getFieldLabels(fieldsTestClass)).to.deep.eq(getFieldLabels(descriptorTestClass!));

    // filter descriptor fields by intersection of PhysicalObject and TestClass
    const fieldsIntersection = filterFieldsByClassIntersection(descriptorGeometricElement!.fields, [
      schemaView.findClass("Generic.PhysicalObject")!,
      schemaView.findClass("PCJ_TestSchema.TestClass")!,
    ]);
    expect(getFieldLabels(fieldsIntersection)).to.deep.eq([
      "Category",
      "Code",
      "Model",
      "User Label",
      ...getFieldLabels([getFieldByLabel(fieldsPhysicalObject, "area"), getFieldByLabel(fieldsPhysicalObject, "Repository Link")]),
    ]);
  });

  it("filters nested related properties from class descriptor based on source class", async function () {
    let schema!: ReturnType<typeof importSchema>;
    const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
      schema = importSchema(
        this,
        db,
        `
          <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
          <ECEntityClass typeName="RepositoryLink1">
            <BaseClass>bis:RepositoryLink</BaseClass>
            <ECProperty propertyName="RepositoryLinkPropertyName1" typeName="string" />
          </ECEntityClass>
          <ECEntityClass typeName="RepositoryLink2">
            <BaseClass>bis:RepositoryLink</BaseClass>
            <ECProperty propertyName="RepositoryLinkPropertyName2" typeName="string" />
          </ECEntityClass>
          <ECEntityClass typeName="X">
            <BaseClass>bis:PhysicalElement</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="Y">
            <BaseClass>bis:PhysicalElement</BaseClass>
          </ECEntityClass>
        `,
      );
      const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
      const category = insertSpatialCategory({ db, codeValue: "category" });
      const elementX1 = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
      });
      insertElementAspect({
        db,
        elementId: elementX1.id,
        classFullName: "BisCore:ExternalSourceAspect",
        kind: "Not a 'Relationship'",
        source: {
          id: insertExternalSource({ db, repositoryLinkId: insertRepositoryLink({ db, classFullName: schema.items.RepositoryLink1.fullName }).id }).id,
          relClassName: `BisCore:ElementIsFromSource`,
        },
      });
      const elementX2 = insertPhysicalElement({
        db,
        classFullName: schema.items.X.fullName,
        modelId: model.id,
        categoryId: category.id,
      });
      insertElementAspect({
        db,
        elementId: elementX2.id,
        classFullName: "BisCore:ExternalSourceAspect",
        kind: "Not a 'Relationship'",
        source: {
          id: insertExternalSource({ db, repositoryLinkId: insertRepositoryLink({ db, classFullName: schema.items.RepositoryLink2.fullName }).id }).id,
          relClassName: `BisCore:ElementIsFromSource`,
        },
      });
      const elementY = insertPhysicalElement({
        db,
        classFullName: schema.items.Y.fullName,
        modelId: model.id,
        categoryId: category.id,
      });
      insertElementAspect({
        db,
        elementId: elementY.id,
        classFullName: "BisCore:ExternalSourceAspect",
        kind: "Not a 'Relationship'",
        source: {
          id: insertExternalSource({ db, repositoryLinkId: insertRepositoryLink({ db, classFullName: schema.items.RepositoryLink2.fullName }).id }).id,
          relClassName: `BisCore:ElementIsFromSource`,
        },
      });
    });
    const schemaView = await imodel.getSchemaView();

    const descriptorGeometricElement = await Presentation.presentation.getContentDescriptor({
      imodel,
      rulesetOrId: createRuleset("BisCore", "GeometricElement"),
      displayType: DefaultContentDisplayTypes.PropertyPane,
      keys: new KeySet(),
    });

    // filter descriptor fields by intersection of X and Y classes
    const fieldsIntersection = filterFieldsByClassIntersection(descriptorGeometricElement!.fields, [
      schemaView.findClass(schema.items.X.fullName)!,
      schemaView.findClass(schema.items.Y.fullName)!,
    ]);
    // class X is related to both - RepositoryLink1 and RepositoryLink2, while class Y is related only to RepositoryLink2, so
    // we should see all properties of RepositoryLink2 and no properties of RepositoryLink1
    expect(getFieldLabels(fieldsIntersection)).to.deep.eq([
      "Category",
      "Code",
      "Model",
      "Physical Material",
      "User Label",
      {
        label: "External Source Aspect",
        nested: [
          "Source Element ID",
          {
            label: "RepositoryLink2",
            nested: ["Code", "Description", "Format", "Name", "Path", "RepositoryLinkPropertyName2"],
          },
        ],
      },
    ]);
  });
});
