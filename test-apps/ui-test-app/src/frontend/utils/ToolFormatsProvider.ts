/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ToolFormatsProvider, ToolFormatType } from "@bentley/imodeljs-frontend";
import { UnitProps, UnitsProvider, Format } from "@bentley/imodeljs-quantity";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { AppUnitsProvider } from "./UnitsProvider";

// The following is for sample application only and the units referenced must be provided by UnitsProvider
const defaultsFormats = {
  metric: [{
    type: 1/*Length*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 2/*Angle*/, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3/*Area*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m²",
            name: "Units.SQ_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4/*Volume*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m³",
            name: "Units.CUB_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
  imperial: [{
    type: 1/*Length*/, format: {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    },
  }, {
    type: 2/*Angle*/, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3/*Area*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft²",
            name: "Units.SQ_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4/*Volume*/, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft³",
            name: "Units.CUB_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
};

export class AppToolFormatsProvider extends ToolFormatsProvider {
  private _imperialFormatsByType = new Map<ToolFormatType, Format>();
  private _metricFormatsByType = new Map<ToolFormatType, Format>();
  private _activeSystemIsImperial = true;
  public unitsProvider: UnitsProvider = new AppUnitsProvider();

  public useImperialFormats(useImperial: boolean): void {
    this._activeSystemIsImperial = useImperial;
  }

  private async loadStdFormat(type: ToolFormatType, imperial: boolean): Promise<Format> {
    let formatData: any;

    const formatArray = imperial ? defaultsFormats.imperial : defaultsFormats.metric;
    for (const entry of formatArray) {
      if (entry.type === type as number) {
        formatData = entry.format;
        const format = new Format("stdFormat", this.unitsProvider);
        await format.fromJson(formatData);
        return Promise.resolve(format);
      }
    }
    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  private async getStdFormat(type: ToolFormatType, imperial: boolean): Promise<Format> {
    const activeMap = imperial ? this._imperialFormatsByType : this._metricFormatsByType;

    let format = activeMap.get(type);
    if (format)
      return Promise.resolve(format);

    format = await this.loadStdFormat(type, imperial);
    if (format) {
      activeMap.set(type, format);
      return Promise.resolve(format);
    }

    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  public getStandardFormat(type: ToolFormatType): Promise<Format> {
    return this.getStdFormat(type, this._activeSystemIsImperial);
  }

  public getStandardUnit(type: ToolFormatType): Promise<UnitProps> {
    switch (type) {
      case ToolFormatType.Angle:
        return this.unitsProvider.findUnitByName("Units.RAD");
      case ToolFormatType.Area:
        return this.unitsProvider.findUnitByName("Units.SQ_M");
      case ToolFormatType.Volume:
        return this.unitsProvider.findUnitByName("Units.M");
      case ToolFormatType.Length:
      default:
        return this.unitsProvider.findUnitByName("Units.M");
    }
  }
}
