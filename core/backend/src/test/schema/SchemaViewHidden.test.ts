/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, SnapshotDb } from "../../core-backend";
import type { SchemaView } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

/**
 * Tests that HiddenSchema, HiddenClass, and HiddenProperty custom attributes from
 * CoreCustomAttributes are correctly populated as boolean isHidden flags on the
 * corresponding SchemaView.Schema, SchemaView.Class, and SchemaView.Property objects.
 */
describe("SchemaView hidden flags", () => {
  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
  });

  // A test schema that:
  // 1. References BisCore (required for entity classes in iModels)
  // 2. References CoreCustomAttributes for Hidden* CAs
  // 3. Applies HiddenSchema to itself
  // 4. Has a class with HiddenClass CA
  // 5. Has a class without HiddenClass (to verify non-hidden)
  // 6. Has a property with HiddenProperty CA
  // 7. Has a property without HiddenProperty (to verify non-hidden)
  const hiddenTestSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="HiddenTestSchema" alias="hts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
      <ECCustomAttributes>
        <HiddenSchema xmlns="CoreCustomAttributes.01.00.00"/>
      </ECCustomAttributes>
      <ECEntityClass typeName="HiddenElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECCustomAttributes>
          <HiddenClass xmlns="CoreCustomAttributes.01.00.00"/>
        </ECCustomAttributes>
        <ECProperty propertyName="HiddenProp" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.00"/>
          </ECCustomAttributes>
        </ECProperty>
        <ECProperty propertyName="VisibleProp" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="VisibleElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="SomeProp" typeName="int"/>
      </ECEntityClass>
    </ECSchema>`;

  // A second schema without HiddenSchema, for comparison
  const visibleTestSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="VisibleTestSchema" alias="vts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="NormalElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="NormalProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  let iModel: SnapshotDb;
  let runtimeCtx: SchemaView;

  before(async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("RuntimeSchemaHidden", "HiddenFlags.bim");
    iModel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "HiddenFlagsTest" } });
    await iModel.importSchemaStrings([hiddenTestSchema, visibleTestSchema]);
    runtimeCtx = await iModel.getSchemaView();
  });

  after(() => {
    if (iModel?.isOpen)
      iModel.close();
  });

  it("should mark schema with HiddenSchema CA as hidden", () => {
    const hiddenSchema = runtimeCtx.getSchema("HiddenTestSchema");
    expect(hiddenSchema).to.not.be.undefined;
    expect(hiddenSchema!.isHidden).to.equal(true, "HiddenTestSchema should be hidden");
  });

  it("should not mark schema without HiddenSchema CA as hidden", () => {
    const visibleSchema = runtimeCtx.getSchema("VisibleTestSchema");
    expect(visibleSchema).to.not.be.undefined;
    expect(visibleSchema!.isHidden).to.equal(false, "VisibleTestSchema should not be hidden");

    // BisCore should also not be hidden
    const bisCore = runtimeCtx.getSchema("BisCore");
    expect(bisCore).to.not.be.undefined;
    expect(bisCore!.isHidden).to.equal(false, "BisCore should not be hidden");
  });

  it("should mark class with HiddenClass CA as hidden", () => {
    const hiddenClass = runtimeCtx.findClass("HiddenTestSchema:HiddenElement");
    expect(hiddenClass).to.not.be.undefined;
    expect(hiddenClass!.isHidden).to.equal(true, "HiddenElement should be hidden");
  });

  it("should not mark class without HiddenClass CA as hidden", () => {
    const visibleClass = runtimeCtx.findClass("HiddenTestSchema:VisibleElement");
    expect(visibleClass).to.not.be.undefined;
    expect(visibleClass!.isHidden).to.equal(false, "VisibleElement should not be hidden");
  });

  it("should mark property with HiddenProperty CA as hidden", () => {
    const cls = runtimeCtx.findClass("HiddenTestSchema:HiddenElement");
    expect(cls).to.not.be.undefined;

    const hiddenProp = cls!.getProperty("HiddenProp");
    expect(hiddenProp).to.not.be.undefined;
    expect(hiddenProp!.isHidden).to.equal(true, "HiddenProp should be hidden");
  });

  it("should not mark property without HiddenProperty CA as hidden", () => {
    const cls = runtimeCtx.findClass("HiddenTestSchema:HiddenElement");
    expect(cls).to.not.be.undefined;

    const visibleProp = cls!.getProperty("VisibleProp");
    expect(visibleProp).to.not.be.undefined;
    expect(visibleProp!.isHidden).to.equal(false, "VisibleProp should not be hidden");
  });
});
