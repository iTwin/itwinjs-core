/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { ColorDef } from "./IModel";

export enum RenderMode {
  Wireframe = 0,
  HiddenLine = 3,
  SolidFill = 4,
  SmoothShade = 6,
}

/** Flags for view display style */
export class ViewFlags {
  public renderMode: RenderMode = RenderMode.Wireframe;
  public dimensions: boolean = true;       // Shows or hides dimensions.
  public patterns: boolean = true;         // Shows or hides pattern geometry.
  public weights: boolean = true;          // Controls whether non-zero line weights are used or display using weight 0.
  public styles: boolean = true;           // Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines).
  public transparency: boolean = true;     // Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque).
  public fill: boolean = true;             // Controls whether the fills on filled elements are displayed.
  public textures: boolean = true;         // Controls whether to display texture maps for material assignments. When off only material color is used for display.
  public materials: boolean = true;        // Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material).
  public acsTriad: boolean = false;         // Shows or hides the ACS triad.
  public grid: boolean = false;             // Shows or hides the grid. The grid settings are a design file setting.
  public visibleEdges: boolean = false;     // Shows or hides visible edges in the shaded render mode.
  public hiddenEdges: boolean = false;      // Shows or hides hidden edges in the shaded render mode.
  public sourceLights: boolean = false;     // Controls whether the source lights in spatial models are used
  public cameraLights: boolean = false;     // Controls whether camera (ambient, portrait, flashbulb) lights are used.
  public solarLight: boolean = false;       // Controls whether sunlight ussed
  public shadows: boolean = false;          // Shows or hides shadows.
  public noClipVolume: boolean = false;     // Controls whether the clip volume is applied.
  public constructions: boolean = false;    // Shows or hides construction class geometry.
  public monochrome: boolean = false;       // draw all graphics in a single color
  public noGeometryMap: boolean = false;    // ignore geometry maps
  public hLineMaterialColors: boolean = false; // use material colors for hidden linse
  public edgeMask: number = 0;         // 0=none, 1=generate mask, 2=use mask

  // DGNPLATFORM_EXPORT Json::Value ToJson() const;
  // DGNPLATFORM_EXPORT void FromJson(JsonValueCR);
}

enum LinePixels {
  Solid = 0,
  Code0 = Solid,      // 0
  Code1 = 0x80808080, // 1
  Code2 = 0xf8f8f8f8, // 2
  Code3 = 0xffe0ffe0, // 3
  Code4 = 0xfe10fe10, // 4
  Code5 = 0xe0e0e0e0, // 5
  Code6 = 0xf888f888, // 6
  Code7 = 0xff18ff18, // 7
  HiddenLine = 0xcccccccc,  // hidden lines
  Invisible = 0x00000001, // nearly invisible
  Invalid = 0xffffffff,
}

export namespace HiddenLine {

  export class Style {
    constructor(public ovrColor: boolean, public color: ColorDef, public pattern: LinePixels, public width: number) { }
    public equals(rhs: Style): boolean {
      return this.ovrColor === rhs.ovrColor && this.color === rhs.color && this.pattern === rhs.pattern && this.width === rhs.width;
    }
  }

  export class Params {
    public visible: Style = new Style(false, new ColorDef(), LinePixels.Solid, 1);
    public hidden: Style = new Style(false, new ColorDef(), LinePixels.HiddenLine, 1);
    public transparencyThreshold: number = 1.0;

    public equals(rhs: Params): boolean { return this.visible === rhs.visible && this.hidden === rhs.hidden && this.transparencyThreshold === rhs.transparencyThreshold; }
  }
}
