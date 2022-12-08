/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { ArcGisFeatureGeometryType } from "./ArcGisFeatureQuery";

// Convert a channel array [r, g, b, a] to ColorDef
function colorFromArray(channels?: number[]) {
  if (channels && channels.length === 4) {
    // Alpha channel is reversed, 255 = opaque
    return ColorDef.from(channels[0], channels[1], channels[2], 255 - channels[3]);
  }
  return undefined;
}

const loggerCategory =  "MapLayersFormats.ArcGISFeature";

/** @internal */
export type EsriSymbolType = "esriSFS" | "esriPMS" | "esriSLS" | "esriSMS" | "esriTS" | "CIMSymbolReference";
interface EsriSymbol {
  type: EsriSymbolType;
}

/** @internal */
export type EsriSLSStyle = "esriSLSDash" | "esriSLSDashDot" | "esriSLSDashDotDot" | "esriSLSDot" | "esriSLSLongDash" | "esriSLSLongDashDot" |
"esriSLSNull" | "esriSLSShortDash" | "esriSLSShortDashDot" | "esriSLSShortDashDotDot" | "esriSLSShortDot" | "esriSLSSolid";

interface EsriSLSProps {
  color: number[];
  type: EsriSymbolType;
  width: number;
  style: EsriSLSStyle;
}

/** @internal */
export class EsriSLS implements EsriSymbol {
  public readonly props: EsriSLSProps;

  public get color() { return colorFromArray(this.props.color); }
  public get type() { return this.props.type; }
  public get width() { return this.props.width; }
  public get style() { return this.props.style; }

  constructor(json: EsriSLSProps) {
    this.props = json;
  }

  public static fromJSON(json: EsriSLSProps) {
    return new EsriSLS(json);
  }
}

interface EsriPMSProps {
  type: EsriSymbolType;
  url: string;
  imageData: string;
  contentType: string;
  width?: number;
  height?: number;
  xoffset?: number;
  yoffset?: number;
  angle?: number;
}

/** @internal */
export class EsriPMS implements EsriSymbol {
  public readonly props: EsriPMSProps;
  private _image: HTMLImageElement;

  public get type() { return this.props.type; }
  public get url() { return this.props.url; }
  public get imageData() { return this.props.imageData; }
  public get imageUrl() { return `data:${this.contentType};base64,${this.imageData}`; }
  public get image() { return this._image; }
  public get contentType() { return this.props.contentType; }
  public get width() { return this.props.width; }
  public get height() { return this.props.height; }
  public get xoffset() { return this.props.xoffset; }
  public get yoffset() { return this.props.yoffset; }
  public get angle() { return this.props.angle; }

  constructor(json: EsriPMSProps) {
    this.props = json;
    this._image = new Image();
    this._image.src = this.imageUrl;
  }

  public static fromJSON(json: EsriPMSProps) {
    return new EsriPMS(json);
  }
}

/** @internal */
export type EsriSFSStyleProps = "esriSFSBackwardDiagonal" | "esriSFSCross" | "esriSFSDiagonalCross" | "esriSFSForwardDiagonal" | "esriSFSHorizontal" | "esriSFSNull" | "esriSFSSolid" | "esriSFSVertical";
interface EsriSFSProps {
  color?: number[];
  type: EsriSymbolType;
  style: EsriSFSStyleProps;
  outline?: EsriSLSProps;
}

/** @internal */
export class EsriSFS implements EsriSymbol {
  public readonly props: EsriSFSProps;
  private _outline: EsriSLS | undefined;

  public get color() { return colorFromArray(this.props.color); }
  public get type() { return this.props.type; }
  public get style() { return this.props.style; }
  public get outline() { return this._outline; }
  constructor(json: EsriSFSProps) {
    this.props = json;
    if (json.outline)
      this._outline = EsriSLS.fromJSON(json.outline);
  }

  public static fromJSON(json: EsriSFSProps): EsriSFS {
    return new EsriSFS(json);
  }
}

/** @internal */
export class ArcGisSymbologyRenderer {
  private _symbol: EsriSymbol | undefined;

  private static readonly defaultPMS: EsriPMSProps = {
    type: "esriPMS",
    url: "",
    contentType: "image/png",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAmBJREFUOE+Nk01IVFEUx//n3jfvOZOaJkMtiiJ7o9RG3LgoqKhFSFJBTS1ahFBBi0ijfJXCIyQr+hBbSIsoW7iQoKKFCw2CkAI3tZAgy8Ei+xhoTCbnje/NPfHGnA816KzuPR+/c8/HJRQJE7o+VUhym0DcCOYGgBQEXjOLlyqo+nHanCkMoaL4rslKjZwOQLT4ek3Mmz3FACFNLB67ut6M1nWphbg8wI6VyJK5KEH0EQFVJRKbwzokAW++p/ErraAYSQK3u47bC3vLnA+ZB9i2gHF0oyQMCfCGNaUa+vauxs71wWz2V18cnBj8gQ8J1/eeBnHUa4sMFQDGdGno+4gwEAoQzjVUon3rqlx1KY9x7+0MWobjAPg3QJ2eZV4tAEyFNCN5FkSXyw2B3j1hRGvLcgBXMV5MptA4MOXr0gT0u5bZnAf0jBsyiSgJPAxqhON1K3FlRxUMvwFAtv7u0Wl0jvwEmJNEuOhakTt5wKEBifr6Oo14BIBRpgt07w6jcVMIngKGY7NofR5HwlF+zDcpsC193vyYB/innvHywCzdZfAR/+onX1segBTAxHzzfPE7/8yzzIPLjJE1LTixHZx5CtCK4gXLzovBiDPUsYxVM7gUkB3nWKlm6DYEnQGzXARxCOK+a1WfKtQXb6LNAvr7iCboCUA1Ocdsdv5KLPe7F6pH/w3wLbc+BwOuc5IZ1wEE/jonQbjptZn24tKKX7BgvR2r0NKZRwDvAqCI+Z30VJPTURv7P4A9psuQcYAUPwAoReBLrmX2Lmls7i8sZ7kWLwuoxA1FVJGxzMPLufi6P2r+2xFbOUjGAAAAAElFTkSuQmCC",
    width: 16,
    height: 16,
    xoffset: -8,
    yoffset: -16,
  };

  private static readonly defaultSLS: EsriSLSProps = {
    type: "esriSLS",
    color: [0, 0, 0, 255],
    width: 1,
    style: "esriSLSSolid",
  };

  private static readonly defaultSFS: EsriSFSProps = {
    type: "esriSFS",
    color:  [0, 0, 0, 255],
    style: "esriSFSSolid",
  };

  constructor(geometryType: ArcGisFeatureGeometryType, rendererDefinition: any) {
    let symbol;
    if (rendererDefinition?.symbol !== undefined) {
      symbol = rendererDefinition.symbol;
    } else if (rendererDefinition?.defaultSymbol !== undefined) {
      symbol = rendererDefinition?.defaultSymbol;
    }

    if (symbol !== undefined) {
      if (symbol.type === "esriSFS") {
        this._symbol = EsriSFS.fromJSON(symbol);
      } else if (symbol.type === "esriSLS") {
        this._symbol = EsriSLS.fromJSON(symbol);
      } else if (symbol.type === "esriPMS") {
        this._symbol = EsriPMS.fromJSON(symbol);
      }
    }

    // If '_symbol' is still undefined at this point, that means we could not find
    // any symbology definition from the metadata, let's use some default symbology
    // so that we display at least something.
    if (this._symbol === undefined) {
      Logger.logWarning(loggerCategory, "Symbology definition not supported, using default symbology");
      if (geometryType === "esriGeometryPoint" || geometryType === "esriGeometryMultipoint") {
        this._symbol = EsriPMS.fromJSON(ArcGisSymbologyRenderer.defaultPMS);
      } else if (geometryType === "esriGeometryLine" || geometryType === "esriGeometryPolyline") {
        this._symbol = EsriSLS.fromJSON(ArcGisSymbologyRenderer.defaultSLS);
      } else if (geometryType === "esriGeometryPolygon") {
        this._symbol = EsriSFS.fromJSON(ArcGisSymbologyRenderer.defaultSFS);
      } else {
        Logger.logError(loggerCategory, "Could not determine default symbology: geometry type not supported");
      }
    }
  }

  public applyFillStyle(context: CanvasRenderingContext2D) {
    if (!context)
      return;

    if (this._symbol?.type === "esriSFS") {
      const sfs = this._symbol as EsriSFS;
      if (sfs.style === "esriSFSSolid" && sfs.color) {
        context.fillStyle = sfs.color.toRgbaString();
      } else {
        context.fillStyle = ColorDef.from(200, 0, 0, 100).toRgbaString();  // default color is red?
      }
    }
  }

  public applyStrokeStyle(context: CanvasRenderingContext2D) {
    if (!context)
      return;

    let sls: EsriSLS | undefined;
    if (this._symbol?.type === "esriSFS") {
      const sfs = this._symbol as EsriSFS;
      if (sfs.outline && sfs.outline.style === "esriSLSSolid") {
        sls = sfs.outline;
      }
    } else if (this._symbol?.type === "esriSLS") {
      sls = this._symbol as EsriSLS;
    }

    if (sls) {
      if (sls.color)
        context.strokeStyle = sls.color.toRgbaString();
      context.lineWidth = sls.width;     // TODO: Should we scale this value here?
    }
  }

  public drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number) {
    if (!context)
      return;

    if (this._symbol?.type === "esriPMS") {
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
