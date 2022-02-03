/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Comparison
 */

import type { ISchemaChanges } from "./SchemaChanges";

/**
 * Interface for reporting ISchemaChanges objects.
 * @alpha
 */
export interface ISchemaCompareReporter {
  report(schemaChanges: ISchemaChanges): void;
}
