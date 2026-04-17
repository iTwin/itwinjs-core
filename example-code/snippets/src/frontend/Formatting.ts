/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, QuantityType } from "@itwin/core-frontend";
import { createUnitsProvider } from "@itwin/core-quantity";
import { SchemaUnitProvider } from "@itwin/ecschema-metadata";

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Unit_System_Configuration
/** Configure the unit system for the QuantityFormatter */
export async function configureUnitSystem() {
  // Set the active unit system (metric, imperial, usCustomary, or usSurvey)
  await IModelApp.quantityFormatter.setActiveUnitSystem("metric");
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Alternate_Unit_Labels
/** Add alternate unit labels for easier input during parsing */
export function addAlternateUnitLabels() {
  // Use "^" as an alternate label for degrees
  IModelApp.quantityFormatter.addAlternateLabels("Units.ARC_DEG", "^");
  // Add alternate labels for feet
  IModelApp.quantityFormatter.addAlternateLabels("Units.FT", "feet", "foot");
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.SchemaUnitProvider_Registration
/** Register SchemaUnitProvider when IModelConnection is opened */
export async function registerSchemaUnitProvider(iModelConnection: IModelConnection) {
  // Wrap SchemaUnitProvider with createUnitsProvider so basic BIS units fill any gaps
  await IModelApp.quantityFormatter.setUnitsProvider(
    createUnitsProvider({ primary: new SchemaUnitProvider(iModelConnection.schemaContext) }),
  );
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.IModelConnection_OnOpen_Registration
/** Register SchemaUnitProvider automatically when IModelConnection opens */
export function setupIModelConnectionListener() {
  IModelConnection.onOpen.addListener(async (iModelConnection: IModelConnection) => {
    await IModelApp.quantityFormatter.setUnitsProvider(
      createUnitsProvider({ primary: new SchemaUnitProvider(iModelConnection.schemaContext) }),
    );
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.MeasureDistanceTool_Formatting
/** Example of formatting a distance value for MeasureDistanceTool */
export function formatDistance(totalDistance: number): string | undefined {
  const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
  if (undefined === formatterSpec)
    return undefined;

  // Format the distance value (in meters) according to the current unit system
  const formattedTotalDistance = IModelApp.quantityFormatter.formatQuantity(totalDistance, formatterSpec);
  return formattedTotalDistance;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.MeasureLocationTool_Parsing
/** Example of parsing an angle string for MeasureLocationTool */
export function parseAngle(inString: string): number | undefined {
  const parserSpec = IModelApp.quantityFormatter.findParserSpecByQuantityType(QuantityType.Angle);
  if (!parserSpec)
    return undefined;

  // Parse the input string (e.g., "24^34.5'") into radians
  const parseResult = parserSpec.parseToQuantityValue(inString);
  return parseResult.ok ? parseResult.value : undefined;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.Math_Operations_Enablement
/** Enable mathematical operations parsing for a quantity type */
export async function enableMathematicalOperations() {
  const quantityType = QuantityType.LengthEngineering;

  // Get default format props for the quantity type
  const props = IModelApp.quantityFormatter.getFormatPropsByQuantityType(quantityType);

  // Ensure required properties are defined
  if (!props || !props.type)
    return;

  // Override the formatter to enable mathematical operations
  await IModelApp.quantityFormatter.setOverrideFormat(quantityType, {
    ...props,
    allowMathematicOperations: true,
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.WhenInitialized
/** Wait for the QuantityFormatter to complete its first initialization */
export async function waitForFormatterReady() {
  // Resolves after the first successful initialization; safe to call multiple times
  await IModelApp.quantityFormatter.whenInitialized;

  // Formatting APIs are now safe to use
  const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
  if (formatterSpec) {
    const formatted = IModelApp.quantityFormatter.formatQuantity(1.5, formatterSpec);
    assert(formatted.length > 0);
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.IsReady
/** Check if the QuantityFormatter is ready before formatting */
export function formatIfReady(meters: number): string | undefined {
  if (!IModelApp.quantityFormatter.isReady)
    return undefined; // Formatter not yet initialized

  const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
  if (!formatterSpec)
    return undefined;

  return IModelApp.quantityFormatter.formatQuantity(meters, formatterSpec);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.OnFormattingReady
/** Subscribe to onFormattingReady to refresh UI when formatting changes */
export function subscribeToFormattingReady(updateUI: (formatted: string) => void) {
  const removeListener = IModelApp.quantityFormatter.onFormattingReady.addListener(() => {
    const spec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    if (spec) {
      const formatted = IModelApp.quantityFormatter.formatQuantity(1.5, spec);
      updateUI(formatted);
    }
  });
  // Call removeListener() when the component unmounts
  return removeListener;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.FormatSpecHandle_Basic
/** Create, use, and explicitly dispose a FormatSpecHandle */
export function useFormatSpecHandle() {
  const handle = IModelApp.quantityFormatter.getFormatSpecHandle(
    "DefaultToolsUnits.LENGTH", // KindOfQuantity name
    "Units.M",                  // Persistence unit
  );

  // format() returns a fallback string if specs aren't loaded yet
  const formatted = handle.format(1.5);
  assert(formatted.length > 0);

  // Explicitly dispose when done to unsubscribe from reload events
  handle[Symbol.dispose]();
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.FormatSpecHandle_Using
/** Use a FormatSpecHandle with `using` for automatic disposal */
export function useFormatSpecHandleWithUsing() {
  using handle = IModelApp.quantityFormatter.getFormatSpecHandle(
    "DefaultToolsUnits.LENGTH",
    "Units.M",
  );

  // The handle auto-refreshes when the formatter reloads
  const formatted = handle.format(2.75);
  assert(formatted.length > 0);
  // handle is automatically disposed at end of scope
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.GetSpecsByNameAndUnit
/** Look up formatting specs by KindOfQuantity name and persistence unit */
export function lookupSpecsByNameAndUnit() {
  const entry = IModelApp.quantityFormatter.getSpecsByNameAndUnit({
    name: "DefaultToolsUnits.LENGTH",
    persistenceUnitName: "Units.M",
  });

  if (entry) {
    // Format a value
    const formatted = IModelApp.quantityFormatter.formatQuantity(3.14, entry.formatterSpec);
    assert(formatted.length > 0);

    // Parse a user-entered string
    const result = entry.parserSpec.parseToQuantityValue("3.14 m");
    assert(result.ok && typeof result.value === "number");
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.MultiSystemKoQ
/** Access KoQ format specs for non-active unit systems */
export function formatKoqInMultipleSystems(meters: number) {
  const metricSpec = IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
  const imperialSpec = IModelApp.quantityFormatter.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "imperial" });

  if (metricSpec && imperialSpec) {
    const metricStr = IModelApp.quantityFormatter.formatQuantity(meters, metricSpec.formatterSpec);
    const imperialStr = IModelApp.quantityFormatter.formatQuantity(meters, imperialSpec.formatterSpec);
    assert(metricStr.length > 0 && imperialStr.length > 0);
  }
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.BeforeFormattingReady
/** Register async provider work before formatting is ready */
export function registerAsyncProvider() {
  const removeListener = IModelApp.quantityFormatter.onBeforeFormattingReady.addListener((collector) => {
    collector.addPendingWork(loadAndRegisterDomainFormats());
  });
  // Call removeListener() on teardown to unsubscribe
  return removeListener;
}

async function loadAndRegisterDomainFormats(): Promise<void> {
  // Async loading work here...
  await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({ name: "MyDomain.MyKoQ", persistenceUnitName: "Units.M" });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.SpecProviderIntegration
/**
 * Example: A domain spec provider that registers its KindOfQuantity specs
 * and re-registers them whenever the QuantityFormatter reloads.
 *
 * This is the pattern used by Civil's DisplayUnitFormatter and similar
 * domain-level providers that supply custom formatting specs.
 */
export class MyDomainFormatProvider {
  private _removeListener?: () => void;

  /** KoQ entries this domain provides: [koqName, persistenceUnit] */
  private readonly _domainEntries: Array<[string, string]> = [
    ["MyDomain.PRESSURE", "Units.PA"],
    ["MyDomain.FLOW_RATE", "Units.CUB_M_PER_SEC"],
  ];

  /** Call once during app setup to start listening for reloads */
  public register() {
    // Re-register domain specs before every ready cycle via the collector.
    // The formatter awaits all pending work before emitting onFormattingReady,
    // so downstream consumers see these specs immediately.
    this._removeListener = IModelApp.quantityFormatter.onBeforeFormattingReady.addListener((collector) => {
      collector.addPendingWork(this._registerSpecs());
    });
  }

  /** Call on teardown to stop listening */
  public unregister() {
    this._removeListener?.();
    this._removeListener = undefined;
  }

  private async _registerSpecs() {
    for (const [koqName, persistenceUnit] of this._domainEntries) {
      try {
        await IModelApp.quantityFormatter.addFormattingSpecsToRegistry({ name: koqName, persistenceUnitName: persistenceUnit });
      } catch {
        // KoQ not found in formatsProvider — may not be available in this iModel
      }
    }
  }
}
// __PUBLISH_EXTRACT_END__
