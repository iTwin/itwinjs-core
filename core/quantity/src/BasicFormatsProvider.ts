/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FormatProps, FormatsProvider } from "./Formatter/Interfaces";

export class BasicFormatsProvider implements FormatsProvider {
  constructor() {
  }
  public getFormat(id: string): FormatProps | undefined {
    return DEFAULT_FORMATS[id] as FormatProps | undefined;
  }

  public getFormats(ids?: string[]): FormatProps[] {
    if (ids)
      return ids.map((id) => this.getFormat(id)).filter((format) => format !== undefined);
    return Object.keys(DEFAULT_FORMATS).map((key) => this.getFormat(key)!); // Get all default formats otherwise.
  }
}

/* eslint-disable @typescript-eslint/naming-convention */
const DEFAULT_FORMATS: { [typeName: string]: object } = {
  AmerFI: {
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
  AmerI: {
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
  AngleDMS: {
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
  DefaultReal: {
    label: "real",
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint"
    ]
  },
  DefaultRealU: {
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ]
  },
  DefaultRealUNS: {
    type: "Decimal",
    precision: 6,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint",
      "showUnitLabel"
    ],
    uomSeparator: ""
  },
  Fractional: {
    type: "Fractional",
    precision: 64,
    formatTraits: [
      "keepSingleZero",
      "keepDecimalPoint"
    ]
  },
  HMS: {
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
  StationZ_1000_3: {
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
  StationZ_100_2: {
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
