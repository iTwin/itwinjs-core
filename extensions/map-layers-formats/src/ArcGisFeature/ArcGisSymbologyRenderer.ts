/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { ArcGisFeatureGeometryType } from "./ArcGisFeatureQuery";
import { EsriPMS, EsriPMSProps, EsriRenderer, EsriSFS, EsriSFSProps, EsriSimpleRenderer, EsriSLS, EsriSLSProps, EsriSymbol, EsriUniqueValueRenderer } from "./EsriSymbology";
import { ArcGisAttributeDrivenSymbology } from "@itwin/core-frontend";

const loggerCategory =  "MapLayersFormats.ArcGISFeature";

/** @internal */
export class ArcGisSymbologyRenderer implements ArcGisAttributeDrivenSymbology {
  private _activeFeatureAttributes:  {[key: string]: any} | undefined;
  private _symbol: EsriSymbol | undefined;
  private _renderer: EsriRenderer | undefined;

  public get rendererFields() {
    if (this._renderer && this._renderer?.type === "uniqueValue") {
      return [(this._renderer as EsriUniqueValueRenderer).field1];
    }
    return undefined;
  }

  public setActiveFeatureAttributes(attributes?: { [key: string]: any }) {
    this._activeFeatureAttributes = attributes;
  }

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
    try {
      this._renderer = EsriRenderer.fromJSON(rendererDefinition);
      if (this._renderer.type === "simple") {
        this._symbol = (this._renderer as EsriSimpleRenderer).symbol;
      } else if (this._renderer.type === "uniqueValue") {
        const uv = (this._renderer as EsriUniqueValueRenderer);
        if (uv.defaultSymbol) {
          this._symbol = uv.defaultSymbol;
        }
      }
    } catch {
      Logger.logWarning(loggerCategory, "Could not read symbology from metadata");
    }

    // If '_symbol' is still undefined at this point, that means we could not find
    // any symbology definition from the metadata, let's use some default symbology
    // so that we display at least something.
    if (!this._symbol) {
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
      sls = EsriSLS.fromJSON(this._symbol as EsriSLSProps);
    }

    if (sls) {
      if (sls.color)
        context.strokeStyle = sls.color.toRgbaString();
      context.lineWidth = sls.width * 2;     // TODO: Should we scale this value here?
    }
  }

  public drawPoint(context: CanvasRenderingContext2D, ptX: number, ptY: number) {
    if (!context)
      return;

    if (this._symbol?.type === "esriPMS") {
      const pms = EsriPMS.fromJSON(this._symbol as EsriPMSProps);
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
