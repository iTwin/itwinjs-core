/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSQL
 */

/** @public */
export interface ECSchemaReferenceProps {
  readonly name: string;
  readonly version: string;
}

/** @public */
export interface ECSchemaItemProps {
  readonly $schema?: string;
  readonly schema?: string;
  readonly schemaVersion?: string;
  readonly name?: string;
  readonly schemaItemType?: string;
  readonly label?: string;
  readonly description?: string;
  readonly customAttributes?: Array<{ [value: string]: any }>;
}

/** Properties of an ECSchema
 *  @public
 */
export interface ECSchemaProps {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly alias: string;
  readonly label?: string;
  readonly description?: string;
  readonly references?: ECSchemaReferenceProps[];
  readonly items?: { [name: string]: ECSchemaItemProps };
  readonly customAttributes?: Array<{ [value: string]: any }>;
}
