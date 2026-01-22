/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, IModelConnection, QuantityType } from "@itwin/core-frontend";
import { SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";

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
  const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
  await IModelApp.quantityFormatter.setUnitsProvider(new SchemaUnitProvider(schemaLocater));
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Quantity_Formatting.IModelConnection_OnOpen_Registration
/** Register SchemaUnitProvider automatically when IModelConnection opens */
export function setupIModelConnectionListener() {
  IModelConnection.onOpen.addListener(async (iModelConnection: IModelConnection) => {
    const schemaLocater = new ECSchemaRpcLocater(iModelConnection);
    await IModelApp.quantityFormatter.setUnitsProvider(new SchemaUnitProvider(schemaLocater));
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
