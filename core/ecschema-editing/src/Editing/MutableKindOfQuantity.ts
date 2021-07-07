/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, InvertedUnit, KindOfQuantity, OverrideFormat, Unit } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableKindOfQuantity extends KindOfQuantity {
  public abstract addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean): void;
  public abstract createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat;
  public abstract setDisplayLabel(displayLabel: string): void;
}
