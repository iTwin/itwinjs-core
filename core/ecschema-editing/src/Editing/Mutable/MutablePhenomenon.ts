/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutablePhenomenon extends Phenomenon {
  public abstract setDefinition(definition: string): Promise<void>;
  public abstract setDisplayLabel(displayLabel: string): void;
}
