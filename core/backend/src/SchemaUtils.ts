/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECSchemaXmlContext } from "./ECSchemaXmlContext";
import { IModelHost } from "./IModelHost";

/** Converts EC2 Xml ECSchema(s). On success, the `EC2 Xml schemas` are converted into `EC3.2 Xml schemas`.
 * @param ec2XmlSchemas The EC2 Xml string(s) created from a serialized ECSchema.
 * @returns EC3.2 Xml ECSchema(s).
 * @throws [[IModelError]] if there is a problem converting the EC2 schemas.
 * @beta
 */
export function convertEC2SchemasToEC3Schemas(ec2XmlSchemas: string[], schemaContext?: ECSchemaXmlContext): string[] {
  const maybeNativeContext = schemaContext?.nativeContext;
  const ec3XmlSchemas: string[] = IModelHost.platform.SchemaUtility.convertEC2XmlSchemas(ec2XmlSchemas, maybeNativeContext);
  if (ec2XmlSchemas.length === 0)
    throw new IModelError(BentleyStatus.ERROR, "Error converting EC2 Xml schemas");

  return ec3XmlSchemas;
}

/** Converts schema metadata to EC3 concepts by traversing custom attributes of the supplied schema and calling converters based on schemaName:customAttributeName
 * @param xmlSchemas The ECSchema Xml string(s).
 * @returns EC3.2 Xml ECSchema(s) with converted custom attributes.
 * @throws [[IModelError]] if there is a problem converting the custom attributes of a schema.
 * @beta
 */
export function upgradeCustomAttributesToEC3(xmlSchemas: string[], schemaContext?: ECSchemaXmlContext): string[] {
  const maybeNativeContext = schemaContext?.nativeContext;
  const schemasWithConvertedCA: string[] = IModelHost.platform.SchemaUtility.convertCustomAttributes(xmlSchemas, maybeNativeContext);
  if (schemasWithConvertedCA.length === 0)
    throw new IModelError(BentleyStatus.ERROR, "Error converting custom attributes of Xml schemas");

  return schemasWithConvertedCA;
}
