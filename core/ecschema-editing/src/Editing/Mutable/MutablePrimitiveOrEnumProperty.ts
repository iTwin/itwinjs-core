/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PrimitiveOrEnumPropertyBase } from "@itwin/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutablePrimitiveOrEnumPropertyBase extends PrimitiveOrEnumPropertyBase {
  public abstract override setExtendedTypeName(extendedTypeName: string): void;
  public abstract override setMinLength(minLength: number): void;
  public abstract override setMaxLength(maxLength: number): void;
  public abstract override setMinValue(minValue: number): void;
  public abstract override setMaxValue(maxValue: number): void;
}
