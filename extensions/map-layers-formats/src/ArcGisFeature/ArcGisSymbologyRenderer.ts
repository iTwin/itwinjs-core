/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice. 
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSimpleRenderer, EsriSLS, EsriSLSStyle, EsriSymbol, EsriUniqueValueRenderer } from "./EsriSymbology";
import { ArcGisAttributeDrivenSymbology } from "@itwin/core-frontend";

/** @internal */
const loggerCategory =  "MapLayersFormats.ArcGISFeature";

/** @internal */
export type ArcGisSymbologyRendererType = "simple" | "attributeDriven";

/** @internal */
export abstract class ArcGisSymbologyRenderer {
  public abstract isAttributeDriven(): this is ArcGisAttributeDrivenSymbology;
  public abstract applyFillStyle(context: CanvasRenderingContext2D): void;
  public abstract applyStrokeStyle(context: CanvasRenderingContext2D): void;
  public abstract drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number): void;

  public static create(renderer: EsriRenderer|undefined, defaultSymbol: EsriSymbol) {
    if (renderer?.type === "uniqueValue") {
      return new ArcGisUniqueValueSymbologyRenderer(renderer as EsriUniqueValueRenderer, defaultSymbol);
    } else {
      return new ArcGisSimpleSymbologyRenderer(renderer, defaultSymbol);
    }
  }
}
/** @internal */
export class ArcGisDashLineStyle {
  // ESRI does not provide any values for their line style definition, those values have been
  // determined by pixel-peeping tiles rendered by ArcGIS servers.
  // Available line styles are documented here: https://developers.arcgis.com/web-map-specification/objects/esriSLS_symbol/
  private static _dashLineLength = 6;
  private static _dashGapLength = 3;
  private static _dashShortLineLength = 3;
  private static _dashShortGapLength = 3;
  private static _dashLongLineLength = 12;
  private static _dashLongLineDotDotLength = 18;
  private static _dashLongGapLength = 6;
  private static _dotLineLength = 2;
  private static _dotGapLength = 3;
  private static _shortDotLineLength = 1;
  private static _shortDotGapLength = 2;
  public static dashValues = {
    esriSLSDash : [this._dashLineLength, this._dashGapLength],
    esriSLSDashDot : [this._dashLineLength, this._dotGapLength, this._dotLineLength, this._dotGapLength],
    esriSLSDashDotDot : [this._dashLongLineLength, this._dotGapLength, this._dotLineLength, this._dotGapLength, this._dotLineLength, this._dotGapLength],
    esriSLSDot : [this._dashLineLength, this._dotGapLength],
    esriSLSLongDash : [this._dashLongLineLength, this._dashLongGapLength],
    esriSLSLongDashDot : [this._dashLongLineDotDotLength, this._dashGapLength, this._dotLineLength, this._dashGapLength],
    esriSLSShortDash : [this._dashShortLineLength, this._dashShortGapLength],
    esriSLSShortDashDot : [this._dashShortLineLength, this._dashShortGapLength, this._dotLineLength, this._dashShortGapLength],
    esriSLSShortDashDotDot :  [this._dashLineLength, this._dashShortGapLength, this._dotLineLength, this._dashGapLength, this._dotLineLength, this._dashShortGapLength],
    esriSLSShortDot : [this._shortDotLineLength, this._shortDotGapLength],
  };

}

/** @internal */
export class ArcGisSimpleSymbologyRenderer extends ArcGisSymbologyRenderer {
  public override isAttributeDriven(): this is ArcGisAttributeDrivenSymbology {return false;}
  public lineWidthScaleFactor = 2;    // This is value is empirical, this might need to be adjusted

  public get symbol() {return this._symbol;}
  public get defaultSymbol() {return this._defaultSymbol;}
  protected _symbol: EsriSymbol;
  protected _defaultSymbol: EsriSymbol;

  public readonly renderer?: EsriRenderer;

  public  constructor(renderer: EsriRenderer|undefined, defaultSymbol: EsriSymbol) {
    super();
    this._defaultSymbol = defaultSymbol;
    this.renderer = renderer;

    if (this.renderer?.type === "simple") {
      this._symbol = (this.renderer as EsriSimpleRenderer).symbol;
    }  else {
      this._symbol = defaultSymbol;
    }

  }

  public applyFillStyle(context: CanvasRenderingContext2D) {
    if (!context)
      return;

    const fillColor = this.getFillColor();
    if (fillColor) {
      context.fillStyle = fillColor.toRgbaString();
    } else {
      Logger.logTrace(loggerCategory, `Could not apply fill style`);
    }
  }

  private getFillColor() {
    let fillColor: ColorDef | undefined;
    if (this._symbol.type === "esriSFS") {
      const sfs = this._symbol as EsriSFS;
      if (sfs.color) {
        fillColor = sfs.color;
      }
    }

    return fillColor;
  }

  private applyLineDash(context: CanvasRenderingContext2D, slsStyle: EsriSLSStyle) {
    if (slsStyle !== "esriSLSSolid" && slsStyle !== "esriSLSNull") {
      context.setLineDash(ArcGisDashLineStyle.dashValues[slsStyle]);
    }
  }

  public applyStrokeStyle(context: CanvasRenderingContext2D) {
    if (!context)
      return;

    // Stroke style can be from SFS's outline style or a SLS's color
    let sls: EsriSLS | undefined;
    if (this._symbol.type === "esriSFS") {
      const sfs = this._symbol as EsriSFS;
      if (sfs.outline) {
        sls = sfs.outline;
      }
    } else if (this._symbol.type === "esriSLS") {
      sls = this._symbol as EsriSLS;
    }

    if (sls) {
      if (sls.color) {
        context.strokeStyle = sls.color.toRgbaString();
      }
      if (sls.style) {
        this.applyLineDash(context, sls.style);
      }

      context.lineWidth = sls.width * this.lineWidthScaleFactor;
    } else {
      Logger.logTrace(loggerCategory, `Could not apply stroke style`);
    }

  }

  public drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number) {
    if (!context)
      return;

    if (this._symbol.type === "esriPMS") {
      const pms = this._symbol as EsriPMS;

      // We scale up a little a bit the size of symbol.
      const width = pms.width === undefined ? pms.width : pms.width * 1.25;
      const height = pms.height === undefined ? pms.height : pms.height * 1.25;

      let xOffset = 0, yOffset = 0;
      if (pms.xoffset)
        xOffset = pms.xoffset;
      else if (width)
        xOffset = width * -0.5;  // if no offset center in the middle

      if (pms.yoffset)
        yOffset = pms.yoffset;
      else if (height)
        yOffset = height * -0.5; // if no offset center in the middle

      if (width && height) {
        context.drawImage(pms.image, ptX + xOffset, ptY + yOffset, width, height);
      } else {
        context.drawImage(pms.image, ptX + xOffset, ptY + yOffset);
      }

      // TODO: marker rotation angle
    }
  }
}

/** @internal */
export class ArcGisUniqueValueSymbologyRenderer extends ArcGisSimpleSymbologyRenderer implements ArcGisAttributeDrivenSymbology {
  public override isAttributeDriven(): this is ArcGisAttributeDrivenSymbology {return true;}
  protected _activeFeatureAttributes:  {[key: string]: any} | undefined;
  protected uvRenderer: EsriUniqueValueRenderer;

  public get rendererFields() {
    if (this.uvRenderer.field1)
      return [this.uvRenderer.field1];
    else
      return undefined;
  }

  public  constructor(renderer: EsriUniqueValueRenderer, defaultSymbol: EsriSymbol) {
    super(renderer, defaultSymbol);

    this.uvRenderer = (this.renderer as EsriUniqueValueRenderer);
    if (this.uvRenderer.defaultSymbol) {
      this._defaultSymbol = this.uvRenderer.defaultSymbol;
      this._symbol = this.defaultSymbol;
    }
  }

  public setActiveFeatureAttributes(attributes: { [key: string]: any }) {
    this._activeFeatureAttributes = attributes;

    let newSymbolApplied = false;
    if (this._activeFeatureAttributes) {
      if (this.uvRenderer.field1 && Object.keys(this._activeFeatureAttributes).includes(this.uvRenderer.field1)) {

        const queryValue = this._activeFeatureAttributes[this.uvRenderer.field1];

        if (queryValue !== null && queryValue !== undefined) {
          for (const uvi of this.uvRenderer.uniqueValueInfos) {
          // Strangely, ArcGIS documentation says 'value' is a string,
          // not too sure if a comparison on other types is possible, or its always forced to string properties?
            if (uvi.value  === queryValue.toString()) {
              this._symbol = uvi.symbol;
              newSymbolApplied = true;
              break;
            }
          }
        }
      }
    }

    // Fallback to default symbology to make sure we render something
    if (!newSymbolApplied) {
      this._symbol = this.defaultSymbol;
    }
  }
}
