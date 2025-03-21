/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */
import { BeUiEvent } from "@itwin/core-bentley";
import { FormatProps, FormatsProvider } from "./Formatter/Interfaces";
import { AEC_UNITS_KOQ } from "./Defaults";
import { formatStringRgx } from "./Formatter/FormatEnums";

type ExtendedFormatProps = FormatProps & {
  label?: string;
}

export class BasicFormatsProvider implements FormatsProvider {

  constructor() {
  }

  public onFormatsUpdated = new BeUiEvent<string[]>();
  public getFormat(id: string): FormatProps | undefined {
    return DEFAULT_FORMATS[id] as FormatProps | undefined;
  }

  public getFormats(ids?: string[]): FormatProps[] {
    if (ids)
      return ids.map((id) => this.getFormat(id)).filter((format) => format !== undefined);
    return Object.keys(DEFAULT_FORMATS).map((key) => this.getFormat(key)!); // Get all default formats otherwise.
  }

  public addFormat(id: string, format: ExtendedFormatProps): void {
    if (this.getFormat(id))
      throw new Error(`Format with id ${id} already exists.`);
    DEFAULT_FORMATS[id] = format;
    this.onFormatsUpdated.emit([id]);
  }

  public getFormatByKindOfQuantity(kindOfQuantityId: string): FormatProps | undefined {
    const koqProps = AEC_UNITS_KOQ[kindOfQuantityId];
    if (!koqProps)
      return undefined;
    const extraProps = parseFormatString(koqProps.presentationUnit);

    const formatId = extraProps.name.split(".")[1]; // Omit the schema name for now.
    const format = this.getFormat(formatId);

    if (!format) {
      return undefined;
    }

    return {
      ...format,
      precision: extraProps.precision ?? format.precision,
      composite: extraProps.unitAndLabels ? {
        ...format.composite,
        units: extraProps.unitAndLabels.map(([unitName, unitLabel]) => ({
          name: unitName,
          label: unitLabel ?? undefined,
        })),
      } : format.composite,
    };
  }
}

// TODO: Replace with ecschema-metadata OverrideFormatProps once packages are combined.
interface OverrideFormatProps {
  name: string;
  precision?: number;
  unitAndLabels?: Array<[string, string | undefined]>; // Tuple of [unit name | unit label]
}

// TODO: Replace with ecschema-metadata OverrideFormat.parseFormatString() once packages are combined.
function parseFormatString(formatString: string): OverrideFormatProps{
  const match = formatString.split(formatStringRgx);

  if (undefined === match[1])
    throw new Error(`The format string, ${formatString}, on KindOfQuantity is missing a format.`);

  const returnValue: OverrideFormatProps = { name: match[1] };

  if (undefined !== match[2] && undefined !== match[3]) {
    const overrideString = match[2];
    const tokens: string[] = [];
    let prevPos = 1; // Initial position is the character directly after the opening '(' in the override string.
    let currPos;

    // TODO need to include `,` as a valid search argument.
    while (-1 !== (currPos = overrideString.indexOf(")", prevPos))) {
      tokens.push(overrideString.substring(prevPos, currPos));
      prevPos = currPos + 1;
    }

    if (overrideString.length > 0 && undefined === tokens.find((token) => {
      return "" !== token; // there is at least one token that is not empty.
    })) {
      throw new Error(`Invalid format string`);
    }

    // The first override parameter overrides the default precision of the format
    const precisionIndx: number = 0;

    if (tokens.length >= precisionIndx + 1) {
      if (tokens[precisionIndx].length > 0) {
        const precision = Number.parseInt(tokens[precisionIndx], 10);
        if (Number.isNaN(precision))
          throw new Error(`The format string '${formatString}' on KindOfQuantity has a precision override '${tokens[precisionIndx]}' that is not number.`);
        returnValue.precision = precision;
      }
    }
  }

  let i = 4;
  while (i < match.length - 1) {  // The regex match ends with an empty last value, which causes problems when exactly 4 unit overrides as specified, so ignore this last empty value
    if (undefined === match[i])
      break;
    // Unit override required
    if (undefined === match[i + 1])
      throw new Error(`Invalid format string`);

    if (undefined === returnValue.unitAndLabels)
      returnValue.unitAndLabels = [];

    if (undefined !== match[i + 2]) // matches '|'
      returnValue.unitAndLabels.push([match[i + 1], match[i + 3] ?? ""]); // add unit name and label override (if '|' matches and next value is undefined, save it as an empty string)
    else
      returnValue.unitAndLabels.push([match[i + 1], undefined]); // add unit name

    i += 4;
  }

  return returnValue;
}

/* eslint-disable @typescript-eslint/naming-convention */
const DEFAULT_FORMATS: { [typeName: string]: FormatProps & { label? : string } } = {
  "AmerFI": {
    label: "FeetInches",
    type: "Fractional",
    precision: 8,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ],
    uomSeparator: "",
    composite: {
      includeZero: true,
      spacer: "",
      units: [
        {
          label: "'",
          name: "Units.FT"
        },
        {
          label: "\"",
          name: "Units.IN"
        }
      ]
    }
  },
  "AmerI": {
    label: "Inches",
    type: "Fractional",
    precision: 8,
    formatTraits: [
      "keepSingleZero",
      "showUnitLabel"
    ],
    uomSeparator: "",
    composite: {
      includeZero: true,
      spacer: "",
      units: [
        {
          label: "\"",
          name: "Units.IN"
        }
      ]
    }
  },
  "AngleDMS": {
    label: "DegreesMinutesSeconds",
    type: "Decimal",
    precision: 4,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ],
    uomSeparator: "",
    composite: {
      includeZero: true,
      spacer: "",
      units: [
        {
          label: "°",
          name: "Units.ARC_DEG"
        },
        {
          label: "'",
          name: "Units.ARC_MINUTE"
        },
        {
          label: "\"",
          name: "Units.ARC_SECOND"
        }
      ]
    }
  },
  "DefaultReal": {
    label: "real",
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint"
    ]
  },
  "DefaultRealU": {
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ]
  },
  "DefaultRealUNS": {
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ],
    uomSeparator: ""
  },
  "Fractional": {
    type: "Fractional",
    precision: 64,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint"
    ]
  },
  "HMS": {
    label: "HoursMinutesSeconds",
    type: "Decimal",
    precision: 2,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ],
    composite: {
      includeZero: true,
      units: [
        {
          label: "hour(s)",
          name: "Units.HR"
        },
        {
          label: "min",
          name: "Units.MIN"
        },
        {
          label: "sec",
          name: "Units.S"
        }
      ]
    }
  },
  "StationZ_1000_3": {
    type: "Station",
    stationOffsetSize: 3,
    precision: 2,
    formatTraits: [
      "trailZeroes",
      "keepSingleZero",
      "keepDecimalPoint"
    ],
    minWidth: 3
  },
  "StationZ_100_2": {
    type: "Station",
    stationOffsetSize: 2,
    precision: 2,
    formatTraits: [
      "trailZeroes",
      "keepSingleZero",
      "keepDecimalPoint"
    ],
    minWidth: 2
  }
};
