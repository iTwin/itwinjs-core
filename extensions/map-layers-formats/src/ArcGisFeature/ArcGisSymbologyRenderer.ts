/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { EsriClassBreaksRenderer, EsriPMS, EsriRenderer, EsriSFS, EsriSimpleRenderer, EsriSLS, EsriSLSStyle, EsriSMS, EsriSymbol, EsriUniqueValueRenderer } from "./EsriSymbology";
import { FeatureAttributeDrivenSymbology, FeatureSymbologyRenderer } from "@itwin/core-frontend";
import { Angle } from "@itwin/core-geometry";
import { FeatureDefaultSymbology } from "../Feature/FeatureSymbology";
import { ArcGisFeatureGeometryType } from "./ArcGisFeatureQuery";

/** @internal */
const loggerCategory =  "MapLayersFormats.ArcGISFeature";

/** @internal */
export type ArcGisSymbologyRendererType = "simple" | "attributeDriven";

/** @internal */
export abstract class ArcGisSymbologyRenderer implements FeatureSymbologyRenderer {
  public activeGeometryType: string = "";
  public abstract isAttributeDriven(): this is FeatureAttributeDrivenSymbology;
  public abstract applyFillStyle(context: CanvasRenderingContext2D): void;
  public abstract applyStrokeStyle(context: CanvasRenderingContext2D): void;
  public abstract drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number): void;

  public static create(renderer: EsriRenderer|undefined, defaultSymbol: FeatureDefaultSymbology, geometryType?: ArcGisFeatureGeometryType) {
    if (renderer?.type === "uniqueValue") {
      return new ArcGisUniqueValueSymbologyRenderer(renderer as EsriUniqueValueRenderer, defaultSymbol, geometryType);
    } else if (renderer?.type === "classBreaks") {
      return new ArcGisClassBreaksSymbologyRenderer(renderer as EsriClassBreaksRenderer, defaultSymbol, geometryType);
    } else {
      return new ArcGisSimpleSymbologyRenderer(renderer, defaultSymbol, geometryType);
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
  public override isAttributeDriven(): this is FeatureAttributeDrivenSymbology {return false;}
  public lineWidthScaleFactor = 2;    // This is value is empirical, this might need to be adjusted

  public get symbol(): EsriSymbol {return (this._symbol ?? this.defaultSymbol);}
  public set symbol(symbol: EsriSymbol|undefined) {this._symbol = symbol;}
  private _symbol: EsriSymbol|undefined;

  public get defaultSymbol() {return this._defaultSymbol.getSymbology(this.activeGeometryType) as EsriSymbol;}
  private _defaultSymbol: FeatureDefaultSymbology;

  public readonly renderer?: EsriRenderer;

  public constructor(renderer: EsriRenderer|undefined, defaultSymbol: FeatureDefaultSymbology, geometryType?: ArcGisFeatureGeometryType) {
    super();
    this._defaultSymbol = defaultSymbol;

    // ArcGIS service normally advertise upfront he geometry of all features.  It's always possible to opt-out, but then
    // you will have to set the activeGeometryType before rendering.
    if (geometryType)
      this.activeGeometryType = geometryType;
    this.renderer = renderer;

    if (this.renderer?.type === "simple") {
      this._symbol = (this.renderer as EsriSimpleRenderer).symbol;
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
    const symbol = this.symbol;
    let fillColor: ColorDef | undefined;
    if (symbol.type === "esriSFS") {
      const sfs = symbol as EsriSFS;
      if (sfs.color) {
        fillColor = sfs.color;
      }
    } else  if (symbol.type === "esriSMS") {
      const sms = symbol as EsriSMS;
      if (sms.color) {
        fillColor = sms.color;
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
    const symbol = this.symbol;
    if (symbol.type === "esriSFS") {
      const sfs = this.symbol as EsriSFS;
      if (sfs.outline) {
        sls = sfs.outline;
      }
    } else if (symbol.type === "esriSLS") {
      sls = this.symbol as EsriSLS;
    } else if (symbol.type === "esriSMS") {
      const sms = this.symbol as EsriSMS;
      if (sms.outline) {
        sls = sms.outline;
      }
    }

    if (sls) {

      context.lineWidth = (sls.width > 0 ? sls.width : 1);
      if (symbol.type === "esriSLS")
        context.lineWidth *= this.lineWidthScaleFactor;
      if (sls.color) {
        context.strokeStyle = sls.color.toRgbaString();
      }
      if (sls.style) {
        this.applyLineDash(context, sls.style);
      }
    } else {
      Logger.logTrace(loggerCategory, `Could not apply stroke style`);
    }

  }
  /**
  * Draw a simple marker
  * @param x x-axis coordinate in the destination canvas at which to place the center of the marker
  * @param y y-axis coordinate in the destination canvas at which to place the center of the marker
  * @param size size of the marker
  * @public
  */
  public drawSimpleMarker(context: CanvasRenderingContext2D, sms: EsriSMS, x: number, y: number, size: number) {
    const halfSize = sms.size * 0.5;
    if (sms.angle) {
      context.save();
      context.translate(x,y);
      const angle = Angle.createDegrees(sms.angle);
      context.rotate(angle.radians);
      context.translate(-x,-y);
    }

    if (sms.style === "esriSMSSquare") {

      const dx = x + (-0.5 * size);
      const dy = y + (-0.5 * size);
      if (sms.color) {
        this.applyFillStyle(context);
        context.fillRect(dx, dy, size, size);
      }
      if (sms.outline) {
        this.applyStrokeStyle(context);
        context.strokeRect(dx, dy, size, size);
      }

    } else if (sms.style === "esriSMSCircle") {
      context.beginPath();
      context.arc(x, y, size*0.5, 0, 2*Math.PI);
      context.closePath();
      if (sms.color) {
        this.applyFillStyle(context);
        context.fill();
      }
      if (sms.outline) {
        this.applyStrokeStyle(context);
        context.stroke();
      }
    } else if (sms.style === "esriSMSCross") {
      context.beginPath();
      context.moveTo(x-halfSize, y);
      context.lineTo(x+halfSize, y);
      context.moveTo(x, y-halfSize);
      context.lineTo(x, y+halfSize);
      if (sms.outline) {
        this.applyStrokeStyle(context);
      }
      context.stroke();
    } else if (sms.style === "esriSMSDiamond") {
      context.beginPath();

      context.moveTo(x, y-halfSize);
      context.lineTo(x+halfSize, y);
      context.lineTo(x, y+halfSize);
      context.lineTo(x-halfSize, y);
      context.closePath();
      if (sms.color) {
        this.applyFillStyle(context);
        context.fill();
      }
      if (sms.outline) {
        this.applyStrokeStyle(context);
      }
      context.stroke();
    } else if (sms.style === "esriSMSTriangle") {
      context.beginPath();
      context.moveTo(x, y-halfSize);
      context.lineTo(x+halfSize, y+halfSize);
      context.lineTo(x-halfSize, y+halfSize);

      context.closePath();
      if (sms.color) {
        this.applyFillStyle(context);
        context.fill();
      }
      if (sms.outline) {
        this.applyStrokeStyle(context);
      }
      context.stroke();
    } else if(sms.style === "esriSMSX") {
      context.beginPath();
      context.moveTo(x-halfSize, y-halfSize);
      context.lineTo(x+halfSize, y+halfSize);
      context.moveTo(x-halfSize, y+halfSize);
      context.lineTo(x+halfSize, y-halfSize);
      if (sms.outline) {
        this.applyStrokeStyle(context);
      }
      context.stroke();
    }
    if (sms.angle)
      context.restore();
  }

  public drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number) {
    if (!context)
      return;

    const symbol = this.symbol;

    if (symbol.type === "esriPMS") {
      const pms = this.symbol as EsriPMS;
      const angleDegrees = pms.angle;

      // We scale up a little a bit the size of symbol.
      // const width = pms.width === undefined ? pms.width : pms.width * 1.25;
      // const height = pms.height === undefined ? pms.height : pms.height * 1.25;
      const width =  pms.width;
      const height = pms.height;

      let xOffset = 0, yOffset = 0;

      // Center the marker around the anchor point
      if (width)
        xOffset = width * -0.5;
      if (height)
        yOffset = height * -0.5;

      // Add additional offset
      if (pms.xoffset)
        xOffset += pms.xoffset;
      if (pms.yoffset)
        yOffset += pms.yoffset;

      const dx = ptX + xOffset;
      const dy = ptY + yOffset;

      if (angleDegrees) {
        context.save();
        context.translate(ptX, ptY);
        const angle = Angle.createDegrees(angleDegrees);
        context.rotate(angle.radians);
        context.translate(-ptX, -ptY);
      }

      if (width && height) {
        context.drawImage(pms.image, dx, dy, width, height);
      } else {
        context.drawImage(pms.image, dx, dy);
      }

      if (angleDegrees)
        context.restore();

    } else if (symbol.type === "esriSMS") {
      const sms = this.symbol as EsriSMS;

      let xOffset = 0;
      let yOffset = 0;

      if (sms.xoffset)
        xOffset += sms.xoffset;

      if (sms.yoffset)
        yOffset += sms.yoffset;

      this.drawSimpleMarker(context, sms, ptX + xOffset, ptY + yOffset, sms.size);
    }
  }
}

/** @internal */
export class ArcGisUniqueValueSymbologyRenderer extends ArcGisSimpleSymbologyRenderer implements FeatureAttributeDrivenSymbology {
  public override isAttributeDriven(): this is FeatureAttributeDrivenSymbology {return true;}
  protected _activeFeatureAttributes:  {[key: string]: any} | undefined;
  protected uvRenderer: EsriUniqueValueRenderer;
  private _defaultRenderSymbol: EsriSymbol|undefined;

  public override get defaultSymbol() {return this._defaultRenderSymbol ?? super.defaultSymbol;}

  public get rendererFields() {
    if (this.uvRenderer.field1)
      return [this.uvRenderer.field1];
    else
      return undefined;
  }

  public  constructor(renderer: EsriUniqueValueRenderer, defaultSymbol: FeatureDefaultSymbology, geometryType?: ArcGisFeatureGeometryType) {
    super(renderer, defaultSymbol, geometryType);

    this.uvRenderer = (this.renderer as EsriUniqueValueRenderer);
    this._defaultRenderSymbol = this.uvRenderer.defaultSymbol;
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
              this.symbol = uvi.symbol ;
              newSymbolApplied = true;
              break;
            }
          }
        }
      }
    }

    // Fallback to default symbology to make sure we render something
    if (!newSymbolApplied) {
      this.symbol = undefined;
    }
  }
}

/** @internal */
export class ArcGisClassBreaksSymbologyRenderer extends ArcGisSimpleSymbologyRenderer implements FeatureAttributeDrivenSymbology {
  public override isAttributeDriven(): this is FeatureAttributeDrivenSymbology {return true;}
  protected _activeFeatureAttributes:  {[key: string]: any} | undefined;
  protected cbRenderer: EsriClassBreaksRenderer;
  private _defaultRenderSymbol: EsriSymbol|undefined;

  public override get defaultSymbol() {return this._defaultRenderSymbol ?? super.defaultSymbol;}

  public get rendererFields() {
    if (this.cbRenderer)
      return [this.cbRenderer.field];
    else
      return undefined;
  }

  public constructor(renderer: EsriClassBreaksRenderer, defaultSymbol: FeatureDefaultSymbology, geometryType?: ArcGisFeatureGeometryType) {
    super(renderer, defaultSymbol, geometryType);

    this.cbRenderer = (this.renderer as EsriClassBreaksRenderer);
    this._defaultRenderSymbol = this.cbRenderer.defaultSymbol;
  }

  public setActiveFeatureAttributes(attributes: { [key: string]: any }) {
    this._activeFeatureAttributes = attributes;

    const newSymbolApplied = false;
    if (this._activeFeatureAttributes) {
      if (Object.keys(this._activeFeatureAttributes).includes(this.cbRenderer.field)) {

        const queryValue = this._activeFeatureAttributes[this.cbRenderer.field];

        if (queryValue !== null && queryValue !== undefined) {
          let currentMinValue: number|undefined;
          let currentClassIdx = 0;
          do {
            const currentClass = this.cbRenderer.classBreakInfos[currentClassIdx];
            if (currentClass.classMinValue !== undefined) {
              currentMinValue = currentClass.classMinValue;
            } else if (currentClass.classMinValue === undefined && currentClassIdx > 0) {
              currentMinValue = this.cbRenderer.classBreakInfos[currentClassIdx-1].classMaxValue;
            } else {
              currentMinValue = this.cbRenderer.minValue;
            }

            if ( queryValue >=  currentMinValue
              && queryValue <=  currentClass.classMaxValue) {
              this.symbol = currentClass.symbol;
              return;
            }
          }
          while (++currentClassIdx < this.cbRenderer.classBreakInfos.length);
        }
      }

      // Fallback to default symbology to make sure we render something
      if (!newSymbolApplied) {
        this.symbol = this.defaultSymbol;
      }
    }
  }
}
