/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { RealityDataSourceKey } from "@itwin/core-common";
import { IModelApp, RealityDataSource, Tool } from "@itwin/core-frontend";

class CustomRealityDataSource implements RealityDataSource {
  public readonly key: RealityDataSourceKey;
  public readonly usesGeometricError = true;
  private readonly _tilesetUrl: string;
  private readonly _baseUrl: string;
  private readonly _apiKey: string;

  public constructor(sourceKey: RealityDataSourceKey, apiKey: string) {
    assert(sourceKey.provider === "DtaRealityDataProvider");
    this.key = sourceKey;
    this._tilesetUrl = this.key.id;
    this._apiKey = apiKey;

    const url = new URL(this._tilesetUrl);
    this._baseUrl = url.origin;
  }

  public get isContextShare() { return false; }
  public get realityData() { return undefined; }
  public get realityDataId() { return undefined; }
  public get realityDataType() { return "ThreeDTile"; }
  public async getServiceUrl() { return Promise.resolve(this._tilesetUrl); }
  public async getSpatialLocationAndExtents() { return Promise.resolve(undefined); }
  public async getPublisherProductInfo() { return Promise.resolve(undefined); }

  public async getRootDocument(): Promise<any> {
    const response = await fetch(`${this._tilesetUrl}?key=${this._apiKey}`);
    return response.json();
  }

  private async _getTileContent(name: string, responseType: "json" | "arraybuffer"): Promise<any> {
    const response = await fetch(`${this._baseUrl}/${name}?key=${this._apiKey}`);
    return "json" === responseType ? response.json() : response.arrayBuffer();
  }

  public async getTileContent(name: string): Promise<any> {
    return this._getTileContent(name, "arraybuffer");
  }

  public async getTileJson(name: string): Promise<any> {
    return this._getTileContent(name, "json");
  }

  public getTileContentType(url: string): "tile" | "tileset" {
    return url.indexOf("tileset") > 0 ? "tileset" : "tile";
  }
}

export function registerRealityDataSourceProvider(apiKey: string): void {
  IModelApp.realityDataSourceProviders.register("DtaRealityDataProvider", {
    createRealityDataSource: async (key) => new CustomRealityDataSource(key, apiKey),
  });
}

export class AttachCustomRealityDataTool extends Tool {
  public static override toolId = "AttachCustomRealityData";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public override async run(url: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      vp.displayStyle.attachRealityModel({
        tilesetUrl: url,
        rdSourceKey: {
          provider: "DtaRealityDataProvider",
          format: "ThreeDTile",
          id: url,
        },
      });
    }

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }
}
