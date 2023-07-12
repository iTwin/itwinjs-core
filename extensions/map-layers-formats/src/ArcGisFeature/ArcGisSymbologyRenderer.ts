/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSimpleRenderer, EsriSLS, EsriSymbol, EsriUniqueValueRenderer } from "./EsriSymbology";
import { ArcGisAttributeDrivenSymbology } from "@itwin/core-frontend";

const loggerCategory =  "MapLayersFormats.ArcGISFeature";

/** @internal */
// export class ArcGisSymbologyRenderer {
export class ArcGisSymbologyRenderer implements ArcGisAttributeDrivenSymbology {

  public lineWidthScaleFactor = 2;    // This is value is empirical, this might need to be adjusted

  private _activeFeatureAttributes:  {[key: string]: any} | undefined;

  public get symbol() {return this._symbol;}
  public readonly defaultSymbol: EsriSymbol;
  private _symbol: EsriSymbol;

  public readonly renderer?: EsriRenderer;

  public constructor(renderer: EsriRenderer|undefined, defaultSymbol: EsriSymbol) {

    this.defaultSymbol = defaultSymbol;
    this.renderer = renderer;

    if (this.renderer?.type === "simple") {
      this._symbol = (this.renderer as EsriSimpleRenderer).symbol;
    } else if (this.renderer?.type === "uniqueValue") {
      const uv = (this.renderer as EsriUniqueValueRenderer);
      if (uv.defaultSymbol) {
        this.defaultSymbol = uv.defaultSymbol;
        this._symbol = this.defaultSymbol;
      } else {
        this._symbol = defaultSymbol;
      }
    } else {
      this._symbol = defaultSymbol;
    }

  }

  public get rendererFields() {
    if (this.renderer && this.renderer?.type === "uniqueValue") {
      const uvRenderer = this.renderer as EsriUniqueValueRenderer;
      if (uvRenderer.field1)
        return [uvRenderer.field1];
    }
    return undefined;
  }

  public setActiveFeatureAttributes(attributes: { [key: string]: any }) {
    this._activeFeatureAttributes = attributes;

    if (this.renderer?.type === "uniqueValue") {
      let newSymbolApplied = false;
      if (this._activeFeatureAttributes) {
        const renderer = this.renderer as EsriUniqueValueRenderer;
        if (renderer.field1 && Object.keys(this._activeFeatureAttributes).includes(renderer.field1)) {

          const queryValue = this._activeFeatureAttributes[renderer.field1];

          for (const uvi of renderer.uniqueValueInfos) {
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

      // Fallback to default symbology to make sure we render something
      if (!newSymbolApplied) {
        this._symbol = this.defaultSymbol;
      }
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

  public applyStrokeStyle(context: CanvasRenderingContext2D) {
    if (!context)
      return;

    // Stroke style can be from SFS's outline style or a SLS's color
    let sls: EsriSLS | undefined;
    if (this._symbol.type === "esriSFS") {
      const sfs = this._symbol as EsriSFS;
      if (sfs.outline && sfs.outline.style === "esriSLSSolid") {
        sls = sfs.outline;
      }
    } else if (this._symbol.type === "esriSLS") {
      sls = this._symbol as EsriSLS;
    }

    if (sls) {
      if (sls.color)
        context.strokeStyle = sls.color.toRgbaString();
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
      let xOffset = 0, yOffset = 0;
      if (pms.xoffset)
        xOffset = pms.xoffset;
      else if (pms.width)
        xOffset = pms.width * -0.5;  // if no offset center in the middle

      if (pms.yoffset)
        yOffset = pms.yoffset;
      else if (pms.height)
        yOffset = pms.height * -0.5; // if no offset center in the middle

      if (pms.width && pms.height) {
        context.drawImage(pms.image, ptX + xOffset, ptY + yOffset, pms.width, pms.height);
      } else {
        context.drawImage(pms.image, ptX + xOffset, ptY + yOffset);
      }

      // TODO: marker rotation angle
    }
  }
}
