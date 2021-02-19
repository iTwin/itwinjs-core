/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { ColorDef } from "@bentley/imodeljs-common";
import { IModelApp, MapLayerSource, MapLayerSources, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, Tool, WmsUtilities } from "@bentley/imodeljs-frontend";
import { parseBoolean } from "./parseBoolean";
import { parseToggle } from "./parseToggle";

/** Base class for attaching map layer tool.
 * @alpha
 */
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
        source.subLayers = validation.subLayers;

        if (this._isBase) {
          vp.displayStyle.changeBaseMapProps(source);
        } else {
          const layerSettings = source.toLayerSettings();
          if (layerSettings) {
            vp.displayStyle.attachMapLayerSettings(layerSettings, !this._isBackground);
          }
        }

        if (validation.status === MapLayerSourceStatus.Valid) {
          vp.invalidateRenderPlan();
          const msg = IModelApp.i18n.translate("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttached", { sourceName: source.name, sourceUrl: source.url });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
        } else if (validation.status === MapLayerSourceStatus.RequireAuth) {
          const msg = IModelApp.i18n.translate("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttachedRequiresAuth", { sourceName: source.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }

      } else {
        const msg = IModelApp.i18n.translate("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerValidationFailed", { sourceUrl: source.url });
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
      }
    }).catch((error) => {
      const msg = IModelApp.i18n.translate("FrontendDevTools:tools.AttachMapLayerTool.Messages.MapLayerAttachError", { error, sourceUrl: source.url });
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, msg));
    });
  }
}
/** Attach a map layer from URL base class.
 * @alpha
 */
class AttachMapLayerByURLBaseTool extends AttachMapLayerBaseTool {
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 4; }
  constructor(protected _formatId: string) { super(); }

  public run(url: string, name?: string, userName?: string, password?: string): boolean {
    this.doAttach(MapLayerSource.fromJSON({ url, name: (name ? name : url), formatId: this._formatId, userName, password }));
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0], args[1], args[2], args[3]);
  }
}

/** Attach an WMS map layer from URL.
 * @alpha
 */
export class AttachWmsMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static toolId = "AttachWmsMapLayerTool";
  constructor() { super("WMS"); }
  public parseAndRun(...args: string[]): boolean {
    return this.run(WmsUtilities.getBaseUrl(args[0]), args[1], args[2], args[3]);
  }
}

/** Attach a WMTS map layer from URL.
 * @alpha
 */
export class AttachWmtsMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static toolId = "AttachWmtsMapLayerTool";
  constructor() { super("WMTS"); }
  public parseAndRun(...args: string[]): boolean {
    return this.run(WmsUtilities.getBaseUrl(args[0]), args[1], args[2], args[3]);
  }
}

/** Attach an ArcGIS map layer from URL.
 * @alpha
 */
export class AttachArcGISMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static toolId = "AttachArcGISMapLayerTool";
  constructor() { super("ArcGIS"); }
}

/** Attach a map layer from tile URL.
 * @alpha
 */
export class AttachTileURLMapLayerByUrlTool extends AttachMapLayerByURLBaseTool {
  public static toolId = "AttachTileURLMapLayerTool";
  constructor() { super("TileURL"); }
}

/** Add a Map Layer from name (look up in MapLayerSources.json).
 * @alpha
 */
export class AttachMapLayerTool extends AttachMapLayerBaseTool {
  public static toolId = "AttachMapLayerTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(name: string): boolean {
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

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}
/** Attach a Overlay map layer.
 * @alpha
 */
export class AttachMapOverlayTool extends AttachMapLayerTool {
  public static toolId = "AttachMapOverlayTool";
  constructor() {
    super();
    this._isBackground = false;
  }
}

/** Set map layer base tool.
 * @alpha
 */
export class SetMapBaseTool extends AttachMapLayerTool {
  public static toolId = "SetMapBaseTool";
  constructor() {
    super();
    this._isBase = true;
  }
}

/** Detach Map Layers Tool.
 * @alpha
 */
export class DetachMapLayersTool extends Tool {
  public static toolId = "DetachMapLayersTool";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }
  public parseAndRun(..._args: string[]): boolean {
    return this.run();
  }

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    vp.displayStyle.detachMapLayerByIndex(-1, true);
    vp.displayStyle.detachMapLayerByIndex(-1, false);
    vp.invalidateRenderPlan();
    return true;
  }
}

function parseLayerIndex(args: string[]) {
  const layerIndex = args.length > 1 ? parseInt(args[1], 10) : 0;
  return isNaN(layerIndex) ? 0 : layerIndex;
}

/** Set Map Layer visibility tool.
 * @alpha
 */
export class MapLayerVisibilityTool extends Tool {
  public static toolId = "SetMapLayerVisibility";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(layerIndex: number, enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const mapLayer = vp.displayStyle.mapLayerAtIndex(layerIndex, false);
    if (undefined === mapLayer)
      return false;

    const visible = (enable === undefined) ? !mapLayer.visible : enable;

    vp.displayStyle.changeMapLayerProps({ visible }, layerIndex, false);
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    const layerIndex = parseLayerIndex(args);
    if (typeof enable !== "string")
      this.run(layerIndex, enable);

    return true;
  }
}
/** Reorder Map Layers tool.
 * @alpha
 */
export class ReorderMapLayers extends Tool {
  public static toolId = "ReorderMapLayers";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }
  public run(from: number, to: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.moveMapLayerToIndex(isNaN(from) ? 0 : from, isNaN(to) ? vp.displayStyle.backgroundMapLayers.length : to, false);
    vp.invalidateRenderPlan();
    return true;
  }
  public parseAndRun(...args: string[]): boolean {
    const from = parseInt(args[0], 10);
    const to = parseInt(args[1], 10);
    this.run(from, to);
    return true;
  }

}

/** Set Map Layer transparency tool.
 * @alpha
 */
export class MapLayerTransparencyTool extends Tool {
  public static toolId = "SetMapLayerTransparency";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(layerIndex: number, transparency: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeMapLayerProps({ transparency }, layerIndex, false);
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const transparency = parseFloat(args[0]);
    const layerIndex = parseLayerIndex(args);
    if (transparency >= 0 && transparency <= 1)
      this.run(layerIndex, transparency);

    return true;
  }
}
/** Set Map Layer sublayer visibility tool.
 * @alpha
 */
export class MapLayerSubLayerVisiblityTool extends Tool {
  public static toolId = "SetMapSubLayerVisibility";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 2; }

  public run(layerIndex: number, visible: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeMapSubLayerProps({ visible }, -1, layerIndex, false);
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const on = args[0] !== "off";
    const layerIndex = parseLayerIndex(args);
    this.run(layerIndex, on);

    return true;
  }
}

/** Zoom to map layer tool.
 * @alpha
 */
export class MapLayerZoomTool extends Tool {
  public static toolId = "MapLayerZoom";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(layerIndex: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.viewMapLayerRange(layerIndex, false, vp).then(() => { }).catch(() => { });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const layerIndex = parseLayerIndex(args);
    this.run(layerIndex);

    return true;
  }
}

/** Toggle terrain tool.
 * @alpha
 */
export class ToggleTerrainTool extends Tool {
  public static toolId = "ToggleTerrain";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const applyTerrain = (enable === undefined) ? !vp.displayStyle.backgroundMapSettings.applyTerrain : enable;
    vp.displayStyle.changeBackgroundMapProps({ applyTerrain });
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}

/** Set Map Layer transparency tool.
 * @alpha
 */
export class MapBaseColorTool extends Tool {
  public static toolId = "SetMapBaseColorTool";
  public static get minArgs() { return 3; }
  public static get maxArgs() { return 3; }

  public run(color: ColorDef) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeBaseMapProps(color);
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const red = parseFloat(args[0]), green = parseFloat(args[1]), blue = parseFloat(args[2]);

    return (isNaN(red) || red < 0 || red > 255 || isNaN(green) || green < 0 || green > 255 || isNaN(blue) || blue < 0 || blue > 255) ? false : this.run(ColorDef.from(red, green, blue));
  }
}
/** Set Map base transparency tool.
 * @alpha
 */
export class MapBaseTransparencyTool extends Tool {
  public static toolId = "SetMapBaseTransparencyTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(transparency: number) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeBaseMapTransparency(transparency);
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const transparency = parseFloat(args[0]);

    return (isNaN(transparency) || transparency < 0 || transparency > 1) ? false : this.run(transparency);
  }
}

/** Set base map visibility
 * @alpha
 */
export class MapBaseVisibilityTool extends Tool {
  public static toolId = "SetMapBaseVisibilityTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(visible: boolean) {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    vp.displayStyle.changeBaseMapProps({ visible });
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const visible = parseBoolean(args[0]);

    return (visible !== undefined ? this.run(visible) : false);
  }
}
