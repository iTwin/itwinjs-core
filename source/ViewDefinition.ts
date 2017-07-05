/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { CreateParams, DefinitionElement } from "./Element";
import { Appearance, SubCategoryOverride } from "./Category";
import { ViewFlags, HiddenLine } from "./Render";
import { Light, LightType } from "./Lighting";
import { ColorDef } from "./IModel";
import { Vector3d } from "../../geometry-core/lib/Geometry";

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export class DisplayStyle extends DefinitionElement {
  protected _subcategories: Map<string, Appearance>;
  protected _subCategoryOvr: Map<string, SubCategoryOverride>;
  public viewFlags: ViewFlags;

  constructor(opts: CreateParams) { super(opts); }

  public getEcClass(): string { return "DisplayStyle"; }
  public getStyle(name: string): any {
    const style = this.props.styles[name];
    return style ? style : new Object();
  }
  /** change the value of a style on this DisplayStyle */
  public setStyle(name: string, value: any): void { this.props.styles[name] = value; }

  /** Remove a Style from this DisplayStyle. */
  public removeStyle(name: string) { delete this.props.styles[name]; }

  /** Get the background color for this DisplayStyle */
  public getBackgroundColor(): ColorDef {
    const color = this.getStyle("backgroundColor") as ColorDef | null;
    return color ? color : ColorDef.black();
  }

  /** Set the background color for this DisplayStyle */
  public setBackgroundColor(val: ColorDef): void { this.setStyle("backgroundColor", val); }

  public getMonochromeColor(): ColorDef {
    const color = this.getStyle("monochromeColor") as ColorDef | null;
    return color ? color : ColorDef.black();
  }
  public setMonochromeColor(val: ColorDef): void { this.setStyle("monochromeColor", val); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2d extends DisplayStyle {
  public getEcClass(): string { return "DisplayStyle2d"; }

  constructor(opts: CreateParams) { super(opts); }
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane {
  public enabled: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below
}

export class SkyBox {
  public enabled: boolean = false;
  public twoColor: boolean = false;
  public jpegFile: string;              // the name of a jpeg file with a spherical skybox
  public zenithColor: ColorDef;         // if no jpeg file, the color of the zenith part of the sky gradient (shown when looking straight up.)
  public nadirColor: ColorDef;          // if no jpeg file, the color of the nadir part of the ground gradient (shown when looking straight down.)
  public groundColor: ColorDef;         // if no jpeg file, the color of the ground part of the ground gradient
  public skyColor: ColorDef;            // if no jpeg file, the color of the sky part of the sky gradient
  public groundExponent: number = 4.0;  // if no jpeg file, the cutoff between ground and nadir
  public skyExponent: number = 4.0;     // if no jpeg file, the cutoff between sky and zenith
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3d extends DisplayStyle {
  public groundPlane: GroundPlane;
  public skyBox: SkyBox;

  public getEcClass(): string { return "DisplayStyle3d"; }
  constructor(opts: CreateParams) { super(opts); }

  public getHiddenLineParams(): HiddenLine.Params { return this.getStyle("hline") as HiddenLine.Params; }
  public setHiddenLineParams(params: HiddenLine.Params) { this.setStyle("hline", params); }

  public setSceneLight(light: Light): void {
    if (!light.isValid())
      return;

    const sceneLights = this.getStyle("sceneLights");
    switch (light.lightType) {
      case LightType.Ambient:
        sceneLights.ambient = light;
        break;

      case LightType.Flash:
        sceneLights.flash = light;
        break;

      case LightType.Portrait:
        sceneLights.portrait = light;
        break;
    }
  }

  public setSolarLight(light: Light, direction: Vector3d) {
    const sceneLights = this.getStyle("sceneLights");
    if (light.lightType !== LightType.Solar || !light.isValid()) {
      delete sceneLights.sunDir;
      return;
    }

    sceneLights.sun = light;
    sceneLights.sunDir = direction;
  }

  public setSceneBrightness(fstop: number): void { Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
  public getSceneBrightness(): number { return this.getStyle("sceneLights").fstop; }
}
