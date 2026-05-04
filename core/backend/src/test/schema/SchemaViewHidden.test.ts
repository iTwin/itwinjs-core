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
 * Tests for the Hidden* custom attributes from CoreCustomAttributes, verifying that SchemaView
 * correctly exposes the tri-state `isHidden` (true/false/undefined) on classes and the boolean
 * `isHidden` on schemas and properties. Also tests `isEffectivelyHidden` which walks the base
 * class chain (not mixins) and stops at explicit `isHidden === false` overrides.
 *
 * Class `isHidden` values:
 * - `true`:      hidden via `HiddenClass(Show!=true)` or schema-level `HiddenSchema(ShowClasses!=true)`
 * - `false`:     explicitly shown via `HiddenClass(Show=true)` - breaks inheritance chain
 * - `undefined`: no `HiddenClass` CA, schema doesn't hide classes - neutral, defers to base class
 *
 * Binary format: classes serialize this as a single byte (0=undefined, 1=true, 2=false).
 * Schema-level class propagation from `HiddenSchema(ShowClasses!=true)` is pre-resolved
 * into each class's isHidden at serialization time.
 */
describe("SchemaView hidden flags", () => {
  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
  });

  // Schema with HiddenSchema(ShowClasses=false) - schema AND all classes should be hidden
  const hiddenSchemaDefault = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="HiddenSchemaDefault" alias="hsd" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
      <ECCustomAttributes>
        <HiddenSchema xmlns="CoreCustomAttributes.01.00.00">
          <ShowClasses>false</ShowClasses>
        </HiddenSchema>
      </ECCustomAttributes>
      <ECEntityClass typeName="InheritedHiddenElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="SomeProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  // Schema with HiddenSchema(ShowClasses=true) - schema hidden, classes are NOT
  const hiddenSchemaShowClasses = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="HiddenSchemaShowClasses" alias="hssc" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
      <ECCustomAttributes>
        <HiddenSchema xmlns="CoreCustomAttributes.01.00.00">
          <ShowClasses>true</ShowClasses>
        </HiddenSchema>
      </ECCustomAttributes>
      <ECEntityClass typeName="ShownElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="SomeProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  // Schema with HiddenSchema(ShowClasses=false) + class with HiddenClass(Show=true) override
  const hiddenSchemaWithClassOverride = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="HiddenSchemaClassOverride" alias="hsco" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
      <ECCustomAttributes>
        <HiddenSchema xmlns="CoreCustomAttributes.01.00.00">
          <ShowClasses>false</ShowClasses>
        </HiddenSchema>
      </ECCustomAttributes>
      <ECEntityClass typeName="OverriddenShownElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECCustomAttributes>
          <HiddenClass xmlns="CoreCustomAttributes.01.00.00">
            <Show>true</Show>
          </HiddenClass>
        </ECCustomAttributes>
        <ECProperty propertyName="SomeProp" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="StillHiddenElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="SomeProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  // Schema with class-level and property-level hidden flags and Show overrides.
  // Also includes a non-sealed hidden base class to test derived class inheritance.
  const hiddenClassAndPropertySchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="HiddenClassPropSchema" alias="hcps" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
      <ECEntityClass typeName="HiddenBase" modifier="Abstract">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECCustomAttributes>
          <HiddenClass xmlns="CoreCustomAttributes.01.00.00">
            <Show>false</Show>
          </HiddenClass>
        </ECCustomAttributes>
        <ECProperty propertyName="HiddenProp" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.00">
              <Show>false</Show>
            </HiddenProperty>
          </ECCustomAttributes>
        </ECProperty>
        <ECProperty propertyName="ShownProp" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.00">
              <Show>true</Show>
            </HiddenProperty>
          </ECCustomAttributes>
        </ECProperty>
        <ECProperty propertyName="NormalProp" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="DerivedNoCA" modifier="Sealed" description="Derived from hidden base, no HiddenClass CA - should inherit hidden via isEffectivelyHidden">
        <BaseClass>HiddenBase</BaseClass>
      </ECEntityClass>
      <ECEntityClass typeName="DerivedShown" modifier="Sealed" description="Derived from hidden base, HiddenClass(Show=true) breaks the chain">
        <BaseClass>HiddenBase</BaseClass>
        <ECCustomAttributes>
          <HiddenClass xmlns="CoreCustomAttributes.01.00.00">
            <Show>true</Show>
          </HiddenClass>
        </ECCustomAttributes>
      </ECEntityClass>
      <ECEntityClass typeName="DerivedFromShown" modifier="Sealed" description="Derived from explicitly shown class, no CA - should NOT be effectively hidden">
        <BaseClass>DerivedShown</BaseClass>
      </ECEntityClass>
      <ECEntityClass typeName="ShownClassElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECCustomAttributes>
          <HiddenClass xmlns="CoreCustomAttributes.01.00.00">
            <Show>true</Show>
          </HiddenClass>
        </ECCustomAttributes>
        <ECProperty propertyName="SomeProp" typeName="int"/>
      </ECEntityClass>
      <ECEntityClass typeName="VisibleElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="SomeProp" typeName="int"/>
      </ECEntityClass>
    </ECSchema>`;

  // Visible schema for baseline comparison
  const visibleTestSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="VisibleTestSchema" alias="vts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="NormalElement" modifier="Sealed">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="NormalProp" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  let iModel: SnapshotDb;
  let view: SchemaView;

  before(async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaViewHidden", "HiddenFlags.bim");
    iModel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "HiddenFlagsTest" } });
    await iModel.importSchemaStrings([
      hiddenSchemaDefault,
      hiddenSchemaShowClasses,
      hiddenSchemaWithClassOverride,
      hiddenClassAndPropertySchema,
      visibleTestSchema,
    ]);
    view = await iModel.getSchemaView();
  });

  after(() => {
    if (iModel?.isOpen)
      iModel.close();
  });

  describe("HiddenSchema", () => {
    it("schema without HiddenSchema CA is not hidden", () => {
      const schema = view.getSchema("VisibleTestSchema");
      expect(schema).to.not.be.undefined;
      expect(schema!.isHidden).to.equal(false);

      const bisCore = view.getSchema("BisCore");
      expect(bisCore).to.not.be.undefined;
      expect(bisCore!.isHidden).to.equal(false);
    });

    it("schema with HiddenSchema(ShowClasses=false) is hidden", () => {
      const schema = view.getSchema("HiddenSchemaDefault");
      expect(schema).to.not.be.undefined;
      expect(schema!.isHidden).to.equal(true);
    });

    it("schema with HiddenSchema(ShowClasses=true) is still hidden", () => {
      const schema = view.getSchema("HiddenSchemaShowClasses");
      expect(schema).to.not.be.undefined;
      expect(schema!.isHidden).to.equal(true, "ShowClasses does not affect the schema's own isHidden");
    });
  });

  describe("HiddenClass - tri-state isHidden", () => {
    it("class in HiddenSchema(ShowClasses=false) without own CA has isHidden=true", () => {
      const cls = view.findClass("HiddenSchemaDefault:InheritedHiddenElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(true, "schema-level propagation bakes into true");
      expect(cls!.isEffectivelyHidden).to.equal(true);
    });

    it("class in HiddenSchema(ShowClasses=true) without own CA has isHidden=undefined", () => {
      const cls = view.findClass("HiddenSchemaShowClasses:ShownElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(undefined, "ShowClasses=true means no schema propagation");
      expect(cls!.isEffectivelyHidden).to.equal(false);
    });

    it("class with HiddenClass(Show=false) has isHidden=true", () => {
      const cls = view.findClass("HiddenClassPropSchema:HiddenBase");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(true);
      expect(cls!.isEffectivelyHidden).to.equal(true);
    });

    it("class with HiddenClass(Show=true) has isHidden=false (explicitly shown)", () => {
      const cls = view.findClass("HiddenClassPropSchema:ShownClassElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(false, "explicit Show=true produces false");
      expect(cls!.isEffectivelyHidden).to.equal(false);
    });

    it("class without any HiddenClass CA in visible schema has isHidden=undefined", () => {
      const cls = view.findClass("HiddenClassPropSchema:VisibleElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(undefined);
      expect(cls!.isEffectivelyHidden).to.equal(false);
    });

    it("HiddenClass(Show=true) in HiddenSchema(ShowClasses=false) produces isHidden=false", () => {
      const cls = view.findClass("HiddenSchemaClassOverride:OverriddenShownElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(false, "explicit Show=true overrides schema propagation");
      expect(cls!.isEffectivelyHidden).to.equal(false);
    });

    it("class without HiddenClass in HiddenSchema(ShowClasses=false) has isHidden=true", () => {
      const cls = view.findClass("HiddenSchemaClassOverride:StillHiddenElement");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(true);
      expect(cls!.isEffectivelyHidden).to.equal(true);
    });
  });

  describe("isEffectivelyHidden - base class inheritance", () => {
    it("derived class with no CA inherits effectively hidden from hidden base", () => {
      const cls = view.findClass("HiddenClassPropSchema:DerivedNoCA");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(undefined, "no own CA");
      expect(cls!.isEffectivelyHidden).to.equal(true, "walks up to hidden base");
    });

    it("derived class with HiddenClass(Show=true) breaks the inheritance chain", () => {
      const cls = view.findClass("HiddenClassPropSchema:DerivedShown");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(false);
      expect(cls!.isEffectivelyHidden).to.equal(false, "Show=true breaks the chain");
    });

    it("class derived from explicitly shown class is NOT effectively hidden", () => {
      const cls = view.findClass("HiddenClassPropSchema:DerivedFromShown");
      expect(cls).to.not.be.undefined;
      expect(cls!.isHidden).to.equal(undefined, "no own CA");
      expect(cls!.isEffectivelyHidden).to.equal(false, "Show=true on ancestor breaks the chain");
    });
  });

  describe("HiddenProperty", () => {
    it("property with HiddenProperty(Show=false) is hidden", () => {
      const cls = view.findClass("HiddenClassPropSchema:HiddenBase");
      expect(cls).to.not.be.undefined;
      const prop = cls!.getProperty("HiddenProp");
      expect(prop).to.not.be.undefined;
      expect(prop!.isHidden).to.equal(true);
    });

    it("property with HiddenProperty(Show=true) is NOT hidden", () => {
      const cls = view.findClass("HiddenClassPropSchema:HiddenBase");
      expect(cls).to.not.be.undefined;
      const prop = cls!.getProperty("ShownProp");
      expect(prop).to.not.be.undefined;
      expect(prop!.isHidden).to.equal(false, "HiddenProperty with Show=true should override");
    });

    it("property without HiddenProperty CA is not hidden", () => {
      const cls = view.findClass("HiddenClassPropSchema:HiddenBase");
      expect(cls).to.not.be.undefined;
      const prop = cls!.getProperty("NormalProp");
      expect(prop).to.not.be.undefined;
      expect(prop!.isHidden).to.equal(false);
    });
  });
});
