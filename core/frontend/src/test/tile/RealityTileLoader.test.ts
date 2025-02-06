/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, RealityData, RealityDataProvider, RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { GuidString } from "@itwin/core-bentley";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { createBlankConnection } from "../createBlankConnection";
import { RealityDataSource, RealityModelTileTree, TileTree } from "../../core-frontend";
import { request } from "../../request/Request";

class MockRealityDataSource implements RealityDataSource {
  public readonly key: RealityDataSourceKey;
  /** The URL that supplies the 3d tiles for displaying the reality model. */
  private _tilesetUrl: string | undefined;
  /** For use by all Reality Data. For RD stored on PW Context Share, represents the portion from the root of the Azure Blob Container*/
  private _baseUrl: string = "";
  /** Need to be passed down to child tile requests when requesting from blob storage, e.g. a Cesium export from the Mesh Export Service*/
  private _searchParams: string = "";

  /** Construct a new reality data source.
   * @param props JSON representation of the reality data source
   */
  public constructor(props: RealityDataSourceProps) {
    this.key = props.sourceKey;
    this._tilesetUrl = this.key.id;
  }

  /**
   * Create an instance of this class from a source key and iTwin context/
   */
  public static async createFromKey(sourceKey: RealityDataSourceKey, _iTwinId: GuidString | undefined): Promise<RealityDataSource | undefined> {
    if (sourceKey.provider !== RealityDataProvider.TilesetUrl)
      return undefined;
    const rdSource = new MockRealityDataSource({ sourceKey });
    return rdSource;
  }

  public get isContextShare(): boolean {
    return false;
  }
  /**
   * Returns Reality Data if available
  */
  public get realityData(): RealityData | undefined {
    return undefined;
  }
  public get realityDataId(): string | undefined {
    return undefined;
  }
  /**
   * Returns Reality Data type if available
   */
  public get realityDataType(): string | undefined {
    return undefined;
  }

  // This is to set the root url from the provided root document path.
  // If the root document is stored on PW Context Share then the root document property of the Reality Data is provided,
  // otherwise the full path to root document is given.
  // The base URL contains the base URL from which tile relative path are constructed.
  // The tile's path root will need to be reinserted for child tiles to return a 200
  // If the original url includes search paramaters, they are stored in _searchParams to be reinserted into child tile requests.
  private setBaseUrl(url: string): void {
    const urlParts = url.split("/");
    const newUrl = new URL(url);
    this._searchParams = newUrl.search;
    urlParts.pop();
    if (urlParts.length === 0)
      this._baseUrl = "";
    else
      this._baseUrl = `${urlParts.join("/")}/`;
  }

  /**
   * This method returns the URL to access the actual 3d tiles from the service provider.
   * @returns string containing the URL to reality data.
   */
  public async getServiceUrl(_iTwinId: GuidString | undefined): Promise<string | undefined> {
    return this._tilesetUrl;
  }

  // @ts-expect-error asdf
  // @eslint-disable-next-line
  public async getRootDocument(iTwinId: GuidString | undefined): Promise<any> {
    const json =
`{
  "asset": {
    "version": "1.1",
    "tilesetVersion": "triangle-mesh.0.1.0"
  },
  "geometricError": 1024.0,
  "root": {
    "boundingVolume": {
      "box": [
        -1638597.0860943792,
        -3669234.9374902933,
        4937950.053559612,
        82.73920249938965,
        0.0,
        0.0,
        0.0,
        57.6266975402832,
        0.0,
        0.0,
        0.0,
        77.02031707763672
      ]
    },
    "geometricError": 512.0,
    "children": [
      {
        "boundingVolume": {
          "box": [
            -1638597.0860943792,
            -3669234.9374902933,
            4937950.053559612,
            82.73920249938965,
            0.0,
            0.0,
            0.0,
            57.6266975402832,
            0.0,
            0.0,
            0.0,
            77.02031707763672
          ]
        },
        "geometricError": 0.0,
        "content": {
          "uri": "tile_0.gltf"
        }
      }
    ]
  }
}`;
    return JSON.parse(json);
  }

  private isValidURL(url: string){
    try {
      new URL(url);
    } catch {
      return false;
    }
    return true;
  }

  /** Returns the tile URL.
   * If the tile path is a relative URL, the base URL is prepended to it.
   * For both absolute and relative tile path URLs, the search parameters are checked. If the search params are empty, the base URL's search params are appended to the tile path.
   */
  private getTileUrl(tilePath: string){
    if (this.isValidURL(tilePath)) {
      const url = new URL(tilePath);
      return url.search === "" ? `${tilePath}${this._searchParams}` : tilePath;
    }
    return tilePath.includes("?") ? `${this._baseUrl}${tilePath}` : `${this._baseUrl}${tilePath}${this._searchParams}`;
  }

  /**
   * Returns the tile content. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileContent(name: string): Promise<ArrayBuffer> {
    return request(this.getTileUrl(name), "arraybuffer");
  }

  /**
   * Returns the tile content in json format. The path to the tile is relative to the base url of present reality data whatever the type.
   */
  public async getTileJson(name: string): Promise<any> {
    return request(this.getTileUrl(name), "json");
  }

  public getTileContentType(url: string): "tile" | "tileset" {
    return new URL(url, "https://localhost/").pathname.toLowerCase().endsWith("json") ? "tileset" : "tile";
  }

  public async getSpatialLocationAndExtents() {
    return undefined;
  }

  public async getPublisherProductInfo() {
    return undefined
  }
}

describe("RealityTileLoader", () => {
  let iModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    iModel = createBlankConnection();
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  async function createTree(): Promise<TileTree | undefined> {
    const tilesetUrl = "c:\\customserver\\myFile.json";
    const sourceProps: RealityDataSourceProps = {
      sourceKey: {
        provider: RealityDataProvider.TilesetUrl,
        id: tilesetUrl,
        format: "test",
      },
    };
    const rdSource = new MockRealityDataSource(sourceProps);
    if (undefined === rdSource)
      return undefined;

    const tree = RealityModelTileTree.createRealityModelTileTree(rdSource.key, iModel, "", undefined, {customSource: rdSource});
    return tree;
  }

  it("test", async () => {
    const tree = await createTree();
    console.log(tree);
    // TODO this tree contains a realitytileloader - now how to test this?

    expect(tree).toBeDefined();
  });
});