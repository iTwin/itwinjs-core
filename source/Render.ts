/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { JsonUtils } from "../../Bentleyjs-common/lib/JsonUtils";

export enum RenderMode {
  Wireframe = 0,
  HiddenLine = 3,
  SolidFill = 4,
  SmoothShade = 6,
}

/** Flags for view display style */
export class ViewFlags {
  public renderMode: RenderMode = RenderMode.Wireframe;
  public dimensions: boolean = true;            // Shows or hides dimensions.
  public patterns: boolean = true;              // Shows or hides pattern geometry.
  public weights: boolean = true;               // Controls whether non-zero line weights are used or display using weight 0.
  public styles: boolean = true;                // Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines).
  public transparency: boolean = true;          // Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque).
  public fill: boolean = true;                  // Controls whether the fills on filled elements are displayed.
  public textures: boolean = true;              // Controls whether to display texture maps for material assignments. When off only material color is used for display.
  public materials: boolean = true;             // Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material).
  public acsTriad: boolean = false;             // Shows or hides the ACS triad.
  public grid: boolean = false;                 // Shows or hides the grid. The grid settings are a design file setting.
  public visibleEdges: boolean = false;         // Shows or hides visible edges in the shaded render mode.
  public hiddenEdges: boolean = false;          // Shows or hides hidden edges in the shaded render mode.
  public sourceLights: boolean = false;         // Controls whether the source lights in spatial models are used
  public cameraLights: boolean = false;         // Controls whether camera (ambient, portrait, flashbulb) lights are used.
  public solarLight: boolean = false;           // Controls whether sunlight used
  public shadows: boolean = false;              // Shows or hides shadows.
  public noClipVolume: boolean = false;         // Controls whether the clip volume is applied.
  public constructions: boolean = false;        // Shows or hides construction class geometry.
  public monochrome: boolean = false;           // draw all graphics in a single color
  public noGeometryMap: boolean = false;        // ignore geometry maps
  public hLineMaterialColors: boolean = false;  // use material colors for hidden lines
  public edgeMask: number = 0;                  // 0=none, 1=generate mask, 2=use mask

  public toJSON(): object {
    const out: any = {};

    if (!this.constructions) out.noConstruct = true;
    if (!this.dimensions) out.noDim = true;
    if (!this.patterns) out.noPattern = true;
    if (!this.weights) out.noWeight = true;
    if (!this.styles) out.noStyle = true;
    if (!this.transparency) out.noTransp = true;
    if (!this.fill) out.noFill = true;
    if (this.grid) out.grid = true;
    if (this.acsTriad) out.acs = true;
    if (!this.textures) out.noTexture = true;
    if (!this.materials) out.noMaterial = true;
    if (!this.cameraLights) out.noCameraLights = true;
    if (!this.sourceLights) out.noSourceLights = true;
    if (!this.solarLight) out.noSolarLight = true;
    if (this.visibleEdges) out.visEdges = true;
    if (this.hiddenEdges) out.hidEdges = true;
    if (this.shadows) out.shadows = true;
    if (!this.noClipVolume) out.clipVol = true;
    if (this.hLineMaterialColors) out.hlMatColors = true;
    if (this.monochrome) out.monochrome = true;
    if (this.edgeMask !== 0) out.edgeMask = this.edgeMask;

    out.renderMode = this.renderMode;
    return out;
  }

  public static fromJSON(json: any): ViewFlags {
    const val = new ViewFlags();
    if (!json)
      return val;
    val.constructions = !JsonUtils.asBool(json.noConstruct);
    val.dimensions = !JsonUtils.asBool(json.noDim);
    val.patterns = !JsonUtils.asBool(json.noPattern);
    val.weights = !JsonUtils.asBool(json.noWeight);
    val.styles = !JsonUtils.asBool(json.noStyle);
    val.transparency = !JsonUtils.asBool(json.noTransp);
    val.fill = !JsonUtils.asBool(json.noFill);
    val.grid = JsonUtils.asBool(json.grid);
    val.acsTriad = JsonUtils.asBool(json.acs);
    val.textures = !JsonUtils.asBool(json.noTexture);
    val.materials = !JsonUtils.asBool(json.noMaterial);
    val.cameraLights = !JsonUtils.asBool(json.noCameraLights);
    val.sourceLights = !JsonUtils.asBool(json.noSourceLights);
    val.solarLight = !JsonUtils.asBool(json.noSolarLight);
    val.visibleEdges = JsonUtils.asBool(json.visEdges);
    val.hiddenEdges = JsonUtils.asBool(json.hidEdges);
    val.shadows = JsonUtils.asBool(json.shadows);
    val.noClipVolume = !JsonUtils.asBool(json.clipVol);
    val.monochrome = JsonUtils.asBool(json.monochrome);
    val.edgeMask = JsonUtils.asInt(json.edgeMask);
    val.hLineMaterialColors = JsonUtils.asBool(json.hlMatColors);

    const renderModeValue = JsonUtils.asInt(json.renderMode);
    if (renderModeValue < RenderMode.HiddenLine)
      val.renderMode = RenderMode.Wireframe;
    else if (renderModeValue > RenderMode.SolidFill)
      val.renderMode = RenderMode.SmoothShade;
    else
      val.renderMode = renderModeValue;

    return val;
  }
}
const scratchBytes: Uint8Array = new Uint8Array(4);
const scratchUInt32: Uint32Array = new Uint32Array(scratchBytes.buffer);

/** an RGBA value for a color */
export class ColorDef {
  private _rgba: number;

  public constructor(rgba?: number) { this.rgba = rgba ? rgba : 0; }

  public static from(r: number, g: number, b: number, a?: number, result?: ColorDef) {
    scratchBytes[0] = r;
    scratchBytes[1] = g;
    scratchBytes[2] = b;
    scratchBytes[3] = a ? a : 0;
    if (result)
      result.rgba = scratchUInt32[0];
    else
      result = new ColorDef(scratchUInt32[0]);
    return result;
  }

  public getColors() { scratchUInt32[0] = this._rgba; return { r: scratchBytes[0], g: scratchBytes[1], b: scratchBytes[2], a: scratchBytes[3] }; }
  public get rgba(): number { return this._rgba; }
  public set rgba(rgba: number) { this._rgba = rgba | 0; }

  public equals(other: ColorDef): boolean { return this._rgba === other._rgba; }

  public static black(): ColorDef { return new ColorDef(); }
  public static white(): ColorDef { return ColorDef.from(0xff, 0xff, 0xff); }
  public static red(): ColorDef { return ColorDef.from(0xff, 0, 0); }
  public static green(): ColorDef { return ColorDef.from(0, 0xff, 0); }
  public static blue(): ColorDef { return ColorDef.from(0, 0, 0xff); }
  public static Yellow(): ColorDef { return ColorDef.from(0xff, 0xff, 0); }
  public static cyan(): ColorDef { return ColorDef.from(0, 0xff, 0xff); }
  public static orange(): ColorDef { return ColorDef.from(0xff, 0xa5, 0); }
  public static magenta(): ColorDef { return ColorDef.from(0xff, 0, 0xff); }
  public static brown(): ColorDef { return ColorDef.from(0xa5, 0x2a, 0x2a); }
  public static lightGrey(): ColorDef { return ColorDef.from(0xbb, 0xbb, 0xbb); }
  public static mediumGrey(): ColorDef { return ColorDef.from(0x88, 0x88, 0x88); }
  public static darkGrey(): ColorDef { return ColorDef.from(0x55, 0x55, 0x55); }
  public static darkRed(): ColorDef { return ColorDef.from(0x80, 0, 0); }
  public static darkGreen(): ColorDef { return ColorDef.from(0, 0x80, 0); }
  public static darkBlue(): ColorDef { return ColorDef.from(0, 0, 0x80); }
  public static darkYellow(): ColorDef { return ColorDef.from(0x80, 0x80, 0); }
  public static darkOrange(): ColorDef { return ColorDef.from(0xff, 0x8c, 0); }
  public static darkCyan(): ColorDef { return ColorDef.from(0, 0x80, 0x80); }
  public static darkMagenta(): ColorDef { return ColorDef.from(0x80, 0, 0x80); }
  public static darkBrown(): ColorDef { return ColorDef.from(0x8b, 0x45, 0x13); }
}

export enum LinePixels {
  Solid = 0,
  Code0 = Solid,            // 0
  Code1 = 0x80808080,       // 1
  Code2 = 0xf8f8f8f8,       // 2
  Code3 = 0xffe0ffe0,       // 3
  Code4 = 0xfe10fe10,       // 4
  Code5 = 0xe0e0e0e0,       // 5
  Code6 = 0xf888f888,       // 6
  Code7 = 0xff18ff18,       // 7
  HiddenLine = 0xcccccccc,  // hidden lines
  Invisible = 0x00000001,   // nearly invisible
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
