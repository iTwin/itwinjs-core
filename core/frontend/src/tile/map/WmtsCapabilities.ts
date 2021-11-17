/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Point2d, Range2d } from "@itwin/core-geometry";
import { request, RequestBasicCredentials, RequestOptions } from "@bentley/itwin-client";
import { xml2json } from "xml-js";
import { MapCartoRectangle, WmsUtilities } from "../internal"; // WmsUtilities needed for getBaseUrl

/**
 * fetch XML from HTTP request
 * @param url server URL to address the request
 * @internal
 */
async function getXml(url: string, credentials?: RequestBasicCredentials): Promise<any> {
  const options: RequestOptions = {
    method: "GET",
    responseType: "text",
    timeout: { response: 20000 },
    retries: 2,
    auth: credentials,
  };
  const data = await request(url, options);
  return data.text;
}

/** Encapsulation of the capabilities for an WMTS server
 * @internal
 */
export namespace WmtsCapability {

  export abstract class OwsConstants {
    // OWS xml tag names
    public static readonly ABSTRACT_XMLTAG = "ows:Abstract";
    public static readonly ACCESSCONSTRAINTS_XMLTAG = "ows:AccessConstraints";
    public static readonly ALLOWEDVALUES_XMLTAG = "ows:AllowedValues";
    public static readonly BOUNDINGBOX_XMLTAG = "ows:BoundingBox";
    public static readonly CONSTRAINT_XMLTAG = "ows:Constraint";
    public static readonly DCP_XMLTAG = "ows:DCP";
    public static readonly FEES_XMLTAG = "ows:Fees";
    public static readonly GET_XMLTAG = "ows:Get";
    public static readonly HTTP_XMLTAG = "ows:HTTP";
    public static readonly IDENTIFIER_XMLTAG = "ows:Identifier";
    public static readonly KEYWORDS_XMLTAG = "ows:Keywords";
    public static readonly KEYWORD_XMLTAG = "ows:Keyword";
    public static readonly LOWERCORNER_XMLTAG = "ows:LowerCorner";
    public static readonly OPERATION_XMLTAG = "ows:Operation";
    public static readonly OPERATIONSMETADATA_XMLTAG = "ows:OperationsMetadata";
    public static readonly POST_XMLTAG = "ows:Post";
    public static readonly SERVICEIDENTIFICATION_XMLTAG = "ows:ServiceIdentification";
    public static readonly SERVICETYPE_XMLTAG = "ows:ServiceType";
    public static readonly SERVICETYPEVERSION_XMLTAG = "ows:ServiceTypeVersion";
    public static readonly SUPPORTEDCRS_XMLTAG = "ows:SupportedCRS";
    public static readonly TITLE_XMLTAG = "ows:Title";
    public static readonly UPPERCORNER_XMLTAG = "ows:UpperCorner";
    public static readonly VALUE_XMLTAG = "ows:Value";
    public static readonly WGS84BOUNDINGBOX_XMLTAG = "ows:WGS84BoundingBox";
  }

  export abstract class XmlConstants {
    // Operations names
    public static readonly GETCAPABILITIES = "GetCapabilities";
    public static readonly GETTILE = "GetTile";
    public static readonly GETFEATUREINFO = "GetFeatureInfo";

    public static readonly MATRIXWIDTH_XMLTAG = "MatrixWidth";
    public static readonly MATRIXHEIGHT_XMLTAG = "MatrixHeight";
    public static readonly SCALEDENOMINATOR_XMLTAG = "ScaleDenominator";

    public static readonly TILEHEIGHT_XMLTAG = "TileHeight";
    public static readonly TILEMATRIX_XMLTAG = "TileMatrix";
    public static readonly TILEMATRIXSETLINK_XMLTAG = "TileMatrixSetLink";
    public static readonly TILEWIDTH_XMLTAG = "TileWidth";
    public static readonly TOPLEFTCORNER_XMLTAG = "TopLeftCorner";
    public static readonly WELLKNOWNSCALESET_XMLTAG = "WellKnownScaleSet";

    public static readonly CONSTRAINT_NAME_FILTER = "Encoding";
    public static readonly STYLE_ISDEFAULT = "IsDefault";
    public static readonly XLINK_HREF = "xlink:href";
  }

  export abstract class Constants {
    public static readonly GOOGLEMAPS_LEVEL0_SCALE_DENOM = 559082264.0287178;
    public static readonly GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME = "googlemapscompatible";
  }

  export class ServiceIdentification {
    public readonly abstract?: string;
    public readonly accessConstraints?: string;
    public readonly fees?: string;
    public readonly serviceType?: string;
    public readonly serviceTypeVersion?: string;
    public readonly title?: string;
    public readonly keywords?: string[];

    constructor(json: any) {
      this.abstract = json[OwsConstants.ABSTRACT_XMLTAG]?._text;
      this.serviceType = json[OwsConstants.SERVICETYPE_XMLTAG]?._text;
      this.serviceTypeVersion = json[OwsConstants.SERVICETYPEVERSION_XMLTAG]?._text;
      this.title = json[OwsConstants.TITLE_XMLTAG]?._text;

      const keywords = json[OwsConstants.KEYWORDS_XMLTAG]?.[OwsConstants.KEYWORD_XMLTAG];
      if (keywords !== undefined) {
        this.keywords = [];

        if (Array.isArray(keywords)) {
          for (const keyword of keywords) {
            if (keyword !== undefined) {
              this.keywords.push(keyword._text);
            }
          }
        } else {
          this.keywords.push(keywords._text);
        }
      }

      this.accessConstraints = json[OwsConstants.ACCESSCONSTRAINTS_XMLTAG]?._text;
      this.fees = json[OwsConstants.FEES_XMLTAG]?._text;
    }
  }

  export class OperationMetadata {
    private _getCapabilities?: Operation;
    public get getCapabilities(): Operation | undefined { return this._getCapabilities; }

    private _getFeatureInfo?: Operation;
    public get getFeatureInfo(): Operation | undefined { return this._getFeatureInfo; }

    private _getTile?: Operation;
    public get getTile(): Operation | undefined { return this._getTile; }

    private readOperation(op: any) {
      if (op?._attributes?.name === XmlConstants.GETCAPABILITIES)
        this._getCapabilities = new Operation(op);
      else if (op?._attributes?.name === XmlConstants.GETTILE)
        this._getTile = new Operation(op);
      else if (op?._attributes?.name === XmlConstants.GETFEATUREINFO)
        this._getFeatureInfo = new Operation(op);
    }

    constructor(json: any) {
      const operation = (json ? json[OwsConstants.OPERATION_XMLTAG] : undefined);
      if (operation) {
        if (Array.isArray(operation)) {
          operation.forEach((op: any) => {
            this.readOperation(op);
          });
        } else {
          this.readOperation(operation);
        }
      }
    }
  }

  export class HttpDcp {
    public readonly url?: string;
    public readonly constraintName?: string;

    // For simplicity of use we create a 'static' encoding property instead of having
    // a generic constraint data model.
    // We make sure the constraint name is 'encoding' related.
    public readonly encoding?: string;

    constructor(json: any) {
      this.url = json?._attributes[XmlConstants.XLINK_HREF];
      this.constraintName = (json ? json[OwsConstants.CONSTRAINT_XMLTAG]?._attributes?.name : undefined);
      if (this.constraintName?.endsWith(XmlConstants.CONSTRAINT_NAME_FILTER))
        this.encoding = json[OwsConstants.CONSTRAINT_XMLTAG]?.[OwsConstants.ALLOWEDVALUES_XMLTAG]?.[OwsConstants.VALUE_XMLTAG]?._text;
    }
  }

  export class Operation {
    public readonly name?: string;
    private _getDcpHttp?: HttpDcp[];
    public get getDcpHttp(): HttpDcp[] | undefined { return this._getDcpHttp; }
    private _postDcpHttp?: HttpDcp[];
    public get postDcpHttp(): HttpDcp[] | undefined { return this._postDcpHttp; }

    constructor(json: any) {
      this.name = json?._attributes?.name;

      const dcpHttp = (json ? json[OwsConstants.DCP_XMLTAG]?.[OwsConstants.HTTP_XMLTAG] : undefined);
      if (!dcpHttp)
        return;

      const get = dcpHttp[OwsConstants.GET_XMLTAG];
      if (get) {
        this._getDcpHttp = [];

        if (Array.isArray(get)) {
          get.forEach((getItem: any) => {
            this._getDcpHttp?.push(new WmtsCapability.HttpDcp(getItem));
          });
        } else {
          this._getDcpHttp?.push(new WmtsCapability.HttpDcp(get));
        }
      }

      const post = dcpHttp[OwsConstants.POST_XMLTAG];
      if (post) {
        this._postDcpHttp = [];

        if (Array.isArray(post)) {
          post.forEach((postItem: any) => {
            this._postDcpHttp?.push(new WmtsCapability.HttpDcp(postItem));
          });
        } else {
          this._postDcpHttp?.push(new WmtsCapability.HttpDcp(post));
        }
      }
    }
  }

  export class Contents {
    public readonly layers: WmtsCapability.Layer[] = [];
    public readonly tileMatrixSets: WmtsCapability.TileMatrixSet[] = [];

    constructor(private _json: any) {

      // Layers
      const jsonLayer = _json?.Layer;
      if (jsonLayer) {
        if (Array.isArray(jsonLayer)) {
          jsonLayer.forEach((layer: any) => {
            this.layers.push(new WmtsCapability.Layer(layer));
          });
        } else {
          this.layers.push(new WmtsCapability.Layer(jsonLayer));
        }
      }

      // TileMatrixSet
      const jsonTileMatrixSet = _json?.TileMatrixSet;
      if (jsonTileMatrixSet) {
        if (Array.isArray(jsonTileMatrixSet)) {
          jsonTileMatrixSet.forEach((matrixSet: any) => {
            this.tileMatrixSets.push(new WmtsCapability.TileMatrixSet(matrixSet));
          });
        } else {
          this.tileMatrixSets.push(new WmtsCapability.TileMatrixSet(jsonTileMatrixSet));
        }
      }
    }

    public getGoogleMapsCompatibleTileMatrixSet(): WmtsCapability.TileMatrixSet[] {
      const googleMapsTms: WmtsCapability.TileMatrixSet[] = [];
      this.tileMatrixSets.forEach((tms) => {
        if (tms.wellKnownScaleSet?.toLowerCase().includes(Constants.GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME))
          googleMapsTms.push(tms);

        // In case wellKnownScaleSet was not been set properly, infer from scaleDenominator
        // Note: some servers are quite inaccurate in their scale values, hence I used a delta value of 1.
        else if (tms.tileMatrix.length > 0
          && Math.abs(tms.tileMatrix[0].scaleDenominator - Constants.GOOGLEMAPS_LEVEL0_SCALE_DENOM) < 1
          && (tms.supportedCrs.includes("3857") || tms.supportedCrs.includes("900913")))
          googleMapsTms.push(tms);
      });
      return googleMapsTms;
    }

    public getEpsg4326CompatibleTileMatrixSet(): WmtsCapability.TileMatrixSet[] {
      return this.tileMatrixSets.filter((tms) => tms.supportedCrs.includes("4326"));
    }
  }

  export class Style {
    public readonly isDefault: boolean = false;
    public readonly title?: string;
    public readonly identifier?: string;
    // TODO: LegendURL

    constructor(private _json: any) {
      if (!_json)
        return;

      if (_json._attributes?.isDefault)
        this.isDefault = _json._attributes.isDefault.toLowerCase() === "true";

      this.title = _json[OwsConstants.TITLE_XMLTAG]?._text;
      this.identifier = _json[OwsConstants.IDENTIFIER_XMLTAG]?._text;
    }
  }
  export class BoundingBox {
    public readonly crs?: string;
    public readonly range?: Range2d;

    constructor(_json: any) {
      this.crs = _json._attributes?.crs;
      const lowerCorner = _json[OwsConstants.LOWERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      const upperCorner = _json[OwsConstants.UPPERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      if (lowerCorner.length === 2 && upperCorner.length === 2)
        this.range = Range2d.createXYXY(lowerCorner[0], lowerCorner[1], upperCorner[0], upperCorner[1]);
    }
  }

  export class TileMatrixSetLimits {
    public limits?: Range2d;
    public tileMatrix?: string;

    constructor(_json: any) {
      this.tileMatrix = _json.TileMatrix;
      if (_json.MinTileRow !== undefined && _json.MaxTileRow !== undefined && _json.MinTileCol !== undefined && _json.MaxTileCol)
        this.limits = Range2d.createXYXY(Number(_json.MinTileCol._text), Number(_json.MinTileRow._text), Number(_json.MaxTileCol._text), Number(_json.MaxTileRow._text));
    }
  }

  export class TileMatrixSetLink {
    public readonly tileMatrixSet: string;
    public readonly tileMatrixSetLimits = new Array<TileMatrixSetLimits>();

    constructor(_json: any) {
      this.tileMatrixSet = (_json?.TileMatrixSet?._text ? _json.TileMatrixSet._text : "");
      const tileMatrixLimits  = _json?.TileMatrixSetLimits?.TileMatrixLimits;
      if (Array.isArray(tileMatrixLimits))
        tileMatrixLimits.forEach((tml: any) => this.tileMatrixSetLimits.push(new TileMatrixSetLimits(tml)));
    }
  }

  export class TileMatrixSet {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly supportedCrs: string;
    public readonly wellKnownScaleSet: string;
    public readonly tileMatrix: TileMatrix[] = [];

    constructor(_json: any) {
      this.identifier = _json[OwsConstants.IDENTIFIER_XMLTAG]?._text;
      if (!this.identifier)
        throw new Error("No Identifier found.");

      this.title = _json[OwsConstants.TITLE_XMLTAG]?._text;
      this.abstract = _json[OwsConstants.ABSTRACT_XMLTAG]?._text;
      this.supportedCrs = _json[OwsConstants.SUPPORTEDCRS_XMLTAG]?._text;
      if (!this.supportedCrs)
        throw new Error("No supported CRS found.");

      this.wellKnownScaleSet = _json[XmlConstants.WELLKNOWNSCALESET_XMLTAG]?._text;

      // TileMatrix:
      // TileMatrix is mandatory on TileMatrixSet, if it doesn't exists, something is OFF with the capability.
      const tileMatrix = _json[XmlConstants.TILEMATRIX_XMLTAG];
      if (!tileMatrix)
        throw new Error("No matrix set link found for WMTS layer");

      if (Array.isArray(tileMatrix)) {
        tileMatrix.forEach((tm: any) => {
          this.tileMatrix.push(new TileMatrix(tm));
        });
      } else {
        this.tileMatrix.push(new TileMatrix(tileMatrix));
      }
    }
  }

  export class TileMatrix {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly scaleDenominator: number;
    public readonly topLeftCorner: Point2d;
    public readonly tileWidth: number;
    public readonly tileHeight: number;
    public readonly matrixWidth: number;
    public readonly matrixHeight: number;

    constructor(_json: any) {
      if (!_json)
        throw new Error("Invalid json data provided");

      this.identifier = _json[OwsConstants.IDENTIFIER_XMLTAG]?._text;
      if (!this.identifier)
        throw new Error("No Identifier found.");

      this.title = _json[OwsConstants.TITLE_XMLTAG]?._text;
      this.abstract = _json[OwsConstants.ABSTRACT_XMLTAG]?._text;

      // Scale denominator
      const scaleDenomStr = _json[XmlConstants.SCALEDENOMINATOR_XMLTAG]?._text;
      if (!scaleDenomStr)
        throw new Error("No scale denominator found on TileMatrix.");
      this.scaleDenominator = +scaleDenomStr;

      // Top left corner
      const topLeftCorner = _json[XmlConstants.TOPLEFTCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      if (topLeftCorner?.length !== 2)
        throw new Error("No TopLeftCorner found on TileMatrix.");
      this.topLeftCorner = Point2d.create(topLeftCorner[0], topLeftCorner[1]);

      // Tile Width
      const tileWidthStr = _json[XmlConstants.TILEWIDTH_XMLTAG]?._text;
      if (!tileWidthStr)
        throw new Error("No tile width found on TileMatrix.");
      this.tileWidth = +tileWidthStr;

      // Tile Height
      const tileHeightStr = _json[XmlConstants.TILEHEIGHT_XMLTAG]?._text;
      if (!tileHeightStr)
        throw new Error("No tile eight found on TileMatrix.");
      this.tileHeight = +tileHeightStr;

      // Matrix Width
      const matrixWidthStr = _json[XmlConstants.MATRIXWIDTH_XMLTAG]?._text;
      if (!matrixWidthStr)
        throw new Error("No tile width found on TileMatrix.");
      this.matrixWidth = +matrixWidthStr;

      // Matrix Height
      const matrixHeightStr = _json[XmlConstants.MATRIXHEIGHT_XMLTAG]?._text;
      if (!matrixHeightStr)
        throw new Error("No tile eight found on TileMatrix.");
      this.matrixHeight = +matrixHeightStr;
    }
  }

  export class Layer {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly format?: string;
    public readonly wsg84BoundingBox?: MapCartoRectangle;
    public readonly boundingBox?: BoundingBox;
    public readonly styles: Style[] = [];
    public readonly tileMatrixSetLinks: TileMatrixSetLink[] = [];

    constructor(_json: any) {
      if (!_json)
        throw new Error("Invalid json data provided");

      this.identifier = _json[OwsConstants.IDENTIFIER_XMLTAG]?._text;
      this.title = _json[OwsConstants.TITLE_XMLTAG]?._text;
      this.format = _json.Format?._text;

      // BoundingBox
      this.boundingBox = (_json[OwsConstants.BOUNDINGBOX_XMLTAG] ? new BoundingBox(_json[OwsConstants.BOUNDINGBOX_XMLTAG]) : undefined);

      // WSG84 BoundingBox
      const lowerCorner = _json[OwsConstants.WGS84BOUNDINGBOX_XMLTAG]?.[OwsConstants.LOWERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      const upperCorner = _json[OwsConstants.WGS84BOUNDINGBOX_XMLTAG]?.[OwsConstants.UPPERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      if (lowerCorner?.length === 2 && upperCorner?.length === 2)
        this.wsg84BoundingBox = MapCartoRectangle.createFromDegrees(lowerCorner[0], lowerCorner[1], upperCorner[0], upperCorner[1]);

      // If we could not initialized WSG84 bounding box, attempt to initialized it from Bounding Box
      if (!this.wsg84BoundingBox && (this.boundingBox?.crs?.includes("EPSG:4326") || this.boundingBox?.crs?.includes("CRS:84"))) {
        this.wsg84BoundingBox = MapCartoRectangle.createFromDegrees(this.boundingBox.range?.low.x, this.boundingBox.range?.low.y, this.boundingBox.range?.high.x, this.boundingBox.range?.high.y);
      }

      // Style
      if (Array.isArray(_json.Style)) {
        _json.Style.forEach((style: any) => {
          this.styles.push(new Style(style));
        });
      } else if (_json.Style) {
        this.styles.push(new Style(_json.Style));
      }

      // TileMatrixSetLink
      // TileMatrixSetLink is mandatory on Layer, if it doesn't exists, something is OFF with the capability.
      const tileMatrixSetLink = _json[XmlConstants.TILEMATRIXSETLINK_XMLTAG];

      if (!tileMatrixSetLink)
        throw new Error("No matrix set link found for WMTS layer");

      if (Array.isArray(tileMatrixSetLink)) {
        tileMatrixSetLink.forEach((tmsl: any) => {
          this.tileMatrixSetLinks.push(new TileMatrixSetLink(tmsl));
        });
      } else {
        this.tileMatrixSetLinks.push(new TileMatrixSetLink(tileMatrixSetLink));
      }
    }
  }
}

/** @internal */
export class WmtsCapabilities {
  private static _capabilitiesCache = new Map<string, WmtsCapabilities | undefined>();

  public get json() { return this._json; }

  public readonly version?: string;
  public readonly serviceIdentification?: WmtsCapability.ServiceIdentification;
  public readonly contents?: WmtsCapability.Contents;

  public readonly operationsMetadata?: WmtsCapability.OperationMetadata;

  constructor(private _json: any) {
    // Capabilities version
    this.version = _json?.Capabilities?._attributes.version;

    // Service Identification
    if (_json?.Capabilities?.[WmtsCapability.OwsConstants.SERVICEIDENTIFICATION_XMLTAG])
      this.serviceIdentification = new WmtsCapability.ServiceIdentification(_json?.Capabilities?.[WmtsCapability.OwsConstants.SERVICEIDENTIFICATION_XMLTAG]);

    // Operations metadata
    if (_json?.Capabilities?.[WmtsCapability.OwsConstants.OPERATIONSMETADATA_XMLTAG])
      this.operationsMetadata = new WmtsCapability.OperationMetadata(_json?.Capabilities?.[WmtsCapability.OwsConstants.OPERATIONSMETADATA_XMLTAG]);

    // Contents
    if (_json.Capabilities?.Contents)
      this.contents = new WmtsCapability.Contents(_json.Capabilities?.Contents);
  }

  public static createFromXml(xmlCapabilities: string): WmtsCapabilities | undefined {
    const jsonCapabilities = xml2json(xmlCapabilities, { compact: true, nativeType: false, ignoreComment: true });
    const capabilities = JSON.parse(jsonCapabilities);
    return new WmtsCapabilities(capabilities);
  }

  public static async create(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<WmtsCapabilities | undefined> {
    if (!ignoreCache) {
      const cached = WmtsCapabilities._capabilitiesCache.get(url);
      if (cached !== undefined)
        return cached;
    }

    const xmlCapabilities = await getXml(`${WmsUtilities.getBaseUrl(url)}?request=GetCapabilities&service=WMTS`, credentials);

    if (!xmlCapabilities)
      return undefined;

    const capabilities = WmtsCapabilities.createFromXml(xmlCapabilities);
    if (capabilities)
      WmtsCapabilities._capabilitiesCache.set(url, capabilities);

    return capabilities;
  }
}
