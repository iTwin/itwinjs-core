/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ISchemaChanges } from "./SchemaChanges";

/**
 * Interface for reporting ISchemaChanges objects.
 * @alpha
 */
export interface ISchemaCompareReporter {
  report(schemaChanges: ISchemaChanges): void;
}
