/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { BentleyStatus, IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECSchemaXmlContext } from "./ECSchemaXmlContext";
import { IModelNative } from "./internal/NativePlatform";

export function summarizeSchemaSources(schemaSources?: readonly string[]): string {
  if (!schemaSources || schemaSources.length === 0) {
    return "not specified";
  }
  if (schemaSources?.length <= 3) {
    return schemaSources.join(", ");
  }
  return `${schemaSources.length} schema files`;
}

export class SchemaImportError extends IModelError {
  public constructor (
    stage: string,
    schemaSources: readonly string[] | undefined,
    nativeErr: { errorNumber?: number; message?: string } | Error,
    errorNumber: number = IModelStatus.BadSchema,
    summaryOverride?: string,
  ) {
    const fromNative = nativeErr as { errorNumber?: number; message?: string };
    const actualErrorNumber = fromNative?.errorNumber ?? errorNumber;
    const nativeMessage = fromNative?.message ?? (nativeErr instanceof Error ? nativeErr.message : "");
    const schemaSummary = summaryOverride ?? summarizeSchemaSources(schemaSources);
    const base = `Schema import failed while ${stage}.`;
    const schemaPart = `Schema(s): ${schemaSummary}.`;
    const message = nativeMessage ? `${base} ${schemaPart} ${nativeMessage}` : `${base} ${schemaPart}`;
    super(actualErrorNumber, message);
  }
}

/** Converts EC2 Xml ECSchema(s). On success, the `EC2 Xml schemas` are converted into `EC3.2 Xml schemas`.
 * @param ec2XmlSchemas The EC2 Xml string(s) created from a serialized ECSchema.
 * @returns EC3.2 Xml ECSchema(s).
 * @throws [[IModelError]] if there is a problem converting the EC2 schemas.
 * @beta
 */
export function convertEC2SchemasToEC3Schemas(ec2XmlSchemas: string[], schemaContext?: ECSchemaXmlContext): string[] {
  const maybeNativeContext = schemaContext?.nativeContext;
  const ec3XmlSchemas: string[] = IModelNative.platform.SchemaUtility.convertEC2XmlSchemas(ec2XmlSchemas, maybeNativeContext);
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
  const schemasWithConvertedCA: string[] = IModelNative.platform.SchemaUtility.convertCustomAttributes(xmlSchemas, maybeNativeContext);
  if (schemasWithConvertedCA.length === 0)
    throw new IModelError(BentleyStatus.ERROR, "Error converting custom attributes of Xml schemas");

  return schemasWithConvertedCA;
}
