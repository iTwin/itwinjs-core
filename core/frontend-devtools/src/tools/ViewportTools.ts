/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { BeDuration } from "@itwin/core-bentley";
import { Camera, ColorDef, Hilite } from "@itwin/core-common";
import {
  DrawingViewState, FlashMode, FlashSettings, FlashSettingsOptions, IModelApp, TileBoundingBoxes, Tool, Viewport,
} from "@itwin/core-frontend";
import { obtainGraphicRepresentationUrl } from "@itwin/frontend-tiles";
import { parseArgs } from "./parseArgs";
import { parseToggle } from "./parseToggle";

/** Base class for a tool that toggles some aspect of a Viewport.
 * @beta
 */
export abstract class ViewportToggleTool extends Tool {
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  protected abstract toggle(vp: Viewport, enable?: boolean): Promise<void>;

  public override async run(enable?: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      await this.toggle(vp, enable);

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      await this.run(enable);

    return true;
  }
}

/** Freeze or unfreeze the scene for the selected viewport. While the scene is frozen, no new tiles will be selected for drawing within the viewport.
 * @beta
 */
export class FreezeSceneTool extends ViewportToggleTool {
  public static override toolId = "FreezeScene";

  protected override async toggle(vp: Viewport, enable?: boolean) {
    if (undefined === enable || enable !== vp.freezeScene)
      vp.freezeScene = !vp.freezeScene;

    return Promise.resolve();
  }
}

const boundingVolumeNames = [
  "none",
  "volume",
  "content",
  "both",
  "children",
  "sphere",
  "solid",
];

/** Set the tile bounding volume decorations to display in the selected viewport.
 * Omitting the argument turns on Volume bounding boxes if bounding boxes are currently off; otherwise, toggles them off.
 * Allowed inputs are "none", "volume", "content", "both" (volume and content), "children", and "sphere".
 * @beta
 */
export class ShowTileVolumesTool extends Tool {
  public static override toolId = "ShowTileVolumes";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(boxes?: TileBoundingBoxes): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined === boxes)
      boxes = TileBoundingBoxes.None === vp.debugBoundingBoxes ? TileBoundingBoxes.Volume : TileBoundingBoxes.None;

    vp.debugBoundingBoxes = boxes;
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    let boxes: TileBoundingBoxes | undefined;
    if (0 !== args.length) {
      const arg = args[0].toLowerCase();
      for (let i = 0; i < boundingVolumeNames.length; i++) {
        if (arg === boundingVolumeNames[i]) {
          boxes = i;
          break;
        }
      }

      if (undefined === boxes)
        return true;
    }

    return this.run(boxes);
  }
}

/** Sets or unsets or flips the deactivated state of one or more tile tree references within the selected viewport.
 * Deactivated tile tree references are omitted from the scene.
 * This is useful for isolating particular tile trees or tiles for debugging.
 * @beta
 */
export class ToggleTileTreeReferencesTool extends Tool {
  public static override toolId = "ToggleTileTreeReferences";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 3; }

  private _modelIds?: string | string[];
  private _which?: "all" | "animated" | "primary" | "section" | number[];
  private _deactivate?: boolean;

  public override async parseAndRun(...args: string[]) {
    const which = args[0].toLowerCase();
    switch (which) {
      case "all":
      case "animated":
      case "primary":
      case "section":
        this._which = which;
        break;
      default:
        this._which = which.split(",").map((x) => Number.parseInt(x, 10)).filter((x) => !Number.isNaN(x));
    }

    let modelIds = args[2];
    let deactivate = parseToggle(args[1]);
    if (typeof deactivate !== "string") {
      if (typeof deactivate === "boolean")
        deactivate = !deactivate;

      this._deactivate = deactivate;
    } else {
      modelIds = args[1];
    }

    if (modelIds)
      this._modelIds = modelIds.toLowerCase().split(",");

    return this.run();
  }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !this._which || !vp.view.isSpatialView())
      return false;

    vp.view.setTileTreeReferencesDeactivated(this._modelIds, this._deactivate, this._which);
    vp.invalidateScene();
    return true;
  }
}

/** This tool sets the aspect ratio skew for the selected viewport.
 * @beta
 */
export class SetAspectRatioSkewTool extends Tool {
  public static override toolId = "SetAspectRatioSkew";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, setting the aspect ratio skew for the selected viewport.
   * @param skew the aspect ratio (x/y) skew value; 1.0 or undefined removes any skew
   */
  public override async run(skew?: number): Promise<boolean> {
    if (undefined === skew)
      skew = 1.0;

    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      vp.view.setAspectRatioSkew(skew);
      vp.synchWithView();
    }

    return true;
  }

  /** Executes this tool's run method.
   * @param args the first entry of this array contains the `skew` argument
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const skew = args.length > 0 ? parseFloat(args[0]) : 1.0;
    return !Number.isNaN(skew) && this.run(skew);
  }
}

/** Changes the [ModelSubCategoryHiliteMode]($frontend) for the [HiliteSet]($frontend) associated with the selected Viewport.
 * @beta
 */
export class ChangeHiliteModeTool extends Tool {
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }
  public static override toolId = "ChangeHiliteMode";

  public override async run(mode?: string) {
    const hilites = IModelApp.viewManager.selectedView?.iModel.hilited;
    if (!hilites)
      return false;

    if (mode === "union" || mode === "intersection")
      hilites.modelSubCategoryMode = mode;

    return true;
  }

  public override async parseAndRun(...args: string[]) {
    return this.run(args[0]);
  }
}

/** Changes the selected viewport's hilite or emphasis settings.
 * @beta
 */
export abstract class ChangeHiliteTool extends Tool {
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 6; }

  public override async run(settings?: Hilite.Settings): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      this.apply(vp, settings);

    return true;
  }

  protected abstract apply(vp: Viewport, settings: Hilite.Settings | undefined): void;
  protected abstract getCurrentSettings(vp: Viewport): Hilite.Settings;

  public override async parseAndRun(...inputArgs: string[]): Promise<boolean> {
    if (0 === inputArgs.length)
      return this.run();

    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    const cur = this.getCurrentSettings(vp);
    const colors = cur.color.colors;
    let visible = cur.visibleRatio;
    let hidden = cur.hiddenRatio;
    let silhouette = cur.silhouette;

    const args = parseArgs(inputArgs);
    const parseColorComponent = (c: "r" | "g" | "b") => {
      const num = args.getInteger(c);
      if (undefined !== num)
        colors[c] = Math.floor(Math.max(0, Math.min(255, num)));
    };

    parseColorComponent("r");
    parseColorComponent("g");
    parseColorComponent("b");

    const silhouetteArg = args.getInteger("s");
    if (undefined !== silhouetteArg && silhouetteArg >= Hilite.Silhouette.None && silhouetteArg <= Hilite.Silhouette.Thick)
      silhouette = silhouetteArg;

    const v = args.getFloat("v");
    if (undefined !== v && v >= 0 && v <= 1)
      visible = v;

    const h = args.getFloat("h");
    if (undefined !== h && h >= 0 && h <= 1)
      hidden = h;

    if (undefined === silhouette)
      silhouette = cur.silhouette;

    if (undefined === visible)
      visible = cur.visibleRatio;

    if (undefined === hidden)
      hidden = cur.hiddenRatio;

    const settings: Hilite.Settings = {
      color: ColorDef.from(colors.r, colors.g, colors.b),
      silhouette,
      visibleRatio: visible,
      hiddenRatio: hidden,
    };

    return this.run(settings);
  }
}

/** Changes the selected viewport's hilite settings, or resets to defaults.
 * @beta
 */
export class ChangeHiliteSettingsTool extends ChangeHiliteTool {
  public static override toolId = "ChangeHiliteSettings";

  protected getCurrentSettings(vp: Viewport) { return vp.hilite; }
  protected apply(vp: Viewport, settings?: Hilite.Settings): void {
    vp.hilite = undefined !== settings ? settings : new Hilite.Settings();
  }
}

/** Changes the selected viewport's emphasis settings.
 * @beta
 */
export class ChangeEmphasisSettingsTool extends ChangeHiliteTool {
  public static override toolId = "ChangeEmphasisSettings";

  protected getCurrentSettings(vp: Viewport) { return vp.emphasisSettings; }
  protected apply(vp: Viewport, settings?: Hilite.Settings): void {
    if (undefined !== settings)
      vp.emphasisSettings = settings;
  }
}

/** Changes the [FlashSettings]($frontend) for the selected [Viewport]($frontend).
 * @beta
 */
export class ChangeFlashSettingsTool extends Tool {
  public static override toolId = "ChangeFlashSettings";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public override async run(settings?: FlashSettings): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      vp.flashSettings = settings ?? new FlashSettings();

    return true;
  }

  public override async parseAndRun(...inputArgs: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return true;

    if (1 === inputArgs.length && "default" === inputArgs[0].toLowerCase())
      return this.run();

    const options: FlashSettingsOptions = {};
    const args = parseArgs(inputArgs);

    const intensity = args.getFloat("i");
    if (undefined !== intensity)
      options.maxIntensity = intensity;

    const mode = args.get("m");
    if (mode) {
      switch (mode[0].toLowerCase()) {
        case "b":
          options.litMode = FlashMode.Brighten;
          break;
        case "h":
          options.litMode = FlashMode.Hilite;
          break;
        default:
          return false;
      }
    }

    const duration = args.getFloat("d");
    if (undefined !== duration)
      options.duration = BeDuration.fromSeconds(duration);

    return this.run(vp.flashSettings.clone(options));
  }
}

/** Enables or disables fade-out transparency mode for the selected viewport.
 * @beta
 */
export class FadeOutTool extends ViewportToggleTool {
  public static override toolId = "FadeOut";

  protected override async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== vp.isFadeOutActive)
      vp.isFadeOutActive = !vp.isFadeOutActive;

    return Promise.resolve();
  }
}

/** Sets the default tile size modifier used for all viewports that don't explicitly override it.
 * @beta
 */
export class DefaultTileSizeModifierTool extends Tool {
  public static override toolId = "DefaultTileSizeMod";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, setting the default tile size modifier used for all viewports that don't explicitly override it.
   * @param modifier the tile size modifier to use; if undefined, do not set modifier
   */
  public override async run(modifier?: number): Promise<boolean> {
    if (undefined !== modifier)
      IModelApp.tileAdmin.defaultTileSizeModifier = modifier;

    return true;
  }

  /** Executes this tool's run method with args[0] containing `modifier`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(Number.parseFloat(args[0]));
  }
}

/** Sets or clears the tile size modifier override for the selected viewport.
 * @beta
 */
export class ViewportTileSizeModifierTool extends Tool {
  public static override toolId = "ViewportTileSizeMod";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, setting the tile size modifier used for the selected viewport.
   * @param modifier the tile size modifier to use; if undefined, reset the modifier
   */
  public override async run(modifier?: number): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.setTileSizeModifier(modifier);

    return true;
  }

  /** Executes this tool's run method with args[0] containing the `modifier` argument or the string "reset" in order to reset the modifier.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const arg = args[0].toLowerCase();
    const modifier = "reset" === arg ? undefined : Number.parseFloat(args[0]);
    return this.run(modifier);
  }
}

/** This tool adds a reality model to the viewport.
 * @beta
 */
export class ViewportAddRealityModel extends Tool {
  public static override toolId = "ViewportAddRealityModel";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, adding a reality model to the viewport
   * @param url the URL which points to the reality model tileset
   */
  public override async run(url: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.displayStyle.attachRealityModel({ tilesetUrl: url });

    return true;
  }

  /** Executes this tool's run method with args[0] containing the `url` argument.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}

/** This tool adds a reality model to the viewport.
 * @beta
 */
export class LoadCesium extends Tool {
  public static override toolId = "LoadCesium";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  /** This method runs the tool, adding a reality model to the viewport
   * @param url the URL which points to the reality model tileset
   */
  public override async run(): Promise<boolean> {

    if (!process.env.LOAD_CESIUM_ACCESS_TOKEN || !process.env.LOAD_CESIUM_ITWIN_ID || !process.env.LOAD_CESIUM_IMODEL_ID)
      return false;

    const vp = IModelApp.viewManager.selectedView;

    // const obtainUrlArgs = {
    //   accessToken: process.env.LOAD_CESIUM_ACCESS_TOKEN,
    //   sessionId: IModelApp.sessionId,
    //   dataSource: {
    //     iTwinId: process.env.LOAD_CESIUM_ITWIN_ID,
    //     id: process.env.LOAD_CESIUM_IMODEL_ID,
    //     changeId: process.env.LOAD_CESIUM_CHANGESET_ID ?? "",
    //     type: "CESIUM",
    //   },
    //   format: "3DTILES",
    //   urlPrefix: "qa-",
    // };
    // const url = await obtainGraphicRepresentationUrl(obtainUrlArgs);
    // let urlstr = "";
    // if (url) {
    //   urlstr = url.href;
    // }

    const urlstr = `{"root":{"refine":"REPLACE","geometricError":2048.003125,"boundingVolume":{"box":[-0.049999999995634425,-0.05000000046129571,-0.049999999995634425,32768.05,0,0,0,32768.05,0,0,0,32768.05]},"content":{"uri":"16-0.glb","boundingVolume":{"box":[-844.5812097747803,-130.967457989168,161.02751973093154,4823.950738758653,0,0,0,5497.929707625012,0,0,0,161.43999660405106]}},"children":[{"refine":"REPLACE","geometricError":1024.0015625,"boundingVolume":{"box":[0.0,0.0,0.0,16384.025,0,0,0,16384.025,0,0,0,16384.025]},"content":{"uri":"15-1.glb","boundingVolume":{"box":[14216.254436816029,13253.735052910999,16381.231072787334,160.9491064777958,0,0,0,579.0343532412353,0,0,0,2.793927212667768]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-16384.074999999997,-16384.075000000463,-16384.074999999997,1]},{"refine":"REPLACE","geometricError":1024.0015624999999,"boundingVolume":{"box":[0.0,0.0,0.0,16384.024999999998,0,0,0,16384.025,0,0,0,16384.025]},"content":{"uri":"15-59.glb","boundingVolume":{"box":[-13227.24085734858,15417.53440431252,16383.84376156344,256.3633606589392,0,0,0,252.23893943054463,0,0,0,0.18123843656212557]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,16383.975000000002,-16384.075000000463,-16384.074999999997,1]},{"refine":"REPLACE","geometricError":1024.0015625,"boundingVolume":{"box":[-16384.074999999997,-16384.075000000463,16383.975000000002,16384.025,0,0,0,16384.025,0,0,0,16384.024999999998]},"content":{"uri":"15-93.glb","boundingVolume":{"box":[-2386.4230196021535,-2406.1749691003197,161.2337581674913,674.3231819592825,0,0,0,2406.1249690998584,0,0,0,161.2337581674913]}},"children":[{"refine":"REPLACE","geometricError":512.00078125,"boundingVolume":{"box":[-8192.062499999996,-8192.062500000462,8191.962500000003,8192.0125,0,0,0,8192.0125,0,0,0,8192.012499999999]},"content":{"uri":"14-97.glb","boundingVolume":{"box":[-2386.4230196021535,-2406.1749691003197,161.2337581674913,674.3231819592825,0,0,0,2406.1249690998584,0,0,0,161.2337581674913]}},"children":[{"refine":"REPLACE","geometricError":256.000390625,"boundingVolume":{"box":[-4096.056249999996,-4096.056250000462,4095.956250000004,4096.00625,0,0,0,4096.00625,0,0,0,4096.0062499999995]},"content":{"uri":"13-101.glb","boundingVolume":{"box":[-2386.4230196021535,-2408.498546231371,161.20875816749347,674.3231819592825,0,0,0,2408.44854623091,0,0,0,161.2587581674891]}},"children":[{"refine":"REPLACE","geometricError":128.0001953125,"boundingVolume":{"box":[0.0,0.0,0.0,2048.003125,0,0,0,2048.003125,0,0,0,2048.0031249999997]},"content":{"uri":"12-104.glb","boundingVolume":{"box":[-90.11636586976533,1686.0978463010497,-2035.600485450418,157.09397651720633,0,0,0,361.9052786989505,0,0,0,12.35263954973334]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2048.053124999996,-6144.059375000462,2047.953125000004,1]},{"refine":"REPLACE","geometricError":128.0001953125,"boundingVolume":{"box":[-2048.053124999996,-2048.0531250004615,2047.953125000004,2048.003125,0,0,0,2048.003125,0,0,0,2048.0031249999997]},"content":{"uri":"12-121.glb","boundingVolume":{"box":[-2386.4230196021535,-2048.0531250004615,161.20875816749347,674.3231819592825,0,0,0,2048.003125,0,0,0,161.2587581674891]}},"children":[{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[-3072.054687499996,-3072.0546875004616,1023.9515625000042,1024.0015625,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-122.glb","boundingVolume":{"box":[-2256.9643319843267,-3072.0546875004616,13.670364166160882,208.91120698433087,0,0,0,1024.0015625,0,0,0,13.720364166156516]}},"children":[{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2560.0539062499956,-3584.055468750462,511.9507812500043,512.0007812500003,0,0,0,512.0007812499998,0,0,0,512.0007812499999]},"content":{"uri":"10-125.glb","boundingVolume":{"box":[-2180.7745406590648,-3584.055468750462,13.724487482561342,132.72141565906895,0,0,0,512.0007812499998,0,0,0,13.725477165320335]}},"children":[{"refine":"REPLACE","geometricError":16.000024414062494,"boundingVolume":{"box":[0.0,0.0,0.0,256.0003906249999,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-128.glb","boundingVolume":{"box":[159.86134056475794,0.0,-242.21707496781602,96.13905006024197,0,0,0,256.0003906249999,0,0,0,13.73331565740412]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2304.0535156249957,-3840.0558593754618,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.000024414062494,"boundingVolume":{"box":[-2304.0535156249957,-3328.0550781254615,255.95039062500433,256.0003906249999,0,0,0,256.00039062500036,0,0,0,256.00039062499997]},"content":{"uri":"9-137.glb","boundingVolume":{"box":[-2180.7745406590648,-3328.0550781254615,10.353476347848341,132.72141565906895,0,0,0,256.00039062500036,0,0,0,10.354466030607334]}},"children":[{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-2.2737367544323206e-13,-2.2737367544323206e-13,0.0,128.00019531249995,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-139.glb","boundingVolume":{"box":[123.27897496593073,69.73350911936882,-119.11331910597667,4.721220346568998,0,0,0,36.85870293513449,0,0,0,8.837865889286675]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2432.0537109374955,-3200.0548828129613,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-2176.053320312496,-3456.0552734379617,127.95019531250435,128.00019531249973,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-140.glb","boundingVolume":{"box":[-2162.8590934751282,-3456.0552734379617,10.353476347848341,114.80596847513243,0,0,0,128.00019531250018,0,0,0,10.354466030607334]}},"children":[{"refine":"REPLACE","geometricError":4.0000061035156165,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,64.00009765624986,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-142.glb","boundingVolume":{"box":[13.194226837367296,29.630655964420612,-54.28856656674324,50.80587081888234,0,0,0,34.36944169182948,0,0,0,9.662520772270106]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2240.0534179687456,-3392.0551757817116,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515631,"boundingVolume":{"box":[0.0,0.0,0.0,64.00009765625009,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-143.glb","boundingVolume":{"box":[38.483950577189944,0.0,-53.96714334830746,25.516147079060147,0,0,0,64.00009765625009,0,0,0,9.982954307990916]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2112.053222656246,-3520.0553710942118,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515631,"boundingVolume":{"box":[-2112.053222656246,-3392.0551757817116,63.95009765625436,64.00009765625009,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-144.glb","boundingVolume":{"box":[-2112.053222656246,-3392.0551757817116,10.34944776457551,64.00009765625009,0,0,0,64.00009765625009,0,0,0,10.350437447334503]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2144.053271484371,-3424.055224609837,31.95004882812936,32.00004882812482,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-145.glb","boundingVolume":{"box":[-2144.053271484371,-3394.513474108185,8.825677474980102,32.00004882812482,0,0,0,2.458298326473596,0,0,0,8.826667157739095]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2144.053271484371,-3360.0551269535863,31.95004882812936,32.00004882812482,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-146.glb","boundingVolume":{"box":[-2144.053271484371,-3360.0551269535863,8.794878094297188,32.00004882812482,0,0,0,32.00004882812527,0,0,0,8.79586777705618]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2080.0531738281206,-3424.055224609837,31.95004882812936,32.00004882812527,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-147.glb","boundingVolume":{"box":[-2080.0531738281206,-3424.055224609837,10.34820842113462,32.00004882812527,0,0,0,32.00004882812482,0,0,0,10.349198103893613]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2080.0531738281206,-3360.0551269535863,31.95004882812936,32.00004882812527,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-148.glb","boundingVolume":{"box":[-2080.0531738281206,-3360.0551269535863,9.982526665326139,32.00004882812527,0,0,0,32.00004882812527,0,0,0,9.983516348085132]}}}]}]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[2.2737367544323206e-13,-2.2737367544323206e-13,0.0,128.00019531249995,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-157.glb","boundingVolume":{"box":[2.2737367544323206e-13,-2.2737367544323206e-13,-118.78683543549357,128.00019531249995,0,0,0,128.00019531249995,0,0,0,9.164349559769775]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2176.053320312496,-3200.0548828129613,127.95019531250435,1]}]}]},{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2560.0539062499956,-2560.0539062504613,511.9507812500043,512.0007812500003,0,0,0,512.0007812500003,0,0,0,512.0007812499999]},"content":{"uri":"10-174.glb","boundingVolume":{"box":[-2282.2865349644735,-2560.0539062504613,10.353108093750997,183.58900400418406,0,0,0,512.0007812500003,0,0,0,10.403108093746631]}},"children":[{"refine":"REPLACE","geometricError":16.000024414062494,"boundingVolume":{"box":[-2304.0535156249957,-2816.0542968754617,255.95039062500433,256.0003906249999,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-177.glb","boundingVolume":{"box":[-2282.2865349644735,-2816.0542968754617,10.353108093750997,183.58900400418406,0,0,0,256.0003906249999,0,0,0,10.403108093746631]}},"children":[{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-2.2737367544323206e-13,2.2737367544323206e-13,0.0,128.00019531249995,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-178.glb","boundingVolume":{"box":[69.51062304616971,39.416108309060064,-120.64705125108529,58.489572266330015,0,0,0,88.58408700344012,0,0,0,7.303144061426252]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2432.0537109374955,-2944.054492187962,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,128.00019531249995,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-179.glb","boundingVolume":{"box":[47.08918364066881,0.0,-117.59386872140854,80.91101167183092,0,0,0,128.00019531250018,0,0,0,10.406326591091442]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2432.0537109374955,-2688.0541015629615,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[2.2737367544323206e-13,2.2737367544323206e-13,0.0,128.00019531249995,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-180.glb","boundingVolume":{"box":[-25.322202980146812,2.2737367544323206e-13,-120.70681034648331,102.67799233235291,0,0,0,128.00019531249995,0,0,0,7.2433849664944745]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2176.053320312496,-2944.054492187962,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[2.2737367544323206e-13,0.0,0.0,128.00019531249995,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-181.glb","boundingVolume":{"box":[-51.3898544101462,0.0,-118.53495155349549,76.61034090235353,0,0,0,128.00019531250018,0,0,0,9.465243759004494]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2176.053320312496,-2688.0541015629615,127.95019531250435,1]}]},{"refine":"REPLACE","geometricError":16.000024414062494,"boundingVolume":{"box":[0.0,0.0,0.0,256.0003906249999,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-186.glb","boundingVolume":{"box":[3.4866452514202138,0.0,-245.8120738829141,133.73707235778647,0,0,0,256.0003906249999,0,0,0,10.188316742085874]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-2304.0535156249957,-2304.0535156254614,255.95039062500433,1]}]}]},{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[0.0,0.0,0.0,1024.0015625,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-195.glb","boundingVolume":{"box":[517.65502421928,0.0,-862.7178043327151,506.3465382807201,0,0,0,1024.0015625,0,0,0,161.23375816769328]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-3072.054687499996,-1024.0515625004614,1023.9515625000042,1]},{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[-1024.0515624999957,-3072.0546875004616,1023.9515625000042,1024.0015625,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-204.glb","boundingVolume":{"box":[-1893.3649629237334,-3588.7893483205453,21.239691802130984,154.68816207626242,0,0,0,504.1837105404725,0,0,0,21.28969180212662]}},"children":[{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-1536.0523437499958,-3584.055468750462,511.9507812500043,512.00078125,0,0,0,512.0007812499998,0,0,0,512.0007812499999]},"content":{"uri":"10-205.glb","boundingVolume":{"box":[-1893.3649629237334,-3588.7893483205453,21.239691802130984,154.68816207626242,0,0,0,504.1837105404725,0,0,0,21.28969180212662]}},"children":[{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[-1792.052734374996,-3840.0558593754618,255.95039062500433,256.0003906249999,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-206.glb","boundingVolume":{"box":[-1916.0607689162346,-3838.5142638057396,21.239691802130984,131.99235608376125,0,0,0,254.4587950552782,0,0,0,21.28969180212662]}},"children":[{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[0.0,-2.2737367544323206e-13,0.0,128.00019531249995,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-207.glb","boundingVolume":{"box":[-64.23354669141429,1.5415955697217214,-106.68550351047452,63.766648621085665,0,0,0,126.458599742778,0,0,0,21.264691802227787]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1920.0529296874959,-3968.0560546879615,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-1920.0529296874959,-3712.055664062962,127.95019531250435,128.00019531249995,0,0,0,128.00019531249973,0,0,0,128.00019531249998]},"content":{"uri":"8-208.glb","boundingVolume":{"box":[-1950.8874273915899,-3712.055664062962,19.475189940414214,97.16569760840594,0,0,0,128.00019531249973,0,0,0,19.52518994040985]}},"children":[{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1.1368683772161603e-13,-2.2737367544323206e-13,0.0,64.00009765624998,0,0,0,64.00009765624986,0,0,0,64.00009765624999]},"content":{"uri":"7-209.glb","boundingVolume":{"box":[-1.1368683772161603e-13,-2.2737367544323206e-13,-44.46326298042074,64.00009765624998,0,0,0,64.00009765624986,0,0,0,19.4868346758835]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1984.0530273437457,-3776.0557617192117,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1984.0530273437457,-3648.055566406712,63.95009765625436,64.00009765625009,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-210.glb","boundingVolume":{"box":[-1984.0530273437457,-3648.055566406712,12.608575243825793,64.00009765625009,0,0,0,64.00009765625009,0,0,0,12.658575243821428]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2016.0530761718708,-3680.055615234837,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-211.glb","boundingVolume":{"box":[-2017.7238378814905,-3680.055615234837,12.608575243825793,30.329287118505363,0,0,0,32.00004882812482,0,0,0,12.658575243821428]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2016.0530761718708,-3616.0555175785867,31.95004882812936,32.000048828125045,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-212.glb","boundingVolume":{"box":[-2016.0530761718708,-3616.0555175785867,12.07430278660944,32.000048828125045,0,0,0,32.00004882812527,0,0,0,12.07430278660944]}}},{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1952.052978515621,-3680.055615234837,31.95004882812936,32.00004882812482,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-221.glb","boundingVolume":{"box":[-1951.981730070475,-3680.055615234837,12.062776122059173,31.928800382978807,0,0,0,32.00004882812482,0,0,0,12.062776122098082]}}},{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1952.052978515621,-3616.0555175785867,31.95004882812936,32.00004882812482,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-222.glb","boundingVolume":{"box":[-1952.052978515621,-3616.0555175785867,9.396632800062179,32.00004882812482,0,0,0,32.00004882812527,0,0,0,9.396632800303703]}}}]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[1.1368683772161603e-13,-2.2737367544323206e-13,0.0,64.00009765624998,0,0,0,64.00009765624986,0,0,0,64.00009765624999]},"content":{"uri":"7-227.glb","boundingVolume":{"box":[-57.19775060308734,36.93182134791209,-63.95009765620946,6.802347053162521,0,0,0,27.068276308337545,0,0,0,6.460965096266591e-11]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1856.052832031246,-3776.0557617192117,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-228.glb","boundingVolume":{"box":[-30.834497704093792,0.0,-55.62877314274372,33.16559995215607,0,0,0,64.00009765625009,0,0,0,8.321324513708241]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1856.052832031246,-3648.055566406712,63.95009765625436,1]}]},{"refine":"REPLACE","geometricError":8.000012207031254,"boundingVolume":{"box":[-1.1368683772161603e-13,2.2737367544323206e-13,0.0,128.00019531250007,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-234.glb","boundingVolume":{"box":[-120.32359407918193,127.50087393832837,-127.95019531250435,0.3077203092043419,0,0,0,0.49932137417181366,0,0,0,0.0]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1664.0525390624957,-3712.055664062962,127.95019531250435,1]}]},{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[-1792.052734374996,-3328.0550781254615,255.95039062500433,256.0003906249999,0,0,0,256.00039062500036,0,0,0,256.00039062499997]},"content":{"uri":"9-239.glb","boundingVolume":{"box":[-1893.3649629237334,-3334.3305532652676,11.057314613767256,154.68816207626242,0,0,0,249.7249154851943,0,0,0,11.10731461376289]}},"children":[{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-1920.0529296874959,-3456.0552734379617,127.95019531250435,128.00019531249995,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-240.glb","boundingVolume":{"box":[-1920.0529296874959,-3456.0552734379617,11.058265946620704,128.00019531249995,0,0,0,128.00019531250018,0,0,0,11.108265946616338]}},"children":[{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1984.0530273437457,-3520.0553710942118,63.95009765625436,64.00009765625009,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-241.glb","boundingVolume":{"box":[-1984.0530273437457,-3520.0553710942118,11.058265946620704,64.00009765625009,0,0,0,64.00009765625009,0,0,0,11.108265946616338]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2016.0530761718708,-3552.055419922337,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-242.glb","boundingVolume":{"box":[-2016.0530761718708,-3552.055419922337,11.062925475557156,32.000048828125045,0,0,0,32.00004882812482,0,0,0,11.11292547555279]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-2016.0530761718708,-3488.0553222660865,31.95004882812936,32.000048828125045,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-243.glb","boundingVolume":{"box":[-2016.0530761718708,-3488.0553222660865,10.95667624174233,32.000048828125045,0,0,0,32.00004882812527,0,0,0,10.95667624174233]}},"children":[{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-2032.0531005859334,-3504.0553466801493,15.950024414066863,16.00002441406241,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-244.glb","boundingVolume":{"box":[-2032.0531005859334,-3504.0553466801493,10.956751981908745,16.00002441406241,0,0,0,16.00002441406241,0,0,0,10.956751981908745]}}},{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-2032.0531005859334,-3472.055297852024,15.950024414066863,16.00002441406241,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-245.glb","boundingVolume":{"box":[-2032.0531005859334,-3472.055297852024,10.666632774157693,16.00002441406241,0,0,0,16.00002441406241,0,0,0,10.666632774157693]}}},{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-2000.0530517578081,-3504.0553466801493,15.950024414066863,16.000024414062636,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-246.glb","boundingVolume":{"box":[-2000.0530517578081,-3504.0553466801493,10.566402256254646,16.000024414062636,0,0,0,16.00002441406241,0,0,0,10.566402256254646]}}},{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-2000.0530517578081,-3472.055297852024,15.950024414066863,16.000024414062636,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-247.glb","boundingVolume":{"box":[-2000.0530517578081,-3472.055297852024,9.956023036902645,16.000024414062636,0,0,0,16.00002441406241,0,0,0,9.956023036902645]}}}]},{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1952.052978515621,-3552.055419922337,31.95004882812936,32.00004882812482,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-252.glb","boundingVolume":{"box":[-1952.052978515621,-3552.055419922337,10.36999999992228,32.00004882812482,0,0,0,32.00004882812482,0,0,0,10.370000000077725]}}},{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1952.052978515621,-3488.0553222660865,31.95004882812936,32.00004882812482,0,0,0,32.00004882812527,0,0,0,32.000048828124996]},"content":{"uri":"6-253.glb","boundingVolume":{"box":[-1952.052978515621,-3488.0553222660865,7.025398203874338,32.00004882812482,0,0,0,32.00004882812527,0,0,0,7.025398203884185]}}}]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-258.glb","boundingVolume":{"box":[-1.1368683772161603e-13,0.0,-53.57670539286211,64.00009765624998,0,0,0,64.00009765625009,0,0,0,10.374381946151239]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1984.0530273437457,-3392.0551757817116,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-259.glb","boundingVolume":{"box":[1.1368683772161603e-13,0.0,-56.199348602971426,64.00009765624998,0,0,0,64.00009765625009,0,0,0,7.750749053595456]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1856.052832031246,-3520.0553710942118,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-260.glb","boundingVolume":{"box":[1.1368683772161603e-13,0.0,-60.05924159894226,64.00009765624998,0,0,0,64.00009765625009,0,0,0,3.8918457400710906]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1856.052832031246,-3392.0551757817116,63.95009765625436,1]}]},{"refine":"REPLACE","geometricError":8.000012207031247,"boundingVolume":{"box":[-1920.0529296874959,-3200.0548828129613,127.95019531250435,128.00019531249995,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-265.glb","boundingVolume":{"box":[-1920.0529296874959,-3206.862902944548,9.454463337331445,128.00019531249995,0,0,0,121.19217518091364,0,0,0,9.455453020090438]}},"children":[{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-266.glb","boundingVolume":{"box":[-1.1368683772161603e-13,0.0,-56.94496147282317,64.00009765624998,0,0,0,64.00009765625009,0,0,0,7.006125866190182]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1984.0530273437457,-3264.0549804692114,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1.1368683772161603e-13,2.2737367544323206e-13,0.0,64.00009765624998,0,0,0,64.00009765624986,0,0,0,64.00009765624999]},"content":{"uri":"7-267.glb","boundingVolume":{"box":[-1.1368683772161603e-13,-7.739933258211295,-54.480692595290094,64.00009765624998,0,0,0,56.26016439803834,0,0,0,9.470394743723254]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1984.0530273437457,-3136.0547851567117,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[1.1368683772161603e-13,0.0,0.0,64.00009765624998,0,0,0,64.00009765625009,0,0,0,64.00009765624999]},"content":{"uri":"7-268.glb","boundingVolume":{"box":[1.1368683772161603e-13,0.0,-61.31347768164136,64.00009765624998,0,0,0,64.00009765625009,0,0,0,2.637609657371989]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1856.052832031246,-3264.0549804692114,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515624,"boundingVolume":{"box":[-1856.052832031246,-3136.0547851567117,63.95009765625436,64.00009765624986,0,0,0,64.00009765624964,0,0,0,64.00009765624999]},"content":{"uri":"7-269.glb","boundingVolume":{"box":[-1856.052832031246,-3142.8628052882977,8.516958710340743,64.00009765624986,0,0,0,57.192077524663546,0,0,0,8.517948393099736]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1888.0528808593708,-3168.0548339848365,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-270.glb","boundingVolume":{"box":[-1888.0528808593708,-3168.0548339848365,8.516958710340743,32.000048828125045,0,0,0,32.00004882812482,0,0,0,8.517948393099736]}},"children":[{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-1904.0529052734332,-3184.054858398899,15.950024414066863,16.000024414062636,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-271.glb","boundingVolume":{"box":[-1904.0529052734332,-3184.054858398899,8.2332658745523,16.000024414062636,0,0,0,16.00002441406241,0,0,0,8.234255557311293]}}},{"refine":"REPLACE","geometricError":1.0000015258789077,"boundingVolume":{"box":[-1904.0529052734332,-3152.054809570774,15.950024414066863,16.000024414062636,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-272.glb","boundingVolume":{"box":[-1904.0529052734332,-3152.054809570774,8.516958710340743,16.000024414062636,0,0,0,16.00002441406241,0,0,0,8.517948393099736]}}},{"refine":"REPLACE","geometricError":1.0000015258789006,"boundingVolume":{"box":[-1872.0528564453084,-3184.054858398899,15.950024414066863,16.00002441406241,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-273.glb","boundingVolume":{"box":[-1872.0528564453084,-3184.054858398899,8.345077732464807,16.00002441406241,0,0,0,16.00002441406241,0,0,0,8.3460674152238]}}},{"refine":"REPLACE","geometricError":1.0000015258789006,"boundingVolume":{"box":[-1872.0528564453084,-3152.054809570774,15.950024414066863,16.00002441406241,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-274.glb","boundingVolume":{"box":[-1872.0528564453084,-3152.054809570774,8.334914509607687,16.00002441406241,0,0,0,16.00002441406241,0,0,0,8.33590419236668]}}}]},{"refine":"REPLACE","geometricError":2.0000030517578082,"boundingVolume":{"box":[-1888.0528808593708,-3104.054736328587,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-279.glb","boundingVolume":{"box":[-1888.0528808593708,-3111.4816497027377,8.09435700650132,32.000048828125045,0,0,0,24.57313545397392,0,0,0,8.095346689260314]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-1824.052783203121,-3168.0548339848365,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-280.glb","boundingVolume":{"box":[-1824.052783203121,-3168.0548339848365,3.215974125345504,32.000048828125045,0,0,0,32.00004882812482,0,0,0,3.216963808104497]}}},{"refine":"REPLACE","geometricError":2.0000030517578153,"boundingVolume":{"box":[-1824.052783203121,-3104.054736328587,31.95004882812936,32.000048828125045,0,0,0,32.00004882812482,0,0,0,32.000048828124996]},"content":{"uri":"6-281.glb","boundingVolume":{"box":[-1824.052783203121,-3110.862756460173,3.626557959793891,32.000048828125045,0,0,0,25.192028696538728,0,0,0,3.627547642552884]}}}]}]},{"refine":"REPLACE","geometricError":8.000012207031254,"boundingVolume":{"box":[-1.1368683772161603e-13,0.0,0.0,128.00019531250007,0,0,0,128.00019531250018,0,0,0,128.00019531249998]},"content":{"uri":"8-290.glb","boundingVolume":{"box":[-120.79721807431201,0.0,-125.1372683204071,7.2029772381881685,0,0,0,128.00019531250018,0,0,0,2.8139166748562445]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1664.0525390624957,-3456.0552734379617,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.000012207031254,"boundingVolume":{"box":[-1.1368683772161603e-13,-2.2737367544323206e-13,0.0,128.00019531250007,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-291.glb","boundingVolume":{"box":[-101.31222854873783,-6.275475139806076,-125.28158935964701,26.687966763762347,0,0,0,121.7247201726941,0,0,0,2.669595635616332]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1664.0525390624957,-3200.0548828129613,127.95019531250435,1]}]}]}]},{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[0.0,0.0,0.0,1024.0015625,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-309.glb","boundingVolume":{"box":[-856.0249188214376,71.05597276922924,-990.0204731004944,167.97664367856248,0,0,0,807.1893236798609,0,0,0,33.931089400022756]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1024.0515624999957,-1024.0515625004614,1023.9515625000042,1]}]}]}]}]},{"refine":"REPLACE","geometricError":1024.0015625,"boundingVolume":{"box":[-16384.074999999997,16383.974999999537,16383.975000000002,16384.025,0,0,0,16384.024999999998,0,0,0,16384.024999999998]},"content":{"uri":"15-350.glb","boundingVolume":{"box":[-2834.2909742667143,1159.8375678736331,107.70000006361865,2834.2409742667187,0,0,0,1159.8875678740944,0,0,0,107.70000006361865]}},"children":[{"refine":"REPLACE","geometricError":512.00078125,"boundingVolume":{"box":[-8192.062499999996,8191.962499999538,8191.962500000003,8192.0125,0,0,0,8192.012499999999,0,0,0,8192.012499999999]},"content":{"uri":"14-353.glb","boundingVolume":{"box":[-2834.2909742667143,1159.8375678736331,107.70000006361865,2834.2409742667187,0,0,0,1159.8875678740944,0,0,0,107.70000006361865]}},"children":[{"refine":"REPLACE","geometricError":256.000390625,"boundingVolume":{"box":[-4096.056249999996,4095.956249999538,4095.956250000004,4096.00625,0,0,0,4096.0062499999995,0,0,0,4096.0062499999995]},"content":{"uri":"13-356.glb","boundingVolume":{"box":[-2834.2909742667143,1159.8375678736331,107.70000006356602,2834.2409742667187,0,0,0,1159.8875678740944,0,0,0,107.70000006367124]}},"children":[{"refine":"REPLACE","geometricError":128.0001953125,"boundingVolume":{"box":[0.0,0.0,0.0,2048.003125,0,0,0,2048.0031249999997,0,0,0,2048.0031249999997]},"content":{"uri":"12-357.glb","boundingVolume":{"box":[1261.7652757332817,-1328.768655981407,-1898.492616583858,786.2378492667185,0,0,0,658.5615310575813,0,0,0,65.93949171109125]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-6144.059374999996,2047.9531249995384,2047.953125000004,1]},{"refine":"REPLACE","geometricError":128.0001953125,"boundingVolume":{"box":[-2048.053124999996,2047.9531249995384,2047.953125000004,2048.003125,0,0,0,2048.0031249999997,0,0,0,2048.0031249999997]},"content":{"uri":"12-359.glb","boundingVolume":{"box":[-2048.053124999996,1159.8375678736331,100.11465582325408,2048.003125,0,0,0,1159.8875678740944,0,0,0,100.1146558237048]}},"children":[{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[0.0,0.0,0.0,1024.0015625,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-360.glb","boundingVolume":{"box":[0.0,-24.46323614902201,-923.8140924384372,1024.0015625,0,0,0,999.5383263509779,0,0,0,100.13747006201777]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-3072.054687499996,1023.9515624995386,1023.9515625000042,1]},{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[-1024.0515624999957,1023.9515624995386,1023.9515625000042,1024.0015625,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-370.glb","boundingVolume":{"box":[-1024.0515624999957,1698.9240026848877,70.77662142603616,1024.0015625,0,0,0,349.02912231465075,0,0,0,70.77662142633295]}},"children":[{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[0.0,0.0,0.0,512.00078125,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1536.0523437499958,511.95078124953864,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,512.00078125,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-372.glb","boundingVolume":{"box":[0.0,176.91327539128133,-441.5307448259308,512.00078125,0,0,0,335.0875058587185,0,0,0,70.42003642412016]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1536.0523437499958,1535.9523437495386,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-512.0507812499957,1535.9523437495386,511.9507812500043,512.00078125,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-382.glb","boundingVolume":{"box":[-512.0507812499957,1698.9240026848877,51.33758569160882,512.00078125,0,0,0,349.02912231465075,0,0,0,51.337585692733]}},"children":[{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,256.000390625,0,0,0,256.000390625,0,0,0,256.00039062499997]},"content":{"uri":"9-383.glb","boundingVolume":{"box":[0.0,164.57146578542563,-225.24022216189155,256.000390625,0,0,0,91.42892483957428,0,0,0,30.71016846311278]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-768.0511718749957,1279.9519531245387,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[0.0,0.0,0.0,256.000390625,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-384.glb","boundingVolume":{"box":[0.0,-4.572772225765448,-204.6128049328517,256.000390625,0,0,0,251.42761839923446,0,0,0,51.33758569218918]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-768.0511718749957,1791.9527343745385,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,256.000390625,0,0,0,256.000390625,0,0,0,256.00039062499997]},"content":{"uri":"9-385.glb","boundingVolume":{"box":[0.0,162.97165893534907,-224.9212425231977,256.000390625,0,0,0,93.02873168965084,0,0,0,31.02914810180664]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-256.05039062499566,1279.9519531245387,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.0000244140625,"boundingVolume":{"box":[-256.05039062499566,1791.9527343745385,255.95039062500433,256.000390625,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-386.glb","boundingVolume":{"box":[-256.05039062499566,1791.9527343745385,48.08275342768812,256.000390625,0,0,0,256.0003906249999,0,0,0,48.082753428812296]}},"children":[{"refine":"REPLACE","geometricError":8.00001220703125,"boundingVolume":{"box":[0.0,0.0,0.0,128.0001953125,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-387.glb","boundingVolume":{"box":[0.0,0.0,-79.89267983566164,128.0001953125,0,0,0,128.00019531249995,0,0,0,48.05751547684271]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-384.05058593749567,1663.9525390620386,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.00001220703125,"boundingVolume":{"box":[0.0,0.0,0.0,128.0001953125,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-388.glb","boundingVolume":{"box":[0.0,-9.911470718877467,-79.86744188427735,128.0001953125,0,0,0,118.08872459362249,0,0,0,48.082753428273435]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-384.05058593749567,1919.9529296870385,127.95019531250435,1]},{"refine":"REPLACE","geometricError":8.00001220703125,"boundingVolume":{"box":[-128.05019531249565,1663.9525390620386,127.95019531250435,128.0001953125,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-389.glb","boundingVolume":{"box":[-128.05019531249565,1663.9525390620386,32.152517530724914,128.0001953125,0,0,0,128.00019531249995,0,0,0,32.15251753184909]}},"children":[{"refine":"REPLACE","geometricError":4.000006103515625,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,64.00009765625,0,0,0,64.00009765624998,0,0,0,64.00009765624999]},"content":{"uri":"7-390.glb","boundingVolume":{"box":[0.0,-1.1368683772161603e-13,-38.62870188962693,64.00009765625,0,0,0,64.00009765624998,0,0,0,25.321395766823215]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-192.05029296874565,1599.9524414057887,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515625,"boundingVolume":{"box":[-192.05029296874565,1727.9526367182884,63.95009765625436,64.00009765625,0,0,0,64.00009765624986,0,0,0,64.00009765624999]},"content":{"uri":"7-391.glb","boundingVolume":{"box":[-192.05029296874565,1727.9526367182884,26.635088456142928,64.00009765625,0,0,0,64.00009765624986,0,0,0,26.635088456206855]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-224.05034179687067,1695.9525878901636,31.95004882812936,32.00004882812499,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-392.glb","boundingVolume":{"box":[-224.05034179687067,1695.9525878901636,26.63508845617328,32.00004882812499,0,0,0,32.000048828125045,0,0,0,26.635088456176504]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-224.05034179687067,1759.9526855464135,31.95004882812936,32.00004882812499,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-393.glb","boundingVolume":{"box":[-224.05034179687067,1759.9526855464135,26.475288391110197,32.00004882812499,0,0,0,32.000048828125045,0,0,0,26.4752883911164]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-160.05024414062063,1695.9525878901636,31.95004882812936,32.00004882812502,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-394.glb","boundingVolume":{"box":[-160.05024414062063,1695.9525878901636,24.031399372313842,32.00004882812502,0,0,0,32.000048828125045,0,0,0,24.03139937302806]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-160.05024414062063,1759.9526855464135,31.95004882812936,32.00004882812502,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-395.glb","boundingVolume":{"box":[-160.05024414062063,1759.9526855464135,24.84918253331118,32.00004882812502,0,0,0,32.000048828125045,0,0,0,24.849182533977228]}}}]},{"refine":"REPLACE","geometricError":4.000006103515625,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,64.00009765625,0,0,0,64.00009765624998,0,0,0,64.00009765624999]},"content":{"uri":"7-400.glb","boundingVolume":{"box":[0.0,-1.1368683772161603e-13,-35.397037687211785,64.00009765625,0,0,0,64.00009765624998,0,0,0,28.553059969334726]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-64.05009765624564,1599.9524414057887,63.95009765625436,1]},{"refine":"REPLACE","geometricError":4.000006103515625,"boundingVolume":{"box":[-64.05009765624564,1727.9526367182884,63.95009765625436,64.00009765625,0,0,0,64.00009765624986,0,0,0,64.00009765624999]},"content":{"uri":"7-401.glb","boundingVolume":{"box":[-64.05009765624564,1727.9526367182884,32.152517530724914,64.00009765625,0,0,0,64.00009765624986,0,0,0,32.15251753184909]}},"children":[{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-96.05014648437064,1695.9525878901636,31.95004882812936,32.000048828125,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-402.glb","boundingVolume":{"box":[-96.05014648437064,1695.9525878901636,23.825597775422075,32.000048828125,0,0,0,32.000048828125045,0,0,0,23.825597775604102]}},"children":[{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-112.05017089843315,1679.9525634761012,15.950024414066863,16.000024414062494,0,0,0,16.000024414062636,0,0,0,16.000024414062498]},"content":{"uri":"5-403.glb","boundingVolume":{"box":[-112.05017089843315,1679.9525634761012,1.1727507853720454e-10,16.000024414062494,0,0,0,16.000024414062636,0,0,0,1.7244872196897632e-10]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-112.05017089843315,1711.952612304226,15.950024414066863,16.000024414062494,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-404.glb","boundingVolume":{"box":[-112.05017089843315,1711.952612304226,2.3668178528168937e-11,16.000024414062494,0,0,0,16.00002441406241,0,0,0,2.3668178528168937e-11]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-80.05012207030813,1679.9525634761012,15.950024414066863,16.00002441406251,0,0,0,16.000024414062636,0,0,0,16.000024414062498]},"content":{"uri":"5-405.glb","boundingVolume":{"box":[-80.05012207030813,1679.9525634761012,8.198242085200036e-11,16.00002441406251,0,0,0,16.000024414062636,0,0,0,1.6974865957308793e-10]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-80.05012207030813,1711.952612304226,15.950024414066863,16.00002441406251,0,0,0,16.00002441406241,0,0,0,16.000024414062498]},"content":{"uri":"5-406.glb","boundingVolume":{"box":[-80.05012207030813,1711.952612304226,-5.290701210469706e-11,16.00002441406251,0,0,0,16.00002441406241,0,0,0,1.291198259423254e-10]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-112.05017089843315,1679.9525634761012,47.95007324219186,16.000024414062494,0,0,0,16.000024414062636,0,0,0,16.0000244140625]},"content":{"uri":"5-407.glb","boundingVolume":{"box":[-112.05017089843315,1679.9525634761012,45.456382324727684,16.000024414062494,0,0,0,16.000024414062636,0,0,0,0.9426263116533988]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-112.05017089843315,1711.952612304226,47.95007324219186,16.000024414062494,0,0,0,16.00002441406241,0,0,0,16.0000244140625]},"content":{"uri":"5-408.glb","boundingVolume":{"box":[-112.05017089843315,1711.952612304226,46.15222874698596,16.000024414062494,0,0,0,16.00002441406241,0,0,0,0.8579336065297056]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-80.05012207030813,1679.9525634761012,47.95007324219186,16.00002441406251,0,0,0,16.000024414062636,0,0,0,16.0000244140625]},"content":{"uri":"5-409.glb","boundingVolume":{"box":[-80.05012207030813,1679.9525634761012,44.675218497872706,16.00002441406251,0,0,0,16.000024414062636,0,0,0,1.8238162151578265]}}},{"refine":"REPLACE","geometricError":1.0000015258789063,"boundingVolume":{"box":[-80.05012207030813,1711.952612304226,47.95007324219186,16.00002441406251,0,0,0,16.00002441406241,0,0,0,16.0000244140625]},"content":{"uri":"5-410.glb","boundingVolume":{"box":[-80.05012207030813,1711.952612304226,45.93704415612834,16.00002441406251,0,0,0,16.00002441406241,0,0,0,1.7141513948978329]}}}]},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-96.05014648437064,1759.9526855464135,31.95004882812936,32.000048828125,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-411.glb","boundingVolume":{"box":[-96.05014648437064,1759.9526855464135,25.72675070529044,32.000048828125,0,0,0,32.000048828125045,0,0,0,25.72675070582778]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-32.05004882812064,1695.9525878901636,31.95004882812936,32.000048828125,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-412.glb","boundingVolume":{"box":[-32.05004882812064,1695.9525878901636,29.933534544575913,32.000048828125,0,0,0,32.000048828125045,0,0,0,29.93353454630644]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-32.05004882812064,1759.9526855464135,31.95004882812936,32.000048828125,0,0,0,32.000048828125045,0,0,0,32.000048828124996]},"content":{"uri":"6-413.glb","boundingVolume":{"box":[-32.05004882812064,1759.9526855464135,31.97504882756509,32.000048828125,0,0,0,32.000048828125045,0,0,0,31.975048828689268]}}},{"refine":"REPLACE","geometricError":2.0000030517578127,"boundingVolume":{"box":[-32.05004882812064,1759.9526855464135,95.95014648437936,32.000048828125,0,0,0,32.000048828125045,0,0,0,32.000048828125]},"content":{"uri":"6-417.glb","boundingVolume":{"box":[-4.368419931978574,1789.5456096309822,64.12756635941417,2.534833284588082,0,0,0,2.407124743556551,0,0,0,0.17746870315981766]}}}]}]},{"refine":"REPLACE","geometricError":8.00001220703125,"boundingVolume":{"box":[0.0,0.0,0.0,128.0001953125,0,0,0,128.00019531249995,0,0,0,128.00019531249998]},"content":{"uri":"8-422.glb","boundingVolume":{"box":[0.0,0.0,-92.30177688609186,128.0001953125,0,0,0,128.00019531249995,0,0,0,35.64841842661491]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-128.05019531249565,1919.9529296870385,127.95019531250435,1]}]}]}]},{"refine":"REPLACE","geometricError":64.00009765625,"boundingVolume":{"box":[0.0,-2.2737367544323206e-13,0.0,1024.0015625,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-435.glb","boundingVolume":{"box":[85.16489132681306,-888.1155571259055,-959.278503480085,938.836671173187,0,0,0,135.88600537409457,0,0,0,64.67305901998134]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,-1024.0515624999957,3071.9546874995385,1023.9515625000042,1]}]}]}]}]},{"refine":"REPLACE","geometricError":1024.0015624999999,"boundingVolume":{"box":[16383.975000000002,-16384.075000000463,16383.975000000002,16384.024999999998,0,0,0,16384.025,0,0,0,16384.024999999998]},"content":{"uri":"15-463.glb","boundingVolume":{"box":[1851.6242390937114,-2814.473582807321,25.419462185895455,1559.5840175209742,0,0,0,2814.4235828068595,0,0,0,25.46946218589109]}},"children":[{"refine":"REPLACE","geometricError":512.0007812499999,"boundingVolume":{"box":[8191.962500000003,-8192.062500000462,8191.962500000003,8192.012499999999,0,0,0,8192.0125,0,0,0,8192.012499999999]},"content":{"uri":"14-465.glb","boundingVolume":{"box":[1851.6242390937114,-2814.473582807321,25.419462185895455,1559.5840175209742,0,0,0,2814.4235828068595,0,0,0,25.46946218589109]}},"children":[{"refine":"REPLACE","geometricError":256.00039062499997,"boundingVolume":{"box":[4095.956250000004,-4096.056250000462,4095.956250000004,4096.0062499999995,0,0,0,4096.00625,0,0,0,4096.0062499999995]},"content":{"uri":"13-467.glb","boundingVolume":{"box":[1851.6242390937114,-2814.473582807321,25.419462185895455,1559.5840175209742,0,0,0,2814.4235828068595,0,0,0,25.46946218589109]}},"children":[{"refine":"REPLACE","geometricError":128.00019531249998,"boundingVolume":{"box":[0.0,0.0,0.0,2048.0031249999997,0,0,0,2048.003125,0,0,0,2048.0031249999997]},"content":{"uri":"12-468.glb","boundingVolume":{"box":[-951.4588313170985,1281.5826671931409,-2041.587795644815,804.4540721101683,0,0,0,766.4204578068593,0,0,0,6.301419755461211]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2047.953125000004,-6144.059375000462,2047.953125000004,1]},{"refine":"REPLACE","geometricError":128.00019531249998,"boundingVolume":{"box":[2047.953125000004,-2048.0531250004615,2047.953125000004,2048.0031249999997,0,0,0,2048.003125,0,0,0,2048.0031249999997]},"content":{"uri":"12-469.glb","boundingVolume":{"box":[2437.3338215371828,-2048.0531250004615,25.419462185895455,974.7149083235417,0,0,0,2048.003125,0,0,0,25.46946218589109]}},"children":[{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[0.0,0.0,0.0,1024.0015624999999,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-470.glb","boundingVolume":{"box":[731.3344566058662,-642.9606770413595,-1017.0648011506391,292.66710589413367,0,0,0,381.04088545864056,0,0,0,6.613503342028707]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,1023.9515625000042,-3072.0546875004616,1023.9515625000042,1]},{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,1024.0015624999999,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-488.glb","boundingVolume":{"box":[-350.7744931083919,91.80219306985146,-998.5314596863047,673.2270693916082,0,0,0,932.1993694301486,0,0,0,25.46882155808703]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,3071.954687500004,-3072.0546875004616,1023.9515625000042,1]},{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[3071.954687500004,-1024.0515625004614,1023.9515625000042,1024.0015625,0,0,0,1024.0015625,0,0,0,1024.0015624999999]},"content":{"uri":"11-489.glb","boundingVolume":{"box":[2896.360889190465,-1024.0515625004614,17.420914113106022,515.6878406702599,0,0,0,1024.0015625,0,0,0,17.470914113101657]}},"children":[{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,512.00078125,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-490.glb","boundingVolume":{"box":[469.7621690427684,0.0,-493.5064971514339,42.23861220723143,0,0,0,512.00078125,0,0,0,16.468532158204482]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2559.9539062500044,-1536.0523437504614,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,512.00078125,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-491.glb","boundingVolume":{"box":[166.35996176040248,0.0,-503.391268683068,345.64081948959733,0,0,0,512.00078125,0,0,0,8.609512566931926]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2559.9539062500044,-512.0507812504613,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.00004882812499,"boundingVolume":{"box":[0.0,0.0,0.0,512.0007812499998,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-492.glb","boundingVolume":{"box":[-342.33462392617866,0.0,-498.3719476873084,169.66615732382115,0,0,0,512.00078125,0,0,0,13.628833562691511]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,3583.955468750004,-1536.0523437504614,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.00004882812499,"boundingVolume":{"box":[0.0,0.0,0.0,512.0007812499998,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-493.glb","boundingVolume":{"box":[-356.93957963875664,-182.08319038031937,-508.3292834950539,155.06120161124318,0,0,0,329.9175908696807,0,0,0,3.6714977549460173]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,3583.955468750004,-512.0507812504613,511.9507812500043,1]}]}]}]}]}]},{"refine":"REPLACE","geometricError":1024.0015624999999,"boundingVolume":{"box":[16383.975000000002,16383.974999999537,16383.975000000002,16384.024999999998,0,0,0,16384.024999999998,0,0,0,16384.024999999998]},"content":{"uri":"15-520.glb","boundingVolume":{"box":[1989.6597644919384,2683.4561248176915,72.1678924560547,1989.709764491934,0,0,0,2683.506124818153,0,0,0,72.1678924560547]}},"children":[{"refine":"REPLACE","geometricError":512.0007812499999,"boundingVolume":{"box":[8191.962500000003,8191.962499999538,8191.962500000003,8192.012499999999,0,0,0,8192.012499999999,0,0,0,8192.012499999999]},"content":{"uri":"14-521.glb","boundingVolume":{"box":[1989.6597644919384,2683.4561248176915,72.1678924560547,1989.709764491934,0,0,0,2683.506124818153,0,0,0,72.1678924560547]}},"children":[{"refine":"REPLACE","geometricError":256.00039062499997,"boundingVolume":{"box":[4095.956250000004,4095.956249999538,4095.956250000004,4096.0062499999995,0,0,0,4096.0062499999995,0,0,0,4096.0062499999995]},"content":{"uri":"13-522.glb","boundingVolume":{"box":[1989.6597644919384,2683.4561248176915,72.16789245600992,1989.709764491934,0,0,0,2683.506124818153,0,0,0,72.16789245609945]}},"children":[{"refine":"REPLACE","geometricError":128.00019531249998,"boundingVolume":{"box":[2047.953125000004,2047.9531249995384,2047.953125000004,2048.0031249999997,0,0,0,2048.0031249999997,0,0,0,2048.0031249999997]},"content":{"uri":"12-523.glb","boundingVolume":{"box":[1555.72158912729,2047.9531249995384,72.16789245524453,1555.7715891272856,0,0,0,2048.0031249999997,0,0,0,72.16789245686488]}},"children":[{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[1023.9515625000042,1023.9515624995386,1023.9515625000042,1024.0015624999999,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-524.glb","boundingVolume":{"box":[1023.9515625000042,1298.249453314273,72.16789245590732,1024.0015624999999,0,0,0,749.7036716852657,0,0,0,72.16789245620208]}},"children":[{"refine":"REPLACE","geometricError":32.000048828124996,"boundingVolume":{"box":[511.9507812500043,1535.9523437495386,511.9507812500043,512.0007812499999,0,0,0,512.00078125,0,0,0,512.0007812499999]},"content":{"uri":"10-526.glb","boundingVolume":{"box":[511.9507812500043,1542.8442438093875,72.16789245590732,512.0007812499999,0,0,0,505.1088811901511,0,0,0,72.16789245620208]}},"children":[{"refine":"REPLACE","geometricError":16.000024414062498,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,256.00039062499997,0,0,0,256.000390625,0,0,0,256.00039062499997]},"content":{"uri":"9-527.glb","boundingVolume":{"box":[0.0,142.761211841183,-227.18291196062836,256.00039062499997,0,0,0,113.2391787838169,0,0,0,28.76747866454147]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,255.95039062500433,1279.9519531245387,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.000024414062498,"boundingVolume":{"box":[0.0,0.0,0.0,256.00039062499997,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-528.glb","boundingVolume":{"box":[0.0,0.0,-215.2667471839214,256.00039062499997,0,0,0,256.0003906249999,0,0,0,40.68364344197815]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,255.95039062500433,1791.9527343745385,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.000024414062498,"boundingVolume":{"box":[-5.684341886080802e-14,-1.1368683772161603e-13,0.0,256.00039062499997,0,0,0,256.000390625,0,0,0,256.00039062499997]},"content":{"uri":"9-529.glb","boundingVolume":{"box":[-5.684341886080802e-14,6.891900060947933,-203.60436762016852,256.00039062499997,0,0,0,249.10849056405198,0,0,0,52.3460230050305]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,767.9511718750043,1279.9519531245387,255.95039062500433,1]},{"refine":"REPLACE","geometricError":16.000024414062498,"boundingVolume":{"box":[-5.684341886080802e-14,0.0,0.0,256.00039062499997,0,0,0,256.0003906249999,0,0,0,256.00039062499997]},"content":{"uri":"9-530.glb","boundingVolume":{"box":[-5.684341886080802e-14,0.0,-183.78249816902667,256.00039062499997,0,0,0,256.0003906249999,0,0,0,72.16789245613174]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,767.9511718750043,1791.9527343745385,255.95039062500433,1]}]},{"refine":"REPLACE","geometricError":32.000048828124996,"boundingVolume":{"box":[-1.1368683772161603e-13,0.0,0.0,512.0007812499999,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-535.glb","boundingVolume":{"box":[12.985486455370506,274.2978908162616,-500.14584557714034,499.0152947946293,0,0,0,237.70289043373833,0,0,0,11.804935672863962]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,1535.9523437500043,511.95078124953864,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.000048828124996,"boundingVolume":{"box":[-1.1368683772161603e-13,-1.1368683772161603e-13,0.0,512.0007812499999,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-536.glb","boundingVolume":{"box":[-1.1368683772161603e-13,-1.1368683772161603e-13,-440.1165685794508,512.0007812499999,0,0,0,512.0007812499999,0,0,0,71.83421267073527]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,1535.9523437500043,1535.9523437495386,511.9507812500043,1]}]},{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[0.0,-2.2737367544323206e-13,0.0,1024.0015624999999,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-549.glb","boundingVolume":{"box":[0.0,-657.1253461717329,-974.7433156927509,1024.0015624999999,0,0,0,366.8762163282672,0,0,0,49.208246808873696]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,1023.9515625000042,3071.9546874995385,1023.9515625000042,1]},{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[3071.954687500004,1023.9515624995386,1023.9515625000042,1024.0015625,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-558.glb","boundingVolume":{"box":[2579.7231516272896,1023.9515624995386,65.78550144424871,531.7700266272855,0,0,0,1024.0015624999999,0,0,0,65.78550144444942]}},"children":[{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2.2737367544323206e-13,0.0,0.0,512.00078125,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-559.glb","boundingVolume":{"box":[-107.1485722277755,0.0,-502.24889474642043,404.85220902222477,0,0,0,512.0007812499999,0,0,0,9.701886503765422]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2559.9539062500044,511.95078124953864,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.000048828125,"boundingVolume":{"box":[-2.2737367544323206e-13,-1.1368683772161603e-13,0.0,512.00078125,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-560.glb","boundingVolume":{"box":[-2.2737367544323206e-13,-1.1368683772161603e-13,-446.1652798058621,512.00078125,0,0,0,512.0007812499999,0,0,0,65.7855014445559]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2559.9539062500044,1535.9523437495386,511.9507812500043,1]},{"refine":"REPLACE","geometricError":32.00004882812499,"boundingVolume":{"box":[0.0,-1.1368683772161603e-13,0.0,512.0007812499998,0,0,0,512.0007812499999,0,0,0,512.0007812499999]},"content":{"uri":"10-562.glb","boundingVolume":{"box":[-492.2315358727142,-113.52974977763472,-471.12327963125625,19.769245377285642,0,0,0,86.31444153398354,0,0,0,8.038999454809868]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,3583.955468750004,1535.9523437495386,511.9507812500043,1]}]},{"refine":"REPLACE","geometricError":64.00009765624999,"boundingVolume":{"box":[-2.2737367544323206e-13,-2.2737367544323206e-13,0.0,1024.0015624999999,0,0,0,1024.0015624999999,0,0,0,1024.0015624999999]},"content":{"uri":"11-567.glb","boundingVolume":{"box":[-703.647231136772,-2.2737367544323206e-13,-992.007391127062,320.3543313632281,0,0,0,1024.0015624999999,0,0,0,31.944171374250118]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,3071.954687500004,3071.9546874995385,1023.9515625000042,1]}]},{"refine":"REPLACE","geometricError":128.00019531249998,"boundingVolume":{"box":[0.0,-4.547473508864641e-13,0.0,2048.0031249999997,0,0,0,2048.0031249999997,0,0,0,2048.0031249999997]},"content":{"uri":"12-572.glb","boundingVolume":{"box":[1163.8940173111787,-1404.3207450355553,-2025.200926205265,767.5223866726897,0,0,0,643.6823799644449,0,0,0,22.752198796106086]}},"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,2047.953125000004,6143.959374999538,2047.953125000004,1]}]}]}]}],"transform":[1.0,0.0,0.0,0,0.0,1.0,0.0,0,0.0,0.0,1.0,0,510091.55765458336,6649129.973051462,0.0,1]},"asset":{"version":"1.0","tilesetVersion":"TilesetPublisher.0.2.0"},"extensions":{"BENTLEY_BatchedTileSet":{"includedModels":["0x20000000029","0x20000000236","0x20000000238","0x2000000023a","0x2000000023c","0x2000000023e","0x20000000240","0x20000000242","0x20000000244","0x20000000246","0x20000000248","0x2000000024a","0x2000000024c","0x2000000024e","0x20000000250","0x20000000252","0x20000000254","0x20000000256","0x20000000258","0x2000000025a","0x2000000025c","0x2000000025e","0x20000000260","0x20000000262","0x40000000015","0x4000000090c","0x4000000090e","0x40000000910","0x40000000912","0x40000000914","0x40000000916","0x40000000918","0x4000000091a","0x4000000091c","0x4000000091e","0x40000000921","0x40000000923","0x40000000925","0x40000000928","0x4000000092a","0x5000000001b","0x50000000a5f","0x50000000a61","0x50000000a63","0x50000000a65","0x50000001a91","0x500000035dc","0x500000035de","0x500000035e0","0x500000035e2","0x5000000466b","0x5000000557c","0x60000000004","0x400000028ea"],"models":{"0x20000000029":{"extents":{"low":[1.7976931348623157e308,1.7976931348623157e308,1.7976931348623157e308],"high":[-1.7976931348623157e308,-1.7976931348623157e308,-1.7976931348623157e308]}},"0x20000000236":{"extents":{"low":[508040.1875,6645551.5,12.512396812438965],"high":[508050.5625,6645569.0,13.208282470703125]}},"0x20000000238":{"extents":{"low":[507698.09375,6644765.0,-27.564306259155273],"high":[508234.1875,6648032.5,55.002532958984375]}},"0x2000000023a":{"extents":{"low":[507858.59375,6645693.5,-12.885819435119629],"high":[508197.875,6645914.5,35.72515869140625]}},"0x2000000023c":{"extents":{"low":[507098.09375,6644740.5,-303.0582275390625],"high":[508670.625,6647228.5,332.6866760253906]}},"0x2000000023e":{"extents":{"low":[506679.0625,6647195.5,-499.68548583984375],"high":[508825.5,6650061.0,528.7640991210938]}},"0x20000000240":{"extents":{"low":[507350.90625,6649220.0,-1286.08984375],"high":[511577.0625,6652128.0,1468.7333984375]}},"0x20000000242":{"extents":{"low":[510719.84375,6651047.0,-892.9225463867188],"high":[514701.34375,6654666.5,1009.933837890625]}},"0x20000000244":{"extents":{"low":[507738.53125,6645128.5,-102.87380981445313],"high":[508412.40625,6646206.0,135.51992797851563]}},"0x20000000246":{"extents":{"low":[507539.875,6644767.5,-44.363948822021484],"high":[508206.5,6646960.5,71.68887329101563]}},"0x20000000248":{"extents":{"low":[508054.96875,6645566.0,4.770742416381836],"high":[508153.875,6645651.5,12.536395072937012]}},"0x2000000024a":{"extents":{"low":[507999.5625,6645192.0,-13.413139343261719],"high":[508090.6875,6645443.5,40.69302749633789]}},"0x2000000024c":{"extents":{"low":[507968.6875,6645453.0,-0.7695589661598206],"high":[508176.96875,6645671.5,22.176467895507813]}},"0x2000000024e":{"extents":{"low":[507898.90625,6645561.0,-0.0005000000237487257],"high":[508145.875,6645789.0,20.740001678466797]}},"0x20000000250":{"extents":{"low":[507030.75,6645561.0,-5.63785457611084],"high":[508145.875,6647434.0,322.467529296875]}},"0x20000000252":{"extents":{"low":[507698.8125,6644766.0,-2.4000000953674316],"high":[508284.375,6648430.5,2.4000000953674316]}},"0x20000000254":{"extents":{"low":[482574.5,6620365.0,-18639.3828125],"high":[533545.25,6671337.5,18639.3828125]}},"0x20000000256":{"extents":{"low":[483162.5625,6620475.5,-18639.3828125],"high":[536928.5,6678753.0,18639.3828125]}},"0x20000000258":{"extents":{"low":[482669.90625,6622059.0,-18639.3828125],"high":[532889.0,6674066.5,18639.3828125]}},"0x2000000025a":{"extents":{"low":[483681.25,6621208.0,-18639.3828125],"high":[536634.875,6678387.0,18639.3828125]}},"0x2000000025c":{"extents":{"low":[483678.0,6621205.5,-18639.3828125],"high":[538496.5,6678389.0,18639.3828125]}},"0x2000000025e":{"extents":{"low":[481686.625,6619507.0,-18639.3828125],"high":[534401.875,6672222.0,18639.3828125]}},"0x20000000260":{"extents":{"low":[484179.03125,6621084.5,-18639.3828125],"high":[531783.625,6670069.5,18639.3828125]}},"0x20000000262":{"extents":{"low":[508056.40625,6645567.0,-0.0005000000237487257],"high":[508150.9375,6645651.5,0.0005000000237487257]}},"0x40000000015":{"extents":{"low":[1.7976931348623157e308,1.7976931348623157e308,1.7976931348623157e308],"high":[-1.7976931348623157e308,-1.7976931348623157e308,-1.7976931348623157e308]}},"0x4000000090c":{"extents":{"low":[509812.75,6649784.5,-198.1175537109375],"high":[512384.78125,6651285.5,211.41357421875]}},"0x4000000090e":{"extents":{"low":[507453.9375,6645750.0,-318.4130859375],"high":[513618.1875,6652073.5,324.6803894042969]}},"0x40000000910":{"extents":{"low":[509832.9375,6650711.0,-41.524742126464844],"high":[510091.0,6650989.5,88.73370361328125]}},"0x40000000912":{"extents":{"low":[509902.875,6650757.5,-25.21864891052246],"high":[510171.09375,6651010.0,75.07677459716797]}},"0x40000000914":{"extents":{"low":[504422.96875,6643501.0,-0.41247692704200745],"high":[513504.65625,6651284.5,215.4000244140625]}},"0x40000000916":{"extents":{"low":[1.7976931348623157e308,1.7976931348623157e308,1.7976931348623157e308],"high":[-1.7976931348623157e308,-1.7976931348623157e308,-1.7976931348623157e308]}},"0x40000000918":{"extents":{"low":[510059.03125,6649494.0,-546.3870239257813],"high":[512462.34375,6651572.0,603.3358154296875]}},"0x4000000091a":{"extents":{"low":[507326.0,6645756.5,-872.1378173828125],"high":[514400.71875,6652388.5,926.3453369140625]}},"0x4000000091c":{"extents":{"low":[509830.15625,6650701.5,-2.6563804149627686],"high":[510085.75,6650989.5,98.78193664550781]}},"0x4000000091e":{"extents":{"low":[509902.875,6650751.5,29.192028045654297],"high":[510148.8125,6650983.5,83.53850555419922]}},"0x40000000921":{"extents":{"low":[509951.0,6650759.0,39.57004928588867],"high":[510055.125,6650795.0,49.58001708984375]}},"0x40000000923":{"extents":{"low":[509904.46875,6650794.0,34.700504302978516],"high":[510059.25,6650930.0,59.572357177734375]}},"0x40000000925":{"extents":{"low":[509900.0625,6650790.0,-12.578152656555176],"high":[510062.8125,6650931.5,59.41996383666992]}},"0x40000000928":{"extents":{"low":[509973.0,6650766.5,44.812156677246094],"high":[509993.625,6650777.5,51.28909683227539]}},"0x4000000092a":{"extents":{"low":[510012.6875,6650777.0,44.296470642089844],"high":[510033.3125,6650788.0,50.77341842651367]}},"0x5000000001b":{"extents":{"low":[508169.8125,6645982.0,0.0],"high":[508191.09375,6646004.5,7.43072308842207e-18]}},"0x50000000a5f":{"extents":{"low":[508171.90625,6645951.5,-0.0005000000237487257],"high":[508223.375,6646003.5,17.034908294677734]}},"0x50000000a61":{"extents":{"low":[508137.71875,6645936.5,-0.0005000000237487257],"high":[508257.78125,6646017.5,15.50050163269043]}},"0x50000000a63":{"extents":{"low":[508170.0625,6645949.5,6.136033058166504],"high":[508225.1875,6646004.5,6.655616760253906]}},"0x50000000a65":{"extents":{"low":[508171.875,6645950.5,6.185516357421875],"high":[508223.46875,6646003.5,16.078195571899414]}},"0x50000001a91":{"extents":{"low":[508158.3125,6645937.0,6.432437896728516],"high":[508231.9375,6646012.0,16.691150665283203]}},"0x500000035dc":{"extents":{"low":[508171.3125,6645950.5,15.838943481445313],"high":[508224.0625,6645993.5,16.601045608520508]}},"0x500000035de":{"extents":{"low":[508150.65625,6645961.5,6.432437896728516],"high":[508191.0,6646003.5,6.433438777923584]}},"0x500000035e0":{"extents":{"low":[507773.8125,6645654.0,-0.000989682856015861],"high":[508402.84375,6646131.0,19.324052810668945]}},"0x500000035e2":{"extents":{"low":[508174.40625,6645955.0,6.284473896026611],"high":[508223.90625,6645991.0,15.805824279785156]}},"0x5000000466b":{"extents":{"low":[508181.71875,6645981.5,5.750430583953857],"high":[508201.3125,6645998.0,15.389567375183105]}},"0x5000000557c":{"extents":{"low":[508150.65625,6645940.0,5.9664764404296875],"high":[508230.84375,6646009.0,13.592672348022461]}},"0x60000000004":{"extents":{"low":[508119.5625,6645927.0,6.139799118041992],"high":[508173.71875,6645978.0,18.939800262451172]}},"0x400000028ea":{"extents":{"low":[1.7976931348623157e308,1.7976931348623157e308,1.7976931348623157e308],"high":[-1.7976931348623157e308,-1.7976931348623157e308,-1.7976931348623157e308]}}}}}}`;
    console.log(urlstr);
    const blob = new Blob([urlstr]);
    const url = URL.createObjectURL(blob);
    console.log(url);
    console.log("Graphic Representation URL: ", urlstr);
    if (undefined !== vp){
      vp.displayStyle.attachRealityModel({ tilesetUrl: url });
    }

    return true;
  }

  /** Executes this tool's run method with args[0] containing the `url` argument.
   * @see [[run]]
   */
  public override async parseAndRun(): Promise<boolean> {
    return this.run();
  }
}

/** Changes the `allow3dManipulations` flag for the selected viewport if the viewport is displaying a `ViewState3d`.
 * @beta
 */
export class Toggle3dManipulationsTool extends ViewportToggleTool {
  public static override toolId = "Toggle3dManipulations";

  protected override async toggle(vp: Viewport, allow?: boolean): Promise<void> {
    if (!vp.view.is3d())
      return Promise.resolve();

    if (undefined === allow)
      allow = !vp.view.allow3dManipulations();

    if (allow !== vp.view.allow3dManipulations()) {
      vp.view.setAllow3dManipulations(allow);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IModelApp.toolAdmin.startDefaultTool();
    }

    return Promise.resolve();
  }
}

/** Toggles display of view attachments in sheet views.
 * @beta
 */
export class ToggleViewAttachmentsTool extends ViewportToggleTool {
  public static override toolId = "ToggleViewAttachments";

  protected override async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== vp.wantViewAttachments)
      vp.wantViewAttachments = !vp.wantViewAttachments;

    return Promise.resolve();
  }
}

/** Toggle display of view attachment boundaries in sheet views.
 * @beta
 */
export class ToggleViewAttachmentBoundariesTool extends ViewportToggleTool {
  public static override toolId = "ToggleViewAttachmentBoundaries";

  protected override async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== vp.wantViewAttachmentBoundaries)
      vp.wantViewAttachmentBoundaries = !vp.wantViewAttachmentBoundaries;

    return Promise.resolve();
  }
}

/** Toggle display of view attachment clip shapes in sheet views.
 * @beta
 */
export class ToggleViewAttachmentClipShapesTool extends ViewportToggleTool {
  public static override toolId = "ToggleViewAttachmentClipShapes";

  protected override async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== vp.wantViewAttachmentClipShapes)
      vp.wantViewAttachmentClipShapes = !vp.wantViewAttachmentClipShapes;

    return Promise.resolve();
  }
}

/** Toggles display of 2d graphics in a [DrawingViewState]($frontend). This setting affects all drawing views until it is reset.
 * @beta
 */
export class ToggleDrawingGraphicsTool extends ViewportToggleTool {
  public static override toolId = "ToggleDrawingGraphics";

  protected override async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== DrawingViewState.hideDrawingGraphics) {
      DrawingViewState.hideDrawingGraphics = !DrawingViewState.hideDrawingGraphics;
      vp.invalidateScene();
    }

    return Promise.resolve();
  }
}

/** Toggles whether a [SectionDrawing]($backend)'s spatial view is always displayed along with the 2d graphics by a [DrawingViewState]($frontend), even
 * if it otherwise would not be. This setting affects all section drawing views until it is reset.
 * @beta
 */
export class ToggleSectionDrawingSpatialViewTool extends ViewportToggleTool {
  public static override toolId = "ToggleSectionDrawingSpatialView";

  protected async toggle(vp: Viewport, enable?: boolean): Promise<void> {
    if (undefined === enable || enable !== DrawingViewState.alwaysDisplaySpatialView) {
      DrawingViewState.alwaysDisplaySpatialView = !DrawingViewState.alwaysDisplaySpatialView;
      if (vp.view instanceof DrawingViewState) {
        // Force the view to update its section drawing attachment.
        const view = vp.view.clone();
        await view.changeViewedModel(view.baseModelId);
        await view.load();
        vp.changeView(view);
      }
    }
  }
}

/** Change the camera settings of the selected viewport.
 * @beta
 */
export class ChangeCameraTool extends Tool {
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }
  public static override toolId = "ChangeCamera";

  public override async run(camera?: Camera): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (camera && vp && vp.view.is3d()) {
      const view = vp.view.clone();
      view.camera.setFrom(camera);
      vp.changeView(view);
    }

    return true;
  }

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.is3d())
      return false;

    const camera = vp.view.camera.clone();
    const args = parseArgs(inArgs);
    const lens = args.getFloat("l");
    if (undefined !== lens)
      camera.lens.setDegrees(lens);

    const focusDist = args.getFloat("d");
    if (undefined !== focusDist)
      camera.focusDist = focusDist;

    return this.run(camera);
  }
}
