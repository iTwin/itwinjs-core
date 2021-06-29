/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, LazyLoadedPhenomenon } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableConstant extends Constant {
  public abstract setPhenomenon(phenomenon: LazyLoadedPhenomenon): void;
  public abstract setDefinition(definition: string): void;
  public abstract setNumerator(numerator: number): void;
  public abstract setDenominator(denominator: number): void;
  public abstract setDisplayLabel(displayLabel: string): void;
}
