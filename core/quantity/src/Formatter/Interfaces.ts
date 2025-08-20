/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { BeEvent } from "@itwin/core-bentley";
import { UnitProps } from "../Interfaces";
import { DecimalPrecision, FormatTraits, FormatType, FractionalPrecision } from "./FormatEnums";

/** [[FormatProps.composite]] lacks documentation, please add a description here of what this represents.
 * @beta
 */
export interface FormatCompositeProps {
  /** separates values when formatting composite strings */
  readonly spacer?: string;
  readonly includeZero?: boolean;
  readonly units: Array<{
    readonly name: string;
    readonly label?: string;
  }>;
}

/** This interface defines the persistence format for describing the formatting of quantity values.
 * @beta
 */
export interface FormatProps {
  readonly type: string;
  readonly precision?: number;
  readonly roundFactor?: number;
  readonly minWidth?: number;
  readonly showSignOption?: string;
  readonly formatTraits?: string | string[];
  readonly decimalSeparator?: string;
  readonly thousandSeparator?: string;
  readonly uomSeparator?: string;

  /** conditionally required. */
  readonly scientificType?: string;

  /** conditionally required. */
  readonly ratioType?: string;

  /** conditionally required. */
  readonly stationOffsetSize?: number;
  readonly stationSeparator?: string;

  /** Optional base factor for station formatting. A positive integer, defaults to 1. */
  readonly stationBaseFactor?: number;

  /** The base value for azimuth, specified from east counter-clockwise. */
  readonly azimuthBase?: number;

  /** The name of the unit for the azimuth base value. */
  readonly azimuthBaseUnit?: string;

  /** If set to true, azimuth values are returned counter-clockwise from the base. */
  readonly azimuthCounterClockwise?: boolean;

  /** The name of the unit that represents a revolution/perigon. Required for bearing or azimuth types. */
  readonly revolutionUnit?: string;

  readonly allowMathematicOperations?: boolean;
  readonly composite?: FormatCompositeProps;
}

/** This interface is used when supporting Custom Formatters that need more than the standard set of properties.
 * @beta
 */
export interface CustomFormatProps extends FormatProps {
  readonly custom: any;
}

/** CustomFormatProps type guard.
 * @beta
 */
export const isCustomFormatProps = (item: FormatProps): item is CustomFormatProps => {
  return (item as CustomFormatProps).custom !== undefined;
};

/** A [[FormatCompositeProps]] with unit names replaced with JSON representations of those units.
 * @beta
 */
export type ResolvedFormatCompositeProps = Omit<FormatCompositeProps, "units"> & {
  readonly units: Array<{
    readonly unit: UnitProps;
    readonly label?: string;
  }>;
}

/** A [[FormatProps]] with all the references to units replaced with JSON representations of those units.
 * @beta
 */
export type ResolvedFormatProps = Omit<FormatDefinition, "azimuthBaseUnit" | "revolutionUnit" | "composite"> & {
  readonly azimuthBaseUnit?: UnitProps;
  readonly revolutionUnit?: UnitProps;
  readonly composite?: ResolvedFormatCompositeProps;
  readonly custom?: any;
}

/** CloneFormat defines unit and label specification if primary unit is to be set during clone.
 * @beta
 */
export interface CloneUnit {
  unit?: UnitProps;
  label?: string;
}

/** CloneOptions that define modifications that can be made during the cloning of a Format.
 * @beta
 */
export interface CloneOptions {
  /** allows composite formats to be converted to only show primary unit */
  showOnlyPrimaryUnit?: boolean;
  /** allow format traits to be set */
  traits?: FormatTraits;
  /** allows new FormatType to be specified */
  type?: FormatType;
  /** allows precision to be set, this will throw if value is not valid for FormatType */
  precision?: DecimalPrecision | FractionalPrecision;
  /** allows primary unit and label to be specified */
  primaryUnit?: CloneUnit;
}

/** An extension of FormatProps to help identify formats.
 * @beta
 */
export interface FormatDefinition extends FormatProps {
  readonly name?: string;
  readonly label?: string;
  readonly description?: string;
}

/** Argument for [[FormatsProvider.onFormatsChanged]]
 * @beta
 */
export interface FormatsChangedArgs {
  /**
   * If `all` - all formats within the `FormatsProvider` have changed.
   * If array, the array items list the names of formats that were changed or removed.
   */
  formatsChanged: "all" | string[];
}

/** This interface is implemented by a class that would provide formats for use in formatting quantities.
 * @beta
 */
export interface FormatsProvider {
  /**
   * @param name The full name of the Format or KindOfQuantity.
   */
  getFormat(name: string): Promise<FormatDefinition | undefined>;

  onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void>;
}

/** This interface is implemented by a class that would provide and allow creating formats for use in formatting quantities.
 * @beta
 */
export interface MutableFormatsProvider extends FormatsProvider {
  addFormat(name: string, format: FormatDefinition): Promise<void>;
  removeFormat(name: string): Promise<void>;
}
