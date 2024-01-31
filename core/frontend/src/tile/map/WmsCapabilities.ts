/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { MapSubLayerProps } from "@itwin/core-common";
import { RequestBasicCredentials } from "../../request/Request";
import WMS from "wms-capabilities";
import { MapCartoRectangle, WmsUtilities } from "../internal";

function rangeFromJSONArray(json: any): MapCartoRectangle | undefined {
  return (Array.isArray(json) && json.length === 4) ? MapCartoRectangle.fromDegrees(json[0], json[1], json[2], json[3]) : undefined;
}

function rangeFromJSON(json: any): MapCartoRectangle | undefined {
  if (undefined !== json.LatLonBoundingBox)
    return rangeFromJSONArray(json.LatLonBoundingBox);
  else if (Array.isArray(json.EX_GeographicBoundingBox)) {
    return rangeFromJSONArray(json.EX_GeographicBoundingBox);
  } else {
    if (Array.isArray(json.BoundingBox))
      for (const boundingBox of json.BoundingBox) {
        if (boundingBox.crs === "CRS:84" || boundingBox.crs === "EPSG:4326") {
          return rangeFromJSONArray(boundingBox.extent);
        }
      }
    return undefined;
  }
}

function initArray<T>(input: any): undefined | T[] {
  return Array.isArray(input) ? input.slice() : undefined;
}

/** Encapsulation of the capabilities for an WMS server
 * @internal
 */
export namespace WmsCapability {

  export class Service {
    public readonly name: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly onlineResource?: string;
    public readonly contactInformation?: string;
    public readonly accessConstraints?: string;

    constructor(json: any) {
      this.name = json.Name ? json.Name : "";
      this.title = json.Title;
      this.abstract = json.Abstract;
      this.onlineResource = json.OnlineResource;
      this.contactInformation = json.ContactInformation;
      this.accessConstraints = json.AccessConstraints;
    }
  }

  export class Layer {
    public readonly queryable: boolean;
    public readonly title?: string;
    public readonly srs?: string[];
    public readonly cartoRange?: MapCartoRectangle;
    public readonly subLayers = new Array<SubLayer>();
    private static readonly PREFIX_SEPARATOR = ":";

    constructor(json: any, capabilities: WmsCapabilities) {
      this.queryable = json.queryable;
      this.title = json.title;
      this.srs = initArray<string>(capabilities.isVersion13 ? json.CRS : json.SRS);
      this.cartoRange = rangeFromJSON(json);
      this.subLayers.push(new SubLayer(json, capabilities));
    }
    public getSubLayers(visible = true): MapSubLayerProps[] {
      const subLayers = new Array<MapSubLayerProps>();
      let index = 1;
      let childrenFound = false;
      const pushSubLayer = ((subLayer: SubLayer, parent?: number) => {
        let children;
        const id = index++;
        if (subLayer.children) {
          childrenFound = false;
          children = new Array<number>();
          subLayer.children.forEach((child) => {
            children.push(index);
            pushSubLayer(child, id);
          });
        }
        subLayers.push({ name: subLayer.name, title: subLayer.title, visible, parent, children, id });
      });
      this.subLayers.forEach((subLayer) => pushSubLayer(subLayer));

      if (!childrenFound) {
        const prefixed = new Map<string, MapSubLayerProps[]>();
        subLayers.forEach((subLayer) => {
          if (subLayer.name && subLayer.name.indexOf(Layer.PREFIX_SEPARATOR) > 0) {
            const prefix = subLayer.name.slice(0, subLayer.name.indexOf(Layer.PREFIX_SEPARATOR));
            const found = prefixed.get(prefix);
            if (found)
              found.push(subLayer);
            else
              prefixed.set(prefix, [subLayer]);
          }
        });
        if (prefixed.size > 1) {
          // Preserve the root node if any.
          const rootNode = (this.subLayers.length === 1 && this.subLayers[0].children && this.subLayers[0].children.length > 1) ? subLayers.find((curSubLayer) => this.subLayers[0].name === curSubLayer.name)?.id : undefined;
          prefixed.forEach((children, parent) => {
            children.forEach((child) => {
              child.parent = index;
              // Remove the prefix from the title if present.
              if (child.title && child.title.indexOf(parent + Layer.PREFIX_SEPARATOR) === 0)
                child.title = child.title.slice(parent.length + Layer.PREFIX_SEPARATOR.length);
            });
            subLayers.push({ name: "", title: parent, parent: rootNode, id: index++, children: children.map((child) => child.id as number), visible });
          });
        }
      }

      return subLayers;
    }

    public getSubLayersCrs(layerNameFilter: string[]): Map<string, string[]> {
      const subLayerCrs = new Map<string, string[]>();

      const processSubLayer = ((subLayer: SubLayer) => {
        if (layerNameFilter.includes(subLayer.name)) {
          subLayerCrs.set(subLayer.name, subLayer.crs);
        }
        if (subLayer.children) {
          subLayer.children.forEach((child) => {
            processSubLayer(child);
          });
        }
      });

      this.subLayers.forEach((subLayer) => processSubLayer(subLayer));
      return subLayerCrs;
    }
  }

  /** @internal */
  export class SubLayer {
    public readonly name: string;
    public readonly title: string;
    public readonly crs: string[];
    public readonly ownCrs: string[];   // CRS specific to this layer (ie. not including inherited CRS)
    public readonly cartoRange?: MapCartoRectangle;
    public readonly children?: SubLayer[];
    public readonly queryable: boolean;
    public constructor(_json: any, capabilities: WmsCapabilities, public readonly parent?: SubLayer) {

      const getParentCrs = (parentLayer: SubLayer, crsSet: Set<string>) => {
        parentLayer.crs.forEach((parentCrs) => crsSet.add(parentCrs));
        if (parentLayer.parent) {
          getParentCrs(parentLayer.parent, crsSet);
        }
      };

      this.name = _json.Name ? _json.Name : "";
      this.title = _json.Title;
      this.queryable = _json.queryable ? true : false;
      this.cartoRange = rangeFromJSON(_json);
      this.ownCrs = capabilities.isVersion13 ? _json.CRS : _json.SRS;
      const crs = new Set<string>(this.ownCrs);
      if (parent) {
        getParentCrs(parent, crs);
      }
      this.crs = [...crs];

      if (Array.isArray(_json.Layer)) {
        this.children = new Array<SubLayer>();
        for (const childLayer of _json.Layer) {
          this.children.push(new SubLayer(childLayer, capabilities, this));
        }
      }
    }
  }
}

/** @internal */
export class WmsCapabilities {
  private static _capabilitiesCache = new Map<string, WmsCapabilities | undefined>();
  public readonly service: WmsCapability.Service;
  public readonly version?: string;
  public readonly isVersion13: boolean;
  public readonly layer?: WmsCapability.Layer;
  public get json() { return this._json; }
  public get maxLevel(): number { return this.layer ? this.layer.subLayers.length : - 1; }
  public get cartoRange(): MapCartoRectangle | undefined { return this.layer?.cartoRange; }
  public get featureInfoSupported() { return undefined !== this._json.Capability?.Request?.GetFeatureInfo; }
  public get featureInfoFormats(): string[] | undefined { return Array.isArray(this._json.Capability?.Request?.GetFeatureInfo?.Format) ? this._json.Capability?.Request?.GetFeatureInfo?.Format : undefined; }
  constructor(private _json: any) {
    this.version = _json.version;
    this.isVersion13 = _json.version !== undefined && 0 === _json.version.indexOf("1.3");
    this.service = new WmsCapability.Service(_json.Service);
    if (_json.Capability)
      this.layer = new WmsCapability.Layer(_json.Capability.Layer, this);
  }

  public static async create(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean, queryParams?: {[key: string]: string}): Promise<WmsCapabilities | undefined> {
    if (!ignoreCache) {
      const cached = WmsCapabilities._capabilitiesCache.get(url);
      if (cached !== undefined)
        return cached;
    }

    const tmpUrl = new URL(WmsUtilities.getBaseUrl(url));
    tmpUrl.searchParams.append("request", "GetCapabilities");
    tmpUrl.searchParams.append("service", "WMS");
    if (queryParams) {
      Object.keys(queryParams).forEach((paramKey) => {
        if (!tmpUrl.searchParams.has(paramKey))
          tmpUrl.searchParams.append(paramKey, queryParams[paramKey]);
      });
    }
    const xmlCapabilities = await WmsUtilities.fetchXml(tmpUrl.toString(), credentials);

    if (!xmlCapabilities)
      return undefined;

    const capabilities = new WmsCapabilities(new WMS().parse(xmlCapabilities));
    if (!credentials) {
      // Avoid caching protected data
      WmsCapabilities._capabilitiesCache.set(url, capabilities);
    }

    return capabilities;
  }
  public getSubLayers(visible = true): undefined | MapSubLayerProps[] {
    return this.layer ? this.layer.getSubLayers(visible) : undefined;
  }

  public getSubLayersCrs(subLayerNames: string[]): Map<string, string[]> | undefined {
    return this.layer ? this.layer.getSubLayersCrs(subLayerNames) : undefined;
  }
}
