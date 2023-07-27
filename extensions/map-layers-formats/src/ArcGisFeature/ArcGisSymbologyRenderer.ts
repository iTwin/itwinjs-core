/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSimpleRenderer, EsriSLS, EsriSymbol, EsriUniqueValueRenderer } from "./EsriSymbology";
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
export class ArcGisSimpleSymbologyRenderer  extends ArcGisSymbologyRenderer {
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

    // Fallback to default symbology to make sure we render something
    if (!newSymbolApplied) {
      this._symbol = this.defaultSymbol;
    }
  }
}
