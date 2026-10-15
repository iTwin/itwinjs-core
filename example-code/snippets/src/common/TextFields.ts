/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { FieldRun } from "@itwin/core-common";

// __PUBLISH_EXTRACT_START__ TextFields_JsonAccessors
/** Create a field that displays the `contactInfo.email` value stored in the element's `JsonProperties`. */
export function createJsonPropertiesField(elementId: Id64String): FieldRun {
  return FieldRun.create({
    propertyHost: { elementId, schemaName: "BisCore", className: "PhysicalElement" },
    propertyPath: { propertyName: "JsonProperties", jsonAccessors: ["contactInfo", "email"] },
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ TextFields_NestedJsonAccessors
/** Create a field whose JSON property is reached through a struct member.
 * `accessors` walks the EC properties to the `Json`-typed string property; `jsonAccessors` then walks the parsed JSON.
 */
export function createNestedJsonField(elementId: Id64String): FieldRun {
  return FieldRun.create({
    propertyHost: { elementId, schemaName: "MySchema", className: "Person" },
    propertyPath: {
      propertyName: "spouse",
      accessors: ["jsonProperties"],
      jsonAccessors: ["phoneNumbers", 0, "areaCode"],
    },
  });
}
// __PUBLISH_EXTRACT_END__
