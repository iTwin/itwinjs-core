/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** This interface defines the persistence format for defining the format of quantity values.
 * @alpha
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
  readonly scientificType?: string; // conditionally required
  readonly stationOffsetSize?: number; // conditionally required
  readonly stationSeparator?: string;
  readonly composite?: {
    readonly spacer?: string;
    readonly includeZero?: boolean; // not currently used in Native formatter
    readonly units: Array<{
      readonly name: string;
      readonly label?: string;
    }>;
  };
}

/** This interface is used when supporting Custom Formatters that need more than the standard set of properties.
 * @alpha
 */
export interface CustomFormatProps extends FormatProps{
  readonly custom: any;
}

/** CustomFormatProps type guard.
 * @alpha
 */
export const isCustomFormatProps = (item: FormatProps): item is CustomFormatProps => {
  return (item as CustomFormatProps).custom !== undefined;
};
