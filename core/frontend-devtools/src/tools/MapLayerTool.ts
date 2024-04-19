/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64String } from "@itwin/core-bentley";
import { BaseMapLayerSettings, ColorDef, ModelMapLayerSettings } from "@itwin/core-common";
import { IModelApp, MapLayerSource, MapLayerSources, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, Tool, WmsUtilities } from "@itwin/core-frontend";
import { parseBoolean } from "./parseBoolean";
import { parseToggle } from "./parseToggle";

/** Base class for attaching map layer tool. */
class AttachMapLayerBaseTool extends Tool {
  constructor(protected _isBackground = true, protected _isBase = false) {
    super();
  }

  protected doAttach(source?: MapLayerSource) {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined || source === undefined)
      return;

    source.validateSource().then((validation) => {
      if (validation.status === MapLayerSourceStatus.Valid || validation.status === MapLayerSourceStatus.RequireAuth) {
        if (this._isBase) {
          vp.displayStyle.backgroundMapBase = BaseMapLayerSettings.fromJSON({ ...source, subLayers: validation.subLayers });
          vp.invalidateRenderPlan();
        } else {
          const settings = source.toLayerSettings(validation.subLayers);
          if (settings) {
            // Need to specify index in mapLayerIndex, so just use -1 to attach layer at the bottom
            // Previously, this was done within attachMapLayer if index was undefined.
            vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: !this._isBackground, index: -1 } });
          }
        }

        if (validation.status === MapLayerSourceStatus.Valid) {
          vp.invalidateRenderPlan();
          const msg = IModelApp.localization.getLocalizedString("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttached", { sourceName: source.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
        } else if (validation.status === MapLayerSourceStatus.RequireAuth) {
          const msg = IModelApp.localization.getLocalizedString("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttachedRequiresAuth", { sourceName: source.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }

      } else if (validation.status === MapLayerSourceStatus.IncompatibleFormat) {
        const msg = IModelApp.localization.getLocalizedString("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayersIncompatibleFormat", { sourceName: source.name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      } else {
        const msg = IModelApp.localization.getLocalizedString("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerValidationFailed", { sourceName: source.name });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      }
    }).catch((error) => {
      const msg = IModelApp.localization.getLocalizedString("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttachError", { error, sourceName: source.name });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
    });
  }
}

/** Attach a map layer from URL base class. A layer is attached for each unique model in the selection
 * @beta
 */
export class AttachModelMapLayerTool extends Tool {
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }
  public static override toolId = "AttachModelMapLayerTool";
  constructor(protected _formatId: string) { super(); }

  public override async run(nameIn?: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const iModel = vp.iModel;
    const elements = await iModel.elements.getProps(iModel.selectionSet.elements);
    const modelIds = new Set<Id64String>();

    for (const element of elements)
      modelIds.add(element.model);

    for (const modelId of modelIds) {
      const modelProps = await iModel.models.getProps(modelId);
      const modelName = modelProps[0].name ? modelProps[0].name : modelId;
      const name = nameIn ? (modelIds.size > 1 ? `${nameIn}: ${modelName}` : nameIn) : modelName;
      const settings = ModelMapLayerSettings.fromJSON({ name, modelId });
      vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: false, index: -1 } });
    }
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
  public async onRestartTool() {
  }
}
/** Attach a map layer from URL base class. */
class AttachMapLayerByURLBaseTool extends AttachMapLayerBaseTool {
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 4; }
  constructor(protected _formatId: string) { super(); }

  public override async run(url: string, name?: string, userName?: string, password?: string): Promise<boolean> {
    const source = MapLayerSource.fromJSON({ url, name: (name ? name : url), formatId: this._formatId });
    if (source) {
      source.userName = userName;
      source.password = password;
    }

    this.doAttach(source);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0], args[1], args[2], args[3]);
  }
}

/** This tool attaches a WMS map layer from a given URL.
 * @beta
 */
export class AttachWmsMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachWmsMapLayerTool";
  constructor() { super("WMS"); }
  /** This method runs the tool, attaching a WMS map layer from a given URL.
   * @param args contains url, name, userName, password in array order
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(WmsUtilities.getBaseUrl(args[0]), args[1], args[2], args[3]);
  }
}

/** This tool attaches a WMTS map layer from a given URL.
 * @beta
 */
export class AttachWmtsMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachWmtsMapLayerTool";
  constructor() { super("WMTS"); }
  /** This method runs the tool, attaching a WMTS map layer from a given URL.
   * @param args contains url, name, userName, password in array order
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(WmsUtilities.getBaseUrl(args[0]), args[1], args[2], args[3]);
  }
}

/** This tool attaches an ArcGIS map layer from a given URL.
 * @beta
 */
export class AttachArcGISMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachArcGISMapLayerTool";
  constructor() { super("ArcGIS"); }
}

/** This tool attaches an ArcGIS map layer from a given URL.
 * @beta
 */
export class AttachArcGISFeatureMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachArcGISFeatureMapLayerTool";
  constructor() { super("ArcGISFeature"); }
}

/** This tool attaches an ArcGIS map layer from a given URL.
 * @beta
 */
export class AttachOgcApiFeaturesMapLayerTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachOgcApiFeaturesMapLayerTool";
  constructor() { super("OgcApiFeatures"); }
}

/** This tool attaches a map layer from a given tile URL.
 * @beta
 */
export class AttachTileURLMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static override toolId = "AttachTileURLMapLayerTool";
  constructor() { super("TileURL"); }
}

/** This tool add a Map Layer from a specified name (look up in MapLayerSources.json).
 * @beta
 */
export class AttachMapLayerTool extends AttachMapLayerBaseTool {
  public static override toolId = "AttachMapLayerTool";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, adding a map layer from a specified name in MayLayerSources.json.
   * @param name the name of the map layer to add
   */
  public override async run(name: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    MapLayerSources.create().then((sources) => {
      if (sources !== undefined) {
        const source = sources.findByName(name, this._isBase);
        if (source !== undefined)
          this.doAttach(source);
      }
    }).catch((_err) => { });

    return true;
  }

  /** Executes this tool's run method with args[0] containing `name`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}
/** This tool attaches a Overlay map layer.
 * @beta
 */
export class AttachMapOverlayTool extends AttachMapLayerTool {
  public static override toolId = "AttachMapOverlayTool";
  constructor() {
    super();
    this._isBackground = false;
  }
}

/** Sets map layer base tool.
 * @beta
 */
export class SetMapBaseTool extends AttachMapLayerTool {
  public static override toolId = "SetMapBaseTool";
  constructor() {
    super();
    this._isBase = true;
  }
}

/** Detach Map Layers Tool.
 * @beta
 */
export class DetachMapLayersTool extends Tool {
  public static override toolId = "DetachMapLayersTool";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public override async parseAndRun(..._args: string[]): Promise<boolean> {
    return this.run();
  }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    vp.displayStyle.detachMapLayerByIndex({ index: -1, isOverlay: true });
    vp.displayStyle.detachMapLayerByIndex({ index: -1, isOverlay: false });
    vp.invalidateRenderPlan();
    return true;
  }
}

function parseLayerIndex(args: string[]) {
  const layerIndex = args.length > 1 ? parseInt(args[1], 10) : 0;
  return isNaN(layerIndex) ? 0 : layerIndex;
}

/** This tool sets the visibility of the map layer.
 * @beta
 */
export class MapLayerVisibilityTool extends Tool {
  public static override toolId = "SetMapLayerVisibility";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  /** This method runs the tool, setting the visibility of a map layer.
   * @param layerIndex the index of the layer to change
   * @param visible a boolean that should be true if the layer should be visible
   */
  public override async run(layerIndex: number, enable?: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const mapLayer = vp.displayStyle.mapLayerAtIndex({ index: layerIndex, isOverlay: false });
    if (undefined === mapLayer)
      return false;

    const visible = (enable === undefined) ? !mapLayer.visible : enable;

    vp.displayStyle.changeMapLayerProps({ visible }, { index: layerIndex, isOverlay: false });
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing `enable` and args[1] containing `layerIndex`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    const layerIndex = parseLayerIndex(args);
    if (typeof enable !== "string")
      await this.run(layerIndex, enable);

    return true;
  }
}
/** This tool reorders map layers.
 * @beta
 */
export class ReorderMapLayers extends Tool {
  public static override toolId = "ReorderMapLayers";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 2; }
  /** This method runs the tool, reordering the map layers.
   * @param from a numeric value specifying the layer index that is being moved
   * @param from a numeric value specifying the layer index to move that layer to
   */
  public override async run(from: number, to: number): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.moveMapLayerToIndex(isNaN(from) ? 0 : from, isNaN(to) ? vp.displayStyle.settings.mapImagery.backgroundLayers.length : to, false);
    vp.invalidateRenderPlan();
    return true;
  }
  /** Executes this tool's run method with args[0] containing `from` and args[1] containing `to`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const from = parseInt(args[0], 10);
    const to = parseInt(args[1], 10);
    await this.run(from, to);
    return true;
  }

}

/** This tool sets the transparency of a map layer.
 * @beta
 */
export class MapLayerTransparencyTool extends Tool {
  public static override toolId = "SetMapLayerTransparency";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }
  /** This method runs the tool, setting the transparency of a map layer.
   * @param layerIndex the index of the layer to change
   * @param transparency a numeric value in the range 0.0 (fully opaque) to 1.0 (fully transparent)
   */
  public override async run(layerIndex: number, transparency: number): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeMapLayerProps({ transparency }, { index: layerIndex, isOverlay: false });
    vp.invalidateRenderPlan();

    return true;
  }
  /** Executes this tool's run method with args[0] containing `transparency` and args[1] containing `layerIndex`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const transparency = parseFloat(args[0]);
    const layerIndex = parseLayerIndex(args);
    if (transparency >= 0 && transparency <= 1)
      await this.run(layerIndex, transparency);

    return true;
  }
}
/** This tool sets the visibility of the map sublayer.
 * @beta
 */
export class MapLayerSubLayerVisibilityTool extends Tool {
  public static override toolId = "SetMapSubLayerVisibility";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 2; }

  /** This method runs the tool, setting the visibility of a map sublayer.
   * @param layerIndex the index of the layer to change
   * @param visible a boolean that should be true if the sublayer should be visible
   */
  public override async run(layerIndex: number, visible: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeMapSubLayerProps({ visible }, -1, { index: layerIndex, isOverlay: false });
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing `transparency` and args[1] containing `layerIndex`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const on = args[0] !== "off";
    const layerIndex = parseLayerIndex(args);
    await this.run(layerIndex, on);

    return true;
  }
}

/** This tool changes the viewport so it is zoomed to the range of a map layer.
 * @beta
 */
export class MapLayerZoomTool extends Tool {
  public static override toolId = "MapLayerZoom";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, changing the viewport so it is zoomed to the range of a map layer.
   * @param layerIndex the index of the layer whose range to zoom to
   */
  public override async run(layerIndex: number): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.viewMapLayerRange({ index: layerIndex, isOverlay: false }, vp).then(() => { }).catch(() => { });

    return true;
  }

  /** Executes this tool's run method with args[0] containing `layerIndex`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const layerIndex = parseLayerIndex(args);
    await this.run(layerIndex);

    return true;
  }
}

/** This tool toggles whether to apply terrain heights to the map.
 * @beta
 */
export class ToggleTerrainTool extends Tool {
  public static override toolId = "ToggleTerrain";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, changing whether to apply terrain heights to the map.
   * @param enable whether or not to enable terrain heights on the map
   */
  public override async run(enable?: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const applyTerrain = (enable === undefined) ? !vp.displayStyle.backgroundMapSettings.applyTerrain : enable;
    vp.displayStyle.changeBackgroundMapProps({ applyTerrain });
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing `enable`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      await this.run(enable);

    return true;
  }
}

/** This tool changes the color of the base map.
 * @beta
 */
export class MapBaseColorTool extends Tool {
  public static override toolId = "SetMapBaseColorTool";
  public static override get minArgs() { return 3; }
  public static override get maxArgs() { return 3; }

  /** This method runs the tool, changing the color of the base map.
   * @param color the color for the base map
   */
  public override async run(color: ColorDef) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const curTransparency = vp.displayStyle.backgroundMapBase instanceof ColorDef ? vp.displayStyle.backgroundMapBase.getTransparency() : 0;
    vp.displayStyle.backgroundMapBase = color.withTransparency(curTransparency);
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing a 0 to 255 red component, args[1] containing a 0 to 255 green component, and args[2] containing a 0 to 255 blue component.
   * These rgb values will be used to construct the `color` parameter passed to this tool's run method.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const red = parseFloat(args[0]), green = parseFloat(args[1]), blue = parseFloat(args[2]);

    return (isNaN(red) || red < 0 || red > 255 || isNaN(green) || green < 0 || green > 255 || isNaN(blue) || blue < 0 || blue > 255) ? false : this.run(ColorDef.from(red, green, blue));
  }
}
/** This tool changes the transparency of the base map.
 * @beta
 */
export class MapBaseTransparencyTool extends Tool {
  public static override toolId = "SetMapBaseTransparencyTool";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, changing the transparency of the base map.
   * @param transparency a numeric value in range 0.0 to 1.0 whether 0.0 means fully opaque and 1.0 means fully transparent
   */
  public override async run(transparency: number) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeBaseMapTransparency(transparency);
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing `transparency`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const transparency = parseFloat(args[0]);

    return (isNaN(transparency) || transparency < 0 || transparency > 1) ? false : this.run(transparency);
  }
}

/** This tool changes the visibility of the base map.
 * @beta
 */
export class MapBaseVisibilityTool extends Tool {
  public static override toolId = "SetMapBaseVisibilityTool";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  /** This method runs the tool, changing the visibility of the base map.
   * @param visible a boolean which specifies whether or not to make the base map visible
   */
  public override async run(visible: boolean) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView() || vp.displayStyle.backgroundMapBase instanceof ColorDef)
      return false;

    vp.displayStyle.backgroundMapBase = vp.displayStyle.backgroundMapBase.clone({ visible });
    vp.invalidateRenderPlan();

    return true;
  }

  /** Executes this tool's run method with args[0] containing `visible`.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const visible = parseBoolean(args[0]);

    return (visible !== undefined ? this.run(visible) : false);
  }
}
