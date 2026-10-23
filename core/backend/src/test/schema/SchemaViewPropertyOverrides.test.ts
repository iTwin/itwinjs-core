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
 * Tests how SchemaView resolves metadata of property overrides: category, KindOfQuantity and hidden flags
 * come from the overridden property when the override does not define them, priority stays local.
 * Also covers which declaration a class gets when mixins override properties of other mixins.
 */
describe("SchemaView property overrides", () => {
  const zooSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="Zoo" alias="zoo" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECSchemaReference name="Units" version="01.00.09" alias="u"/>
      <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>

      <PropertyCategory typeName="Identity" priority="100"/>
      <PropertyCategory typeName="Nicknames" priority="50"/>
      <PropertyCategory typeName="Skills" priority="40"/>
      <PropertyCategory typeName="Anatomy" priority="30"/>
      <PropertyCategory typeName="Flight" priority="20"/>

      <KindOfQuantity typeName="BodyMass" persistenceUnit="u:KG" relativeError="0.01" presentationUnits="f:DefaultRealU(2)[u:KG]"/>
      <KindOfQuantity typeName="PreciseBodyMass" persistenceUnit="u:KG" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:KG]"/>

      <ECEntityClass typeName="Animal" modifier="Abstract">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="Nickname" typeName="string" category="Identity" priority="5"/>
        <ECProperty propertyName="Weight" typeName="double" kindOfQuantity="BodyMass"/>
        <ECArrayProperty propertyName="DailyWeights" typeName="double" kindOfQuantity="BodyMass" minOccurs="0" maxOccurs="unbounded"/>
        <ECProperty propertyName="FavoriteSnack" typeName="string"/>
        <ECProperty propertyName="Secret" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.03"/>
          </ECCustomAttributes>
        </ECProperty>
        <ECProperty propertyName="Mood" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.03"/>
          </ECCustomAttributes>
        </ECProperty>
      </ECEntityClass>

      <ECEntityClass typeName="Mammal" modifier="Abstract">
        <BaseClass>Animal</BaseClass>
        <ECProperty propertyName="Nickname" typeName="string" displayLabel="Mammal Nickname"/>
        <ECProperty propertyName="Weight" typeName="double" displayLabel="Mammal Weight"/>
        <ECArrayProperty propertyName="DailyWeights" typeName="double" displayLabel="Mammal Daily Weights" minOccurs="0" maxOccurs="unbounded"/>
        <ECProperty propertyName="FavoriteSnack" typeName="string" displayLabel="Mammal Snack"/>
        <ECProperty propertyName="Secret" typeName="string" displayLabel="Mammal Secret"/>
        <ECProperty propertyName="Mood" typeName="string">
          <ECCustomAttributes>
            <HiddenProperty xmlns="CoreCustomAttributes.01.00.03">
              <Show>true</Show>
            </HiddenProperty>
          </ECCustomAttributes>
        </ECProperty>
      </ECEntityClass>

      <ECEntityClass typeName="Cat" modifier="Sealed">
        <BaseClass>Mammal</BaseClass>
        <ECProperty propertyName="Nickname" typeName="string" displayLabel="Cat Nickname"/>
      </ECEntityClass>

      <ECEntityClass typeName="Dog" modifier="Sealed">
        <BaseClass>Mammal</BaseClass>
        <ECProperty propertyName="Nickname" typeName="string" category="Nicknames" priority="0"/>
        <ECProperty propertyName="Weight" typeName="double" kindOfQuantity="PreciseBodyMass"/>
      </ECEntityClass>

      <ECEntityClass typeName="ITalker" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:PhysicalElement</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="Vocabulary" typeName="string" category="Skills"/>
      </ECEntityClass>

      <ECEntityClass typeName="Parrot" modifier="Sealed">
        <BaseClass>Animal</BaseClass>
        <BaseClass>ITalker</BaseClass>
        <ECProperty propertyName="Vocabulary" typeName="string" displayLabel="Parrot Vocabulary"/>
      </ECEntityClass>

      <ECEntityClass typeName="IFlyer" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:PhysicalElement</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="WingSpan" typeName="double" category="Anatomy"/>
        <ECProperty propertyName="FlightSpeed" typeName="double" category="Flight"/>
      </ECEntityClass>

      <ECEntityClass typeName="ISoarer" modifier="Abstract">
        <BaseClass>IFlyer</BaseClass>
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:PhysicalElement</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="WingSpan" typeName="double" displayLabel="Soaring Wing Span" category="Flight"/>
        <ECProperty propertyName="FlightSpeed" typeName="double" displayLabel="Soaring Speed"/>
      </ECEntityClass>

      <ECEntityClass typeName="Eagle" modifier="Sealed">
        <BaseClass>Animal</BaseClass>
        <BaseClass>ISoarer</BaseClass>
      </ECEntityClass>
    </ECSchema>`;

  let iModel: SnapshotDb;
  let view: SchemaView;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();

    const testFileName = IModelTestUtils.prepareOutputFile("SchemaViewPropertyOverrides", "Zoo.bim");
    iModel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaViewPropertyOverrides" } });
    await iModel.importSchemaStrings([zooSchema]);
    view = await iModel.getSchemaView();
  });

  after(() => {
    if (iModel?.isOpen)
      iModel.close();
  });

  function getProperty(className: string, propertyName: string): SchemaView.Property {
    const ecClass = view.findClass(`Zoo:${className}`);
    expect(ecClass, `class ${className}`).to.not.be.undefined;
    const property = ecClass!.getProperty(propertyName);
    expect(property, `property ${className}.${propertyName}`).to.not.be.undefined;
    return property!;
  }

  function getKindOfQuantityName(className: string, propertyName: string): string | undefined {
    const property = getProperty(className, propertyName);
    if (!property.isPrimitive())
      throw new Error(`${className}.${propertyName} is not primitive`);
    return property.kindOfQuantity?.name;
  }

  describe("category", () => {
    it("returns the local category", () => {
      expect(getProperty("Animal", "Nickname").category?.name).to.equal("Identity");
    });

    it("takes the category from the overridden property", () => {
      const property = getProperty("Mammal", "Nickname");
      expect(property.declaringClass?.name).to.equal("Mammal");
      expect(property.label).to.equal("Mammal Nickname");
      expect(property.category?.name).to.equal("Identity");
    });

    it("takes the category through multiple overrides", () => {
      const property = getProperty("Cat", "Nickname");
      expect(property.declaringClass?.name).to.equal("Cat");
      expect(property.label).to.equal("Cat Nickname");
      expect(property.category?.name).to.equal("Identity");
    });

    it("prefers the local category over the overridden one", () => {
      expect(getProperty("Dog", "Nickname").category?.name).to.equal("Nicknames");
    });

    it("returns undefined if no declaration has a category", () => {
      expect(getProperty("Cat", "FavoriteSnack").category).to.be.undefined;
    });

    it("returns the category of an inherited property that is not overridden", () => {
      const property = getProperty("Eagle", "Nickname");
      expect(property.declaringClass?.name).to.equal("Animal");
      expect(property.category?.name).to.equal("Identity");
    });

    it("takes the category from an overridden mixin property", () => {
      const property = getProperty("Parrot", "Vocabulary");
      expect(property.declaringClass?.name).to.equal("Parrot");
      expect(property.label).to.equal("Parrot Vocabulary");
      expect(property.category?.name).to.equal("Skills");
    });
  });

  describe("kindOfQuantity", () => {
    it("returns the local KindOfQuantity", () => {
      expect(getKindOfQuantityName("Animal", "Weight")).to.equal("BodyMass");
      expect(getKindOfQuantityName("Dog", "Weight")).to.equal("PreciseBodyMass");
    });

    it("takes the KindOfQuantity from the overridden property", () => {
      expect(getKindOfQuantityName("Mammal", "Weight")).to.equal("BodyMass");
      expect(getKindOfQuantityName("Cat", "Weight")).to.equal("BodyMass");
    });

    it("takes the KindOfQuantity from the overridden primitive array property", () => {
      const property = getProperty("Mammal", "DailyWeights");
      expect(property.isArray()).to.be.true;
      expect(getKindOfQuantityName("Mammal", "DailyWeights")).to.equal("BodyMass");
    });
  });

  describe("hidden", () => {
    it("hidden declaration is hidden", () => {
      const property = getProperty("Animal", "Secret");
      expect(property.isHidden).to.be.true;
      expect(property.isEffectivelyHidden).to.be.true;
    });

    it("override without HiddenProperty is effectively hidden if the overridden property is hidden", () => {
      const property = getProperty("Mammal", "Secret");
      expect(property.isHidden).to.be.false;
      expect(property.isEffectivelyHidden).to.be.true;
    });

    it("HiddenProperty(Show=true) on an override does not unhide a hidden overridden property", () => {
      // Documented limitation: SchemaView cannot tell Show=true apart from no HiddenProperty.
      const property = getProperty("Mammal", "Mood");
      expect(property.isHidden).to.be.false;
      expect(property.isEffectivelyHidden).to.be.true;
    });

    it("property without any HiddenProperty is not effectively hidden", () => {
      expect(getProperty("Cat", "FavoriteSnack").isEffectivelyHidden).to.be.false;
    });
  });

  describe("priority", () => {
    it("is local to the declaration", () => {
      expect(getProperty("Animal", "Nickname").priority).to.equal(5);
      expect(getProperty("Mammal", "Nickname").priority).to.equal(0);
      expect(getProperty("Dog", "Nickname").priority).to.equal(0);
    });
  });

  describe("mixin overriding a mixin", () => {
    it("class gets the declaration of the derived mixin", () => {
      const property = getProperty("Eagle", "WingSpan");
      expect(property.declaringClass?.name).to.equal("ISoarer");
      expect(property.label).to.equal("Soaring Wing Span");
      expect(property.category?.name).to.equal("Flight");
    });

    it("derived mixin declaration takes the category from the base mixin", () => {
      const property = getProperty("Eagle", "FlightSpeed");
      expect(property.declaringClass?.name).to.equal("ISoarer");
      expect(property.label).to.equal("Soaring Speed");
      expect(property.category?.name).to.equal("Flight");
    });

    it("lists each property once", () => {
      const names = view.findClass("Zoo:Eagle")!.getProperties().map((property) => property.name.toLowerCase());
      expect(new Set(names).size).to.equal(names.length);
    });
  });
});
