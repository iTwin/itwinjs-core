/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SchemaUtility
 */

import { IModelJsNative } from "@bentley/imodeljs-native";
import { BentleyStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ECSchemaXmlContext } from "./ECSchemaXmlContext";

/**
 * Utility class for EC Schemas
 */
export class SchemaUtility {
  /** Convert EC2 XML ECSchema(s). On success, the EC2.0 schemas are converted into EC3.2 schemas.
   * @param ec2XmlSchemas The EC2 XML string(s) created from a serialized ECSchema.
   * @returns EC3.2 XML ECSchema(s).
   * @throws [[IModelError]] if there is a problem converting the EC2.0 schemas.
   * @alpha
   */
  public convertEc2SchemaStrings(ec2XmlSchemas: string[], schemaContext?: ECSchemaXmlContext): string[] {
    const maybeNativeContext = schemaContext?.nativeContext;
    const ec3XmlSchemas: string[] = IModelJsNative.SchemaUtility.convertEC2XmlSchemas(ec2XmlSchemas, maybeNativeContext);
    if (ec2XmlSchemas.length === 0)
      throw new IModelError(BentleyStatus.ERROR, "Error converting ec2 Xml schema(s)");

    return ec3XmlSchemas;
  }
}
