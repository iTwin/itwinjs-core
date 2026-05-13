/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import { SchemaContext } from "../../Context";
import { Schema } from "../../Metadata/Schema";
import { beforeAll, describe, expect, it } from "vitest";
import { SchemaLocalization } from "../../Localization/SchemaLocalization";
import { LocalizationProvider } from "../../Localization/LocalizationProvider";

describe("SchemaLocalization", () => {

  const loader = async (schemaName: string, locale: string) => {
    try {
      const localizationInfoFile = path.join(__dirname, "..", "assets", "localizations", `${schemaName}.${locale}.json`);
      const content = fs.readFileSync(localizationInfoFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return undefined;
    }
  };

  let context: SchemaContext;
  let testBuildingSchema: Schema;
  const provider = new LocalizationProvider(loader);

  beforeAll(async () => {
    context = new SchemaContext();
    const schemaPath = path.join(__dirname, "..", "assets", "TestBuilding.ecschema.json");
    const schemaJson = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    testBuildingSchema = await Schema.fromJson(schemaJson, context);
  });

  describe("LocalizationProvider", () => {
    it("should successfully load the schema label and description information", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      // Localized schema label
      expect(schemaLabel).to.equal("Test-Gebäudeschema");
      // Actual schema label
      expect(testBuildingSchema.label).to.equal("Test Building Schema");

      const schemaDescription = await localization.getSchemaDescription(testBuildingSchema);
      // Localized schema description
      expect(schemaDescription).to.equal("Ein Testschema für Gebäudeelemente");
      // Actual schema description
      expect(testBuildingSchema.description).to.equal("A test schema for building elements");

      localization.locale = "es";
      const spanishLabel = await localization.getSchemaLabel(testBuildingSchema);
      // Localized schema label
      expect(spanishLabel).to.equal("Esquema de Prueba de Edificios");
      // Actual schema label
      expect(testBuildingSchema.label).to.equal("Test Building Schema");
    });

    it("should fall back to base locale, when region specific locale not found", async () => {
      const localization = new SchemaLocalization(provider, "de-DE");

      // Should fall back to "de" when "de-DE" is not found
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(schemaLabel).to.equal("Test-Gebäudeschema");
    });

    it("should localize entity class label and description", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      expect(buildingClass).toBeDefined();

      const label = await localization.getSchemaItemLabel(buildingClass!);
      // Localized class label
      expect(label).to.equal("Gebäude");
      // Actual class label
      expect(buildingClass!.label).to.equal("Building");

      const description = await localization.getSchemaItemDescription(buildingClass!);
      // Localized class description
      expect(description).to.equal("Eine physische Gebäudestruktur");
      // Actual class description
      expect(buildingClass!.description).to.equal("A physical building structure");
    });

    it("should fall back to original label when localization not found", async () => {
      const localizationProvider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(localizationProvider, "fr");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      expect(buildingClass).toBeDefined();

      const label = await localization.getSchemaItemLabel(buildingClass!);
      // Falls back to original label and description
      expect(label).to.equal("Building");
      expect(buildingClass!.description).to.equal("A physical building structure");
    });

    it("should fall back to original label and description, when localization information don't have that class", async () => {
      const localization = new SchemaLocalization(provider, "de");

      // EntityClass not in localization
      const roomClass = await testBuildingSchema.getEntityClass("Room");
      expect(roomClass).toBeDefined();
      const roomLabel = await localization.getSchemaItemLabel(roomClass!);
      expect(roomLabel).to.equal("Room"); // Falls back to original label
      const roomDescription = await localization.getSchemaItemDescription(roomClass!);
      expect(roomDescription).to.equal("A room within a building"); // Falls back to original description

      // StructClass not in localization
      const locationStruct = await testBuildingSchema.getStructClass("Location");
      expect(locationStruct).toBeDefined();
      const locationLabel = await localization.getSchemaItemLabel(locationStruct!);
      expect(locationLabel).to.equal("Location"); // Falls back to original label
      const locationDescription = await localization.getSchemaItemDescription(locationStruct!);
      expect(locationDescription).to.equal("A geographic location structure"); // Falls back to original description

      // CustomAttributeClass not in localization
      const deprecatedCA = await testBuildingSchema.getCustomAttributeClass("Deprecated");
      expect(deprecatedCA).toBeDefined();
      const deprecatedLabel = await localization.getSchemaItemLabel(deprecatedCA!);
      expect(deprecatedLabel).to.equal("Deprecated"); // Falls back to original label
      const deprecatedDescription = await localization.getSchemaItemDescription(deprecatedCA!);
      expect(deprecatedDescription).to.equal("Marks an element as deprecated"); // Falls back to original description

      // RelationshipClass not in localization
      const equipmentRel = await testBuildingSchema.getRelationshipClass("BuildingHasEquipment");
      expect(equipmentRel).toBeDefined();
      const equipmentLabel = await localization.getSchemaItemLabel(equipmentRel!);
      expect(equipmentLabel).to.equal("Building Has Equipment"); // Falls back to original label
      const equipmentDescription = await localization.getSchemaItemDescription(equipmentRel!);
      expect(equipmentDescription).to.equal("Relationship between building and equipment"); // Falls back to original description

      // Mixin not in localization
      const taggableMixin = await testBuildingSchema.getMixin("ITaggable");
      expect(taggableMixin).toBeDefined();
      const taggableLabel = await localization.getSchemaItemLabel(taggableMixin!);
      expect(taggableLabel).to.equal("Taggable"); // Falls back to original label
      const taggableDescription = await localization.getSchemaItemDescription(taggableMixin!);
      expect(taggableDescription).to.equal("Mixin for taggable elements"); // Falls back to original description
    });

    it("should localize multiple classes", async () => {
      const localization = new SchemaLocalization(provider, "es");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const wallClass = await testBuildingSchema.getEntityClass("Wall");

      const buildingLabel = await localization.getSchemaItemLabel(buildingClass!);
      // Localized class label
      expect(buildingLabel).to.equal("Edificio");
      // Actual class label
      expect(buildingClass!.label).to.equal("Building");

      const wallLabel = await localization.getSchemaItemLabel(wallClass!);
      // Localized class label
      expect(wallLabel).to.equal("Pared");
      // Actual class label
      expect(wallClass!.label).to.equal("Wall");
    });

    it("should localize StructClass", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const addressStruct = await testBuildingSchema.getStructClass("Address");
      expect(addressStruct).toBeDefined();

      const label = await localization.getSchemaItemLabel(addressStruct!);
      // Localized struct label
      expect(label).to.equal("Adresse");
      // Actual struct label
      expect(addressStruct!.label).to.equal("Address");

      const description = await localization.getSchemaItemDescription(addressStruct!);
      // Localized struct description
      expect(description).to.equal("Eine Postadressenstruktur");
      // Actual struct description
      expect(addressStruct!.description).to.equal("A postal address structure");
    });

    it("should localize CustomAttributeClass", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const customAttr = await testBuildingSchema.getCustomAttributeClass("BuildingMetadata");
      expect(customAttr).toBeDefined();

      const label = await localization.getSchemaItemLabel(customAttr!);
      // Localized custom attribute label
      expect(label).to.equal("Gebäudemetadaten");
      // Actual custom attribute label
      expect(customAttr!.label).to.equal("Building Metadata");

      const description = await localization.getSchemaItemDescription(customAttr!);
      // Localized custom attribute description
      expect(description).to.equal("Benutzerdefiniertes Attribut für Gebäudemetadaten");
      // Actual custom attribute description
      expect(customAttr!.description).to.equal("Custom attribute for building metadata");
    });

    it("should localize RelationshipClass", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const relationship = await testBuildingSchema.getRelationshipClass("BuildingHasRooms");
      expect(relationship).toBeDefined();

      const label = await localization.getSchemaItemLabel(relationship!);
      // Localized relationship label
      expect(label).to.equal("Gebäude hat Räume");
      // Actual relationship label
      expect(relationship!.label).to.equal("Building Has Rooms");

      const description = await localization.getSchemaItemDescription(relationship!);
      // Localized relationship description
      expect(description).to.equal("Beziehung zwischen Gebäude und Räumen");
      // Actual relationship description
      expect(relationship!.description).to.equal("Relationship between building and rooms");
    });

    it("should localize Mixin", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const mixin = await testBuildingSchema.getMixin("ISpatialElement");
      expect(mixin).toBeDefined();

      const label = await localization.getSchemaItemLabel(mixin!);
      // Localized mixin label
      expect(label).to.equal("Räumliches Element");
      // Actual mixin label
      expect(mixin!.label).to.equal("Spatial Element");

      const description = await localization.getSchemaItemDescription(mixin!);
      // Localized mixin description
      expect(description).to.equal("Mixin für räumliche Elemente");
      // Actual mixin description
      expect(mixin!.description).to.equal("Mixin for spatial elements");
    });

    it("should localize property label and description", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      expect(buildingClass).toBeDefined();

      const heightProp = await buildingClass!.getProperty("Height");
      expect(heightProp).toBeDefined();

      const label = await localization.getPropertyLabel(buildingClass!, heightProp!);
      // Localized property label
      expect(label).to.equal("Höhe");
      // Actual property label
      expect(heightProp!.label).to.equal("Height");

      const description = await localization.getPropertyDescription(buildingClass!, heightProp!);
      // Localized property description
      expect(description).to.equal("Die Höhe des Gebäudes in Metern");
      // Actual property description
      expect(heightProp!.description).to.equal("The height of the building in meters");
    });

    it("should fall back to original property label when localization not found", async () => {
      const localizationProvider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(localizationProvider, "fr");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const heightProp = await buildingClass!.getProperty("Height");

      const label = await localization.getPropertyLabel(buildingClass!, heightProp!);
      // Falls back to original label
      expect(label).to.equal("Height");
    });

    it("should localize multiple properties", async () => {
      const localization = new SchemaLocalization(provider, "es");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const heightProp = await buildingClass!.getProperty("Height");
      const floorCountProp = await buildingClass!.getProperty("FloorCount");

      const heightLabel = await localization.getPropertyLabel(buildingClass!, heightProp!);
      // Localized property label
      expect(heightLabel).to.equal("Altura");
      // Actual property label
      expect(heightProp!.label).to.equal("Height");

      const floorCountLabel = await localization.getPropertyLabel(buildingClass!, floorCountProp!);
      // Localized property label
      expect(floorCountLabel).to.equal("Número de Pisos");
      // Actual property label
      expect(floorCountProp!.label).to.equal("Floor Count");
    });

    it("should fall back to original property label and description when localization information don't have that property", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      expect(buildingClass).toBeDefined();

      // YearBuilt property is not in localization information
      const yearBuiltProp = await buildingClass!.getProperty("YearBuilt");
      expect(yearBuiltProp).toBeDefined();

      const label = await localization.getPropertyLabel(buildingClass!, yearBuiltProp!);
      // Falls back to original property label
      expect(label).to.equal("Year Built");
      // Actual property label
      expect(yearBuiltProp!.label).to.equal("Year Built");

      const description = await localization.getPropertyDescription(buildingClass!, yearBuiltProp!);
      // Falls back to original property description
      expect(description).to.equal("The year the building was constructed");
      // Actual property description
      expect(yearBuiltProp!.description).to.equal("The year the building was constructed");

      // Room class is not in localization information at all
      const roomClass = await testBuildingSchema.getEntityClass("Room");
      expect(roomClass).toBeDefined();

      const areaProp = await roomClass!.getProperty("Area");
      expect(areaProp).toBeDefined();

      const areaLabel = await localization.getPropertyLabel(roomClass!, areaProp!);
      // Falls back to original property label
      expect(areaLabel).to.equal("Area");
      // Actual property label
      expect(areaProp!.label).to.equal("Area");

      const areaDescription = await localization.getPropertyDescription(roomClass!, areaProp!);
      // Falls back to original property description
      expect(areaDescription).to.equal("The area of the room in square meters");
      // Actual property description
      expect(areaProp!.description).to.equal("The area of the room in square meters");
    });

    it("should localize enumeration label and description", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      expect(buildingTypeEnum).toBeDefined();

      const label = await localization.getSchemaItemLabel(buildingTypeEnum!);
      // Localized enumeration label
      expect(label).to.equal("Gebäudetyp");
      // Actual enumeration label
      expect(buildingTypeEnum!.label).to.equal("Building Type");

      const description = await localization.getSchemaItemDescription(buildingTypeEnum!);
      // Localized enumeration description
      expect(description).to.equal("Arten von Gebäuden");
      // Actual enumeration description
      expect(buildingTypeEnum!.description).to.equal("Types of buildings");
    });

    it("should localize enumerator labels and descriptions", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      expect(buildingTypeEnum).toBeDefined();

      const residentialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Residential");
      const residentialDescription = await localization.getEnumeratorDescription(buildingTypeEnum!, "Residential");
      // Localized enumerator label
      expect(residentialLabel).to.equal("Wohngebäude");
      // Localized enumerator description
      expect(residentialDescription).to.equal("Ein Wohngebäude");
    });

    it("should fall back to original enumerator label when localization not found", async () => {
      const localizationProvider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(localizationProvider, "fr");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      const label = await localization.getEnumeratorLabel(buildingTypeEnum!, "Residential");

      // Falls back to original label
      expect(label).to.equal("Residential");
    });

    it("should fall back to original enumerator label or description when partially localized", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      expect(buildingTypeEnum).toBeDefined();

      // Commercial: has only localized description
      const commercialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Commercial");
      expect(commercialLabel).to.equal("Commercial"); // Falls back to original label

      const commercialDescription = await localization.getEnumeratorDescription(buildingTypeEnum!, "Commercial");
      expect(commercialDescription).to.equal("Ein Gewerbegebäude"); // Localized description

      // Industrial: has only localized label
      const industrialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Industrial");
      expect(industrialLabel).to.equal("Industriegebäude"); // Localized label

      const industrialDescription = await localization.getEnumeratorDescription(buildingTypeEnum!, "Industrial");
      expect(industrialDescription).to.equal("An industrial building"); // Falls back to original description
    });

    it("should fall back to original labels and descriptions when enumeration not in localization", async () => {
      // MaterialType enumeration exists in schema but not in any localization information
      const localization = new SchemaLocalization(provider, "de");

      const materialTypeEnum = await testBuildingSchema.getEnumeration("MaterialType");
      expect(materialTypeEnum).toBeDefined();

      const enumLabel = await localization.getSchemaItemLabel(materialTypeEnum!);
      expect(enumLabel).to.equal("Material Type"); // Falls back to original label

      const enumDescription = await localization.getSchemaItemDescription(materialTypeEnum!);
      expect(enumDescription).to.equal("Types of construction materials"); // Falls back to original description
    });

    it("should fall back to original label and description when enumerator not in localization", async () => {
      // MixedUse enumerator exists in schema but not in localization information
      const localization = new SchemaLocalization(provider, "de");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      expect(buildingTypeEnum).toBeDefined();

      const mixedUseLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "MixedUse");
      expect(mixedUseLabel).to.equal("Mixed Use"); // Falls back to original label

      const mixedUseDescription = await localization.getEnumeratorDescription(buildingTypeEnum!, "MixedUse");
      expect(mixedUseDescription).to.equal("A mixed-use building"); // Falls back to original description
    });

    it("should localize unit", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const unit = await testBuildingSchema.getUnit("M");
      expect(unit).toBeDefined();

      const label = await localization.getSchemaItemLabel(unit!);
      // Localized unit label
      expect(label).to.equal("Meter");
      // Actual unit label
      expect(unit!.label).to.equal("Meter");

      const description = await localization.getSchemaItemDescription(unit!);
      // Localized unit description
      expect(description).to.equal("Metereinheit");
      // Actual unit description
      expect(unit!.description).to.equal("Meter unit");
    });

    it("should fall back to original label and description, when unit not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const unit = await testBuildingSchema.getUnit("FT");
      expect(unit).toBeDefined();

      const label = await localization.getSchemaItemLabel(unit!);
      expect(label).to.equal("Foot"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(unit!);
      expect(description).to.equal("Foot unit"); // Falls back to original description
    });

    it("should localize inverted unit", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const invertedUnit = await testBuildingSchema.getInvertedUnit("PER_M");
      expect(invertedUnit).toBeDefined();

      const label = await localization.getSchemaItemLabel(invertedUnit!);
      // Localized inverted unit label
      expect(label).to.equal("Pro Meter");
      // Actual inverted unit label
      expect(invertedUnit!.label).to.equal("Per Meter");

      const description = await localization.getSchemaItemDescription(invertedUnit!);
      // Localized inverted unit description
      expect(description).to.equal("Invertierte Metereinheit");
      // Actual inverted unit description
      expect(invertedUnit!.description).to.equal("Inverted meter unit");
    });

    it("should fall back to original label and description, when inverted unit not in localization", async () => {
      const localization = new SchemaLocalization(provider, "es");

      // PER_M not in es localization, should fall back to original
      const invertedUnit = await testBuildingSchema.getInvertedUnit("PER_M");
      expect(invertedUnit).toBeDefined();

      const label = await localization.getSchemaItemLabel(invertedUnit!);
      expect(label).to.equal("Per Meter"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(invertedUnit!);
      expect(description).to.equal("Inverted meter unit"); // Falls back to original description
    });

    it("should localize phenomenon", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const phenomenon = await testBuildingSchema.getPhenomenon("LENGTH");
      expect(phenomenon).toBeDefined();

      const label = await localization.getSchemaItemLabel(phenomenon!);
      // Localized phenomenon label
      expect(label).to.equal("Länge");
      // Actual phenomenon label
      expect(phenomenon!.label).to.equal("Length");

      const description = await localization.getSchemaItemDescription(phenomenon!);
      // Localized phenomenon description
      expect(description).to.equal("Längenphänomen");
      // Actual phenomenon description
      expect(phenomenon!.description).to.equal("Length phenomenon");
    });

    it("should fall back to original label and description, when phenomenon not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const phenomenon = await testBuildingSchema.getPhenomenon("AREA");
      expect(phenomenon).toBeDefined();

      const label = await localization.getSchemaItemLabel(phenomenon!);
      expect(label).to.equal("Area"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(phenomenon!);
      expect(description).to.equal("Area phenomenon"); // Falls back to original description
    });

    it("should localize UnitSystem", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const unitSystem = await testBuildingSchema.getUnitSystem("METRIC");
      expect(unitSystem).toBeDefined();

      const label = await localization.getSchemaItemLabel(unitSystem!);
      // Localized unit system label
      expect(label).to.equal("Metrisch");
      // Actual unit system label
      expect(unitSystem!.label).to.equal("Metric");

      const description = await localization.getSchemaItemDescription(unitSystem!);
      // Localized unit system description
      expect(description).to.equal("Metrisches Einheitensystem");
      // Actual unit system description
      expect(unitSystem!.description).to.equal("Metric unit system");
    });

    it("should fall back to original label and description, when UnitSystem not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const unitSystem = await testBuildingSchema.getUnitSystem("IMPERIAL");
      expect(unitSystem).toBeDefined();

      const label = await localization.getSchemaItemLabel(unitSystem!);
      expect(label).to.equal("Imperial"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(unitSystem!);
      expect(description).to.equal("Imperial unit system"); // Falls back to original description
    });

    it("should localize PropertyCategory", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const propertyCategory = await testBuildingSchema.getPropertyCategory("SpatialCategory");
      expect(propertyCategory).toBeDefined();

      const label = await localization.getSchemaItemLabel(propertyCategory!);
      // Localized property category label
      expect(label).to.equal("Räumliche Kategorie");
      // Actual property category label
      expect(propertyCategory!.label).to.equal("Spatial Category");

      const description = await localization.getSchemaItemDescription(propertyCategory!);
      // Localized property category description
      expect(description).to.equal("Kategorie für räumliche Eigenschaften");
      // Actual property category description
      expect(propertyCategory!.description).to.equal("Category for spatial properties");
    });

    it("should fall back to original label and description, when PropertyCategory not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const propertyCategory = await testBuildingSchema.getPropertyCategory("TemporalCategory");
      expect(propertyCategory).toBeDefined();

      const label = await localization.getSchemaItemLabel(propertyCategory!);
      expect(label).to.equal("Temporal Category"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(propertyCategory!);
      expect(description).to.equal("Category for temporal properties"); // Falls back to original description
    });

    it("should localize format", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const format = await testBuildingSchema.getFormat("DefaultReal");
      expect(format).toBeDefined();

      const label = await localization.getSchemaItemLabel(format!);
      // Localized format label
      expect(label).to.equal("Standard-Realformat");
      // Actual format label
      expect(format!.label).to.equal("Default Real Format");

      const description = await localization.getSchemaItemDescription(format!);
      // Localized format description
      expect(description).to.equal("Standardformat für reelle Zahlen");
      // Actual format description
      expect(format!.description).to.equal("Default format for real numbers");
    });

    it("should fall back to original label and description, when format not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const format = await testBuildingSchema.getFormat("DefaultInteger");
      expect(format).toBeDefined();

      const label = await localization.getSchemaItemLabel(format!);
      expect(label).to.equal("Default Integer Format"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(format!);
      expect(description).to.equal("Default format for integer numbers"); // Falls back to original description
    });

    it("should localize KindOfQuantity", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const koq = await testBuildingSchema.getKindOfQuantity("LENGTH_KOQ");
      expect(koq).toBeDefined();

      const label = await localization.getSchemaItemLabel(koq!);
      // Localized KOQ label
      expect(label).to.equal("Längen-KOQ");
      // Actual KOQ label
      expect(koq!.label).to.equal("Length KOQ");

      const description = await localization.getSchemaItemDescription(koq!);
      // Localized KOQ description
      expect(description).to.equal("Größenart für Länge");
      // Actual KOQ description
      expect(koq!.description).to.equal("Kind of quantity for length");
    });

    it("should fall back to original label and description, when KindOfQuantity not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const koq = await testBuildingSchema.getKindOfQuantity("AREA_KOQ");
      expect(koq).toBeDefined();

      const label = await localization.getSchemaItemLabel(koq!);
      expect(label).to.equal("Area KOQ"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(koq!);
      expect(description).to.equal("Kind of quantity for area"); // Falls back to original description
    });

    it("should localize constant", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const constant = await testBuildingSchema.getConstant("PI");
      expect(constant).toBeDefined();

      const label = await localization.getSchemaItemLabel(constant!);
      // Localized constant label
      expect(label).to.equal("Pi");
      // Actual constant label
      expect(constant!.label).to.equal("Pi");

      const description = await localization.getSchemaItemDescription(constant!);
      // Localized constant description
      expect(description).to.equal("Mathematische Konstante Pi");
      // Actual constant description
      expect(constant!.description).to.equal("Mathematical constant Pi");
    });

    it("should fall back to original label and description, when constant not in localization", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const constant = await testBuildingSchema.getConstant("E");
      expect(constant).toBeDefined();

      const label = await localization.getSchemaItemLabel(constant!);
      expect(label).to.equal("Euler's Number"); // Falls back to original label

      const description = await localization.getSchemaItemDescription(constant!);
      expect(description).to.equal("Mathematical constant E"); // Falls back to original description
    });

    it("should localize multiple item types with locale fallback", async () => {
      const localization = new SchemaLocalization(provider, "es-CO");

      // es-CO has Address and Building classes localized
      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const addressStruct = await testBuildingSchema.getStructClass("Address");
      const buildingLabel = await localization.getSchemaItemLabel(buildingClass!);
      const addressLabel = await localization.getSchemaItemLabel(addressStruct!);

      // Localized label From 'es-CO' locale
      expect(buildingLabel).to.equal("Construcción");
      expect(addressLabel).to.equal("Dirección");
      // Actual label
      expect(addressStruct!.label).to.equal("Address");

      // BuildingMetadata not in es-CO, should fall back to 'es' locale
      const customAttr = await testBuildingSchema.getCustomAttributeClass("BuildingMetadata");
      const customAttrLabel = await localization.getSchemaItemLabel(customAttr!);
      // Localized label from 'es' locale
      expect(customAttrLabel).to.equal("Metadatos del Edificio");
      // Actual label
      expect(customAttr!.label).to.equal("Building Metadata");
    });

    it("should throw error when localization JSON has wrong schema name", async () => {
      const schemaLoader = async (_schemaName: string, locale: string) => {
        return {
          name: "testSchema",
          locale: locale,
          label: "Test Label",
          description: "Test Description",
        };
      };

      const invalidProvider = new LocalizationProvider(schemaLoader);
      // Should throw error due to schema name mismatch
      await expect(invalidProvider.getLocalization("TestBuilding", "de"))
        .rejects.toThrow('Localization JSON mismatch for TestBuilding:de - expected schema name "TestBuilding" but got "testSchema"');
    });

    it("should throw error when localization JSON has wrong locale", async () => {
      const schemaLoader = async (schemaName: string, _locale: string) => {
        return {
          name: schemaName,
          locale: "fr",
          label: "Test Label",
          description: "Test Description",
        };
      };

      const invalidProvider = new LocalizationProvider(schemaLoader);
      // Should throw error due to locale mismatch
      await expect(invalidProvider.getLocalization("TestBuilding", "de"))
        .rejects.toThrow('Localization JSON mismatch for TestBuilding:de - expected locale "de" but got "fr"');
    });
  });

  describe("Schema localization for multiple schemas", () => {
    let testProductSchema: Schema;
    let testPersonSchema: Schema;

    beforeAll(async () => {
      const productSchemaJson = path.join(__dirname, "..", "assets", "TestProduct.ecschema.json");
      const productJson = JSON.parse(fs.readFileSync(productSchemaJson, "utf-8"));
      testProductSchema = await Schema.fromJson(productJson, context);

      const personSchemaJson = path.join(__dirname, "..", "assets", "TestPerson.ecschema.json");
      const personJson = JSON.parse(fs.readFileSync(personSchemaJson, "utf-8"));
      testPersonSchema = await Schema.fromJson(personJson, context);
    });

    it("should retrieve localizations for multiple schemas independently", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(buildingLabel).to.equal("Test-Gebäudeschema");
      expect(testBuildingSchema.label).to.equal("Test Building Schema");

      const productLabel = await localization.getSchemaLabel(testProductSchema);
      expect(productLabel).to.equal("Test-Produktschema");
      expect(testProductSchema.label).to.equal("Test Product Schema");

      const personLabel = await localization.getSchemaLabel(testPersonSchema);
      expect(personLabel).to.equal("Test-Personenschema");
      expect(testPersonSchema.label).to.equal("Test Person Schema");
    });

    it("should handle class localization from different schemas", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const buildingClassLabel = await localization.getSchemaItemLabel(buildingClass!);
      expect(buildingClassLabel).to.equal("Gebäude");

      const productClass = await testProductSchema.getEntityClass("Product");
      const productClassLabel = await localization.getSchemaItemLabel(productClass!);
      expect(productClassLabel).to.equal("Produkt");

      const personClass = await testPersonSchema.getEntityClass("Person");
      const personClassLabel = await localization.getSchemaItemLabel(personClass!);
      expect(personClassLabel).to.equal("Person");
    });

    it("should handle property localization from different schemas", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const productClass = await testProductSchema.getEntityClass("Product");
      const priceProperty = await productClass!.getProperty("Price");
      const priceLabel = await localization.getPropertyLabel(productClass!, priceProperty!);
      expect(priceLabel).to.equal("Preis");

      const personClass = await testPersonSchema.getEntityClass("Person");
      const firstNameProperty = await personClass!.getProperty("FirstName");
      const firstNameLabel = await localization.getPropertyLabel(personClass!, firstNameProperty!);
      expect(firstNameLabel).to.equal("Vorname");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const heightProperty = await buildingClass!.getProperty("Height");
      const heightLabel = await localization.getPropertyLabel(buildingClass!, heightProperty!);
      expect(heightLabel).to.equal("Höhe");
    });

    it("should efficiently cache multiple schemas without redundant loads", async () => {
      let loadCount = 0;
      const trackingLoader = async (schemaName: string, locale: string) => {
        loadCount++;
        try {
          const localizationInfoFile = path.join(__dirname, "..", "assets", "localizations", `${schemaName}.${locale}.json`);
          const content = fs.readFileSync(localizationInfoFile, "utf-8");
          return JSON.parse(content);
        } catch {
          return undefined;
        }
      };

      const localizationProvider = new LocalizationProvider(trackingLoader);
      const localization = new SchemaLocalization(localizationProvider, "de");

      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaLabel(testProductSchema);
      await localization.getSchemaLabel(testPersonSchema);

      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaLabel(testProductSchema);
      await localization.getSchemaLabel(testPersonSchema);

      expect(loadCount).to.equal(3);
    });

    it("should fall back to original labels when locale not available for any schema", async () => {
      // Urdu (ur) not provided for any schema
      const localization = new SchemaLocalization(provider, "ur");

      const buildingLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(buildingLabel).to.equal("Test Building Schema");

      const productLabel = await localization.getSchemaLabel(testProductSchema);
      expect(productLabel).to.equal("Test Product Schema");

      const personLabel = await localization.getSchemaLabel(testPersonSchema);
      expect(personLabel).to.equal("Test Person Schema");
    });

    it("should throw error for invalid localization JSON structure", async () => {
      const invalidLoader = async () => {
        return {
          // Missing required fields: schemaName and locale
          label: "Invalid",
        } as any;
      };

      const localizationProvider = new LocalizationProvider(invalidLoader);
      const localization = new SchemaLocalization(localizationProvider, "de");

      await expect(localization.getSchemaLabel(testBuildingSchema)).rejects.toThrow("Invalid localization JSON");
    });

    it("should throw error, when major version is different", async () => {
      const localization = new SchemaLocalization(provider, "fr");

      // TestProduct schema and its French localization have same major version
      const productLabel = await localization.getSchemaLabel(testProductSchema);
      expect(productLabel).to.equal("Schéma de test de produit");
      expect(testProductSchema.label).to.equal("Test Product Schema");

      // TestPerson schema and its French localization have different major version
      await expect(localization.getSchemaLabel(testPersonSchema)).rejects.toThrow(`Localization version mismatch for schema "TestPerson". Schema major version is 1, but localization is for major version 2.`);
    });
  });
});
