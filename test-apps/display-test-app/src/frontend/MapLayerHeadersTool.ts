/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, MapLayerSource, MapLayerSourceStatus, NotifyMessageDetails, OutputMessagePriority, Tool } from "@itwin/core-frontend";

/** Attaches an image map layer to the selected viewport with custom HTTP headers so the API-key header
 * authentication path (`ImageMapLayerSettings.unsavedHeaders` / `savedHeaders` / `collectHeaders()`) can be
 * exercised end-to-end. The collected headers are applied to every request the layer makes (capabilities,
 * tiles, tooltips).
 *
 * Executed via the key-in `dta attach map layer headers`. Arguments are `key=value` pairs:
 *  - `url=` (required) the map layer URL.
 *  - `format=` the format id (WMS, WMTS, ArcGIS, ArcGISFeature, OgcApiFeatures, TileURL). Defaults to `WMS`.
 *  - `name=` a friendly name for the layer. Defaults to the URL.
 *  - `header=Name:Value` an *unsaved* header (never persisted) - repeatable. Use this for API keys.
 *  - `saved=Name:Value` a *saved* header (persisted in JSON) - repeatable.
 *
 * Example: `dta attach map layer headers url=https://example.com/wms format=WMS header=X-Api-Key:secret123`
 */
export class AttachMapLayerWithHeadersTool extends Tool {
  public static override toolId = "AttachMapLayerWithHeaders";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  public override async run(
    url?: string,
    formatId?: string,
    name?: string,
    unsavedHeaders?: { [key: string]: string },
    savedHeaders?: { [key: string]: string },
  ): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No viewport is selected."));
      return false;
    }

    if (!url) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "A 'url=' argument is required."));
      return false;
    }

    const source = MapLayerSource.fromJSON({
      url,
      name: name ?? url,
      formatId: formatId ?? "WMS",
      // `headers` are persisted; equivalent to setting `savedHeaders` after construction.
      headers: savedHeaders,
    });
    if (!source) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Failed to create map layer source."));
      return false;
    }

    // Runtime-only headers (such as an API key) that must never be persisted. These are also sent
    // during validateSource() so the GetCapabilities request is authenticated.
    if (unsavedHeaders)
      source.unsavedHeaders = { ...unsavedHeaders };

    // Validate the source to discover its sublayers; without them a WMS layer has no LAYERS to request.
    const validation = await source.validateSource();
    if (validation.status !== MapLayerSourceStatus.Valid && validation.status !== MapLayerSourceStatus.RequireAuth) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `Map layer validation failed (status ${validation.status}).`));
      return false;
    }

    const settings = source.toLayerSettings(validation.subLayers);
    if (!settings) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "Failed to create map layer settings."));
      return false;
    }

    vp.displayStyle.attachMapLayer({ settings, mapLayerIndex: { isOverlay: false, index: -1 } });
    vp.invalidateRenderPlan();

    const collected = settings.collectHeaders();
    const headerNames = Object.keys(collected);
    const summary = headerNames.length > 0 ? headerNames.join(", ") : "(none)";
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `Attached '${settings.name}' (${settings.subLayers.length} sublayer(s)) with headers: ${summary}`,
    ));

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    let url: string | undefined;
    let formatId: string | undefined;
    let name: string | undefined;
    const unsavedHeaders: { [key: string]: string } = {};
    const savedHeaders: { [key: string]: string } = {};

    const parseHeader = (value: string, target: { [key: string]: string }) => {
      const sep = value.indexOf(":");
      if (sep <= 0)
        return;
      const headerName = value.substring(0, sep).trim();
      const headerValue = value.substring(sep + 1).trim();
      if (headerName)
        target[headerName] = headerValue;
    };

    for (const arg of args) {
      const eq = arg.indexOf("=");
      if (eq < 0)
        continue;
      const key = arg.substring(0, eq).toLowerCase();
      const value = arg.substring(eq + 1);
      switch (key) {
        case "url": url = value; break;
        case "format": formatId = value; break;
        case "name": name = value; break;
        case "header": parseHeader(value, unsavedHeaders); break;
        case "saved": parseHeader(value, savedHeaders); break;
      }
    }

    return this.run(
      url,
      formatId,
      name,
      Object.keys(unsavedHeaders).length > 0 ? unsavedHeaders : undefined,
      Object.keys(savedHeaders).length > 0 ? savedHeaders : undefined,
    );
  }
}
