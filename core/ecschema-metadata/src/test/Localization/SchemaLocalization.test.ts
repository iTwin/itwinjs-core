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
import { SchemaLocalizationJson } from "../../Localization/LocalizationTypes";
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
    it("should load German localization from file system", async () => {
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
    });

    it("should fall back to base locale when region-specific locale not found", async () => {
      const localization = new SchemaLocalization(provider, "de-DE");

      // Should fall back to "de" when "de-DE" is not found
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(schemaLabel).to.equal("Test-Gebäudeschema");
    });

    it("should use cache for repeated requests", async () => {
      let loadCount = 0;
      const loader = async (schemaName: string, locale: string) => {
        loadCount++;
        try {
          const localizationInfoFile = path.join(__dirname, "..", "assets", "localizations", `${schemaName}.${locale}.json`);
          const content = fs.readFileSync(localizationInfoFile, "utf-8");
          return JSON.parse(content);
        } catch {
          return undefined;
        }
      };

      const provider = new LocalizationProvider(loader);
      const localization = new SchemaLocalization(provider, "de");

      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaDescription(testBuildingSchema);

      // Should only load once due to caching
      expect(loadCount).to.equal(1);
    });

    it("should clear cache when locale changes", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const germanLabel = await localization.getSchemaLabel(testBuildingSchema);
      // Localized schema label
      expect(germanLabel).to.equal("Test-Gebäudeschema");
      // Actual schema label
      expect(testBuildingSchema.label).to.equal("Test Building Schema");

      localization.locale = "es";
      const spanishLabel = await localization.getSchemaLabel(testBuildingSchema);
      // Localized schema label
      expect(spanishLabel).to.equal("Esquema de Prueba de Edificios");
      // Actual schema label
      expect(testBuildingSchema.label).to.equal("Test Building Schema");
    });
  });

  describe("LocalizationProvider with in-memory data", () => {
    it("should load localization from memory", async () => {
      const testData = new Map<string, SchemaLocalizationJson>();
      const germanLocalization: SchemaLocalizationJson = {
        name: "TestBuilding",
        locale: "de",
        label: "Test-Gebäudeschema",
        description: "Ein testBuildingSchema für Gebäudeelemente",
      };
      testData.set("TestBuilding:de", germanLocalization);

      const provider = new LocalizationProvider(async (schemaName, locale) => {
        return testData.get(`${schemaName}:${locale}`);
      });

      const localization = new SchemaLocalization(provider, "de");
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(schemaLabel).to.equal("Test-Gebäudeschema");
    });

    it("should support locale fallback", async () => {
      const testData = new Map<string, SchemaLocalizationJson>();
      const spanishLocalization: SchemaLocalizationJson = {
        name: "TestBuilding",
        locale: "es",
        label: "Esquema de Prueba de Edificios",
      };
      testData.set("TestBuilding:es", spanishLocalization);

      const provider = new LocalizationProvider(async (schemaName, locale) => {
        return testData.get(`${schemaName}:${locale}`);
      });

      const localization = new SchemaLocalization(provider, "es-MX");
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(schemaLabel).to.equal("Esquema de Prueba de Edificios");
    });
  });

  describe("Class localization", () => {
    it("should localize class label and description", async () => {
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
      const provider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(provider, "fr");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      expect(buildingClass).toBeDefined();

      const label = await localization.getSchemaItemLabel(buildingClass!);
      // Falls back to original label
      expect(label).to.equal("Building");
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
  });

  describe("Property localization", () => {
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
      const provider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(provider, "fr");

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
  });

  describe("Enumeration localization", () => {
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

    it("should localize enumerator labels", async () => {
      const localization = new SchemaLocalization(provider, "de");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      expect(buildingTypeEnum).toBeDefined();

      const residentialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Residential");
      // Localized enumerator label
      expect(residentialLabel).to.equal("Wohngebäude");
      const residentialEnumerator = buildingTypeEnum!.enumerators.find(e => e.name === "Residential");
      // Actual enumerator label
      expect(residentialEnumerator?.label).to.equal("Residential");

      const commercialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Commercial");
      // Localized enumerator label
      expect(commercialLabel).to.equal("Gewerbegebäude");
      const commercialEnumerator = buildingTypeEnum!.enumerators.find(e => e.name === "Commercial");
      // Actual enumerator label
      expect(commercialEnumerator?.label).to.equal("Commercial");

      const industrialLabel = await localization.getEnumeratorLabel(buildingTypeEnum!, "Industrial");
      // Localized enumerator label
      expect(industrialLabel).to.equal("Industriegebäude");
      const industrialEnumerator = buildingTypeEnum!.enumerators.find(e => e.name === "Industrial");
      // Actual enumerator label
      expect(industrialEnumerator?.label).to.equal("Industrial");
    });

    it("should fall back to original enumerator label when localization not found", async () => {
      const provider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(provider, "fr");

      const buildingTypeEnum = await testBuildingSchema.getEnumeration("BuildingType");
      const label = await localization.getEnumeratorLabel(buildingTypeEnum!, "Residential");

      // Falls back to original label
      expect(label).to.equal("Residential");
    });
  });

  describe("All schema item types localization", () => {
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

    it("should localize Unit", async () => {
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

    it("should localize Phenomenon", async () => {
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

    it("should localize Format", async () => {
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

    it("should localize Constant", async () => {
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

    it("should handle fallback for all item types when localization not found", async () => {
      const provider = new LocalizationProvider(async () => undefined);
      const localization = new SchemaLocalization(provider, "fr");

      const addressStruct = await testBuildingSchema.getStructClass("Address");
      const label = await localization.getSchemaItemLabel(addressStruct!);
      // Falls back to original label
      expect(label).to.equal("Address");
    });

    it("should localize multiple item types with locale fallback", async () => {
      const localization = new SchemaLocalization(provider, "es-CO");

      // es-CO has Address and M localized
      const addressStruct = await testBuildingSchema.getStructClass("Address");
      const addressLabel = await localization.getSchemaItemLabel(addressStruct!);
      // Localized label
      expect(addressLabel).to.equal("Dirección"); // From es-CO
      // Actual label
      expect(addressStruct!.label).to.equal("Address");

      const unit = await testBuildingSchema.getUnit("M");
      const unitLabel = await localization.getSchemaItemLabel(unit!);
      // Localized label
      expect(unitLabel).to.equal("Metro"); // From es-CO
      // Actual label
      expect(unit!.label).to.equal("Meter");

      // BuildingMetadata not in es-CO, should fall back to es
      const customAttr = await testBuildingSchema.getCustomAttributeClass("BuildingMetadata");
      const customAttrLabel = await localization.getSchemaItemLabel(customAttr!);
      // Localized label
      expect(customAttrLabel).to.equal("Metadatos del Edificio"); // From es fallback
      // Actual label
      expect(customAttr!.label).to.equal("Building Metadata");
    });
  });

  describe("Partial localization coverage", () => {
    it("should handle partial class localization", async () => {
      const localization = new SchemaLocalization(provider, "es-CO");

      // es-CO has only partial localization
      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const wallClass = await testBuildingSchema.getEntityClass("Wall");

      const buildingLabel = await localization.getSchemaItemLabel(buildingClass!);
      // Localized label
      expect(buildingLabel).to.equal("Construcción"); // From es-CO
      // Actual label
      expect(buildingClass!.label).to.equal("Building");

      // Wall is not in es-CO, should fall back to base locale (es)
      const wallLabel = await localization.getSchemaItemLabel(wallClass!);
      // Localized label
      expect(wallLabel).to.equal("Pared"); // From es fallback
      // Actual label
      expect(wallClass!.label).to.equal("Wall");
    });

    it("should handle missing property localization with fallback", async () => {
      const testData = new Map<string, SchemaLocalizationJson>();

      // Add partial localization (missing FloorCount property)
      const partialLocalization: SchemaLocalizationJson = {
        name: "TestBuilding",
        locale: "fr",
        classes: {
          Building: {
            label: "Bâtiment",
            properties: {
              Height: {
                label: "Hauteur",
              },
              // FloorCount intentionally missing
            },
          },
        },
      };
      testData.set("TestBuilding:fr", partialLocalization);

      const provider = new LocalizationProvider(async (schemaName, locale) => {
        return testData.get(`${schemaName}:${locale}`);
      });
      const localization = new SchemaLocalization(provider, "fr");

      const buildingClass = await testBuildingSchema.getEntityClass("Building");
      const heightProp = await buildingClass!.getProperty("Height");
      const floorCountProp = await buildingClass!.getProperty("FloorCount");

      const heightLabel = await localization.getPropertyLabel(buildingClass!, heightProp!);
      expect(heightLabel).to.equal("Hauteur");

      const floorCountLabel = await localization.getPropertyLabel(buildingClass!, floorCountProp!);
      expect(floorCountLabel).to.equal("Floor Count"); // Falls back to original
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

      const provider = new LocalizationProvider(trackingLoader);
      const localization = new SchemaLocalization(provider, "de");

      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaLabel(testProductSchema);
      await localization.getSchemaLabel(testPersonSchema);

      await localization.getSchemaLabel(testBuildingSchema);
      await localization.getSchemaLabel(testProductSchema);
      await localization.getSchemaLabel(testPersonSchema);

      expect(loadCount).to.equal(3);
    });

    it("should fall back to original labels when locale not available for any schema", async () => {
      // French (fr) not provided for any schema
      const localization = new SchemaLocalization(provider, "fr");

      const buildingLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(buildingLabel).to.equal("Test Building Schema");

      const productLabel = await localization.getSchemaLabel(testProductSchema);
      expect(productLabel).to.equal("Test Product Schema");

      const personLabel = await localization.getSchemaLabel(testPersonSchema);
      expect(personLabel).to.equal("Test Person Schema");
    });
  });

  describe("Schema localization with version independence", () => {
    it("should work with schema name only, ignoring version", async () => {
      const testData = new Map<string, SchemaLocalizationJson>();

      // Localization is keyed by schema name only
      const localization1: SchemaLocalizationJson = {
        name: "TestBuilding",
        locale: "de",
        label: "Test-Gebäudeschema",
      };
      testData.set("TestBuilding:de", localization1);

      const provider = new LocalizationProvider(async (schemaName, locale) => {
        return testData.get(`${schemaName}:${locale}`);
      });
      const localization = new SchemaLocalization(provider, "de");
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);

      // Should work regardless of schema version
      expect(schemaLabel).to.equal("Test-Gebäudeschema");
    });
  });

  describe("Localization error handling", () => {
    it("should throw error for invalid localization JSON structure", async () => {
      const loader = async () => {
        return {
          // Missing required fields: schemaName and locale
          label: "Invalid",
        } as any;
      };

      const provider = new LocalizationProvider(loader);
      const localization = new SchemaLocalization(provider, "de");

      await expect(localization.getSchemaLabel(testBuildingSchema)).rejects.toThrow("Invalid localization JSON");
    });

    it("should handle missing localization files gracefully", async () => {
      const loader = async () => {
        return undefined;
      };

      const provider = new LocalizationProvider(loader);
      const localization = new SchemaLocalization(provider, "de");

      // Should fall back to original labels
      const schemaLabel = await localization.getSchemaLabel(testBuildingSchema);
      expect(schemaLabel).to.equal("Test Building Schema");
    });
  });
});

