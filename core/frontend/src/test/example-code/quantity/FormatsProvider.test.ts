import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { Format, FormatDefinition, FormatsChangedArgs, FormatterSpec, MutableFormatsProvider, ParsedQuantity, ParserSpec } from "@itwin/core-quantity";
import { FormatSet, FormatSetFormatsProvider, KindOfQuantity, Schema, SchemaContext, SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Mutable_Formats_Provider
/**
 * Implements a formats provider with a cache, to allow adding/removing formats at runtime.
 */
class ExampleFormatProvider implements MutableFormatsProvider {
  private _cache: Map<string, FormatDefinition> = new Map();
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    return this._cache.get(name);
  }

  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._cache.set(name, format);
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name]});
  }
  public async removeFormat(name: string): Promise<void> {
    this._cache.delete(name);
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name]});
  }
}
// __PUBLISH_EXTRACT_END__

describe("FormatsProvider examples", () => {
  let schemaContext: SchemaContext;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });

    schemaContext = new SchemaContext();

    // Load schemas via fetch (browser-compatible) in dependency order
    const unitsJson = await (await fetch("/assets/schemas/Units.ecschema.json")).json();
    await Schema.fromJson(unitsJson, schemaContext);

    const formatsJson = await (await fetch("/assets/schemas/Formats.ecschema.json")).json();
    await Schema.fromJson(formatsJson, schemaContext);

    const aecUnitsJson = await (await fetch("/assets/schemas/AecUnits.ecschema.json")).json();
    await Schema.fromJson(aecUnitsJson, schemaContext);
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("SchemaFormatsProvider Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    // No unit system was provided, and no format was found in the cache so the method will return the first presentation format for the KoQ, which uses meters.
    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50); // The persistence unit is meters, so this input value is 50 m.
    // result in formatted value of 50 m
    // __PUBLISH_EXTRACT_END__

    expect(result).toBe("50.0 m");
  });

  it("SchemaFormatsProvider Formatting with Unit System provided", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Formatting_With_Unit_System
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    formatsProvider.unitSystem = "imperial"; // This will cause the method to return the first presentation format for the KoQ that uses imperial units.
    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50); // The persistence unit is meters, so this input value is 50 m.
    // result in formatted value of 164'0 1/2"
    // __PUBLISH_EXTRACT_END__

    expect(result).toBe("164'0 1/2\"");
  });

  it("SchemaFormatsProvider Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Formats_Provider_Simple_Parsing
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");

    const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);
    const result = parserSpec.parseToQuantityValue("50 km");
    // result.value 50000  (value in meters)
    // __PUBLISH_EXTRACT_END__

    expect((result as ParsedQuantity).value).toBe(50000);
  });

  it("adding a format", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Mutable_Formats_Provider_Adding_A_Format
    const formatsProvider = new ExampleFormatProvider();
    const format: FormatDefinition = {
      label: "NewFormat",
      type: "Fractional",
      precision: 8,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      uomSeparator: "",
    };
    await formatsProvider.addFormat("DefaultToolsUnits.LENGTH", format);
    const retrievedFormat = await formatsProvider.getFormat("DefaultToolsUnits.LENGTH");
    // retrievedFormat is the format we just added.
    // __PUBLISH_EXTRACT_END__

    expect(retrievedFormat).toBe(format);
  });

  it("using a KindOfQuantity to retrieve the persistenceUnit, and format", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.KindOfQuantityPersistenceUnitFormatting
    const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const kindOfQuantityName = "AecUnits.LENGTH";
    // Get the format definition, for this example it'll return the value in meters, 4 decimal places.
    const formatDef = await formatsProvider.getFormat(kindOfQuantityName);
    if (!formatDef)
      throw new Error(`Format not found for ${kindOfQuantityName}`);

    const kindOfQuantity = await schemaContext.getSchemaItem(kindOfQuantityName, KindOfQuantity);
    if (!kindOfQuantity)
      throw new Error(`KindOfQuantity not found for ${kindOfQuantityName}`);

    const persistenceUnit = kindOfQuantity.persistenceUnit;
    if (!persistenceUnit)
      throw new Error(`Persistence unit not found for ${kindOfQuantityName}`);

    const persistenceUnitProps = await unitsProvider.findUnitByName(persistenceUnit.fullName);

    const format = await Format.createFromJSON(formatDef.name ?? "", unitsProvider, formatDef);
    const formatterSpec = await FormatterSpec.create(
    formatDef.name ?? "",
    format,
    unitsProvider, // Use a schema units provider
    persistenceUnitProps
    );

    const _formattedValue = formatterSpec.applyFormatting(123.44445); // Returns "123.4445 m"
    // __PUBLISH_EXTRACT_END__
    expect(_formattedValue).toBe("123.4445 m");
  });

  it("FormatSetFormatsProvider with string references", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.FormatSet_Formats_Provider_With_String_References
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");

    // Create a format set with a base format and string references
    const formatSet = {
      name: "MyFormatSet",
      label: "My Custom Formats",
      unitSystem: "metric" as const,
      formats: {
        // Base format definition
        "CivilUnits.LENGTH": {
          composite: {
            includeZero: true,
            spacer: " ",
            units: [{ label: "m", name: "Units.M" }]
          },
          formatTraits: ["keepSingleZero", "showUnitLabel"],
          precision: 2,
          type: "Decimal"
        } as FormatDefinition,
        // DISTANCE references LENGTH via string
        "DefaultToolsUnits.LENGTH": "CivilUnits.LENGTH",
      }
    };

    // Create the provider
    const formatsProvider = new FormatSetFormatsProvider({ formatSet });

    // Getting DefaultToolsUnits.LENGTH resolves to the CivilUnits.LENGTH format definition
    const lengthFormat = await formatsProvider.getFormat("DefaultToolsUnits.LENGTH");
    const format = await Format.createFromJSON("length", unitsProvider, lengthFormat!);
    const formatSpec = await FormatterSpec.create("LengthSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(42.567);
    // result is "42.57 m"
    // __PUBLISH_EXTRACT_END__

    expect(result).toBe("42.57 m");
  });

  it("on IModelConnection open, register schema formats provider", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Schema_Fmt_Provider_on_IModelConnection_Open
    const removeIModelConnectionListener = IModelConnection.onOpen.addListener((iModel: IModelConnection) => {
      if (iModel.isBlankConnection()) return; // Don't register on blank connections.

      const schemaFormatsProvider = new SchemaFormatsProvider(iModel.schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
      const removeUnitSystemListener = IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener((args) => {
        schemaFormatsProvider.unitSystem = args.system;
      });

      iModel.onClose.addOnce(() => {
        removeUnitSystemListener();
      });
      IModelApp.formatsProvider = schemaFormatsProvider;
    });

    IModelConnection.onClose.addOnce(() => {
      removeIModelConnectionListener();
      IModelApp.resetFormatsProvider();
    });
    // __PUBLISH_EXTRACT_END__
  });

  it("register FormatSetFormatsProvider to IModelApp", async () => {
    const unitsProvider = new SchemaUnitProvider(schemaContext);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
    // Helper function for the example
    async function loadFormatSetFromPreferences() {
      return {
        name: "UserPreferences",
        label: "User Format Preferences",
        unitSystem: "metric" as const,
        formats: {
          "CivilUnits.LENGTH": {
            composite: {
              includeZero: true,
              spacer: " ",
              units: [{ label: "m", name: "Units.M" }]
            },
            formatTraits: ["keepSingleZero", "showUnitLabel"],
            precision: 2,
            type: "Decimal"
          } as FormatDefinition,
        }
      };
    }

    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Register_FormatSet_Formats_Provider
    // This example, assume the application has a way to load format preferences from a remote source..
    const retrievedFormatSet: FormatSet = await loadFormatSetFromPreferences();

    // Create provider with optional fallback
    const fallbackProvider = new SchemaFormatsProvider(schemaContext, IModelApp.quantityFormatter.activeUnitSystem);
    IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener((args) => {
        fallbackProvider.unitSystem = args.system;
    });
    const formatSetProvider = new FormatSetFormatsProvider({ formatSet: retrievedFormatSet, fallbackProvider });
    // Register with IModelApp
    IModelApp.formatsProvider = formatSetProvider;

    // __PUBLISH_EXTRACT_END__
    const lengthFormat = await IModelApp.formatsProvider.getFormat("CivilUnits.LENGTH");
    const format = await Format.createFromJSON("length", unitsProvider, lengthFormat!);
    const formatSpec = await FormatterSpec.create("LengthSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(42.567);
    expect(result).toBe("42.57 m");
  });
});
