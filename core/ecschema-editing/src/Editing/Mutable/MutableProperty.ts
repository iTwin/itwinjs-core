/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, ECName, LazyLoadedPropertyCategory, Property } from "@itwin/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableProperty extends Property {
  public abstract override setName(name: ECName): void;
  public abstract override setDescription(description: string): void;
  public abstract override setLabel(label: string): void;
  public abstract override setIsReadOnly(isReadOnly: boolean): void;
  public abstract override setPriority(priority: number): void;
  public abstract override setCategory(category: LazyLoadedPropertyCategory): void;
  public abstract override addCustomAttribute(customAttribute: CustomAttribute): void;
}
