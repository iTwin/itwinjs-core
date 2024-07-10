/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, CustomAttributeContainerType } from "@itwin/ecschema-metadata";

/**
 * @internal
 * An abstract class used for Schema editing.
 */
export abstract class MutableCAClass extends CustomAttributeClass {
  public abstract override setAppliesTo(containerType: CustomAttributeContainerType): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
