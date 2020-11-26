/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { Range2d } from "@bentley/geometry-core";
import { request, RequestBasicCredentials, RequestOptions } from "@bentley/itwin-client";
import { xml2json } from "xml-js";
import { MapCartoRectangle } from "../../imodeljs-frontend";
import { WmsUtilities } from "./WmsUtilities"; // needed for getBaseUrl

/** @packageDocumentation
 * @module Views
 */

/**
 * fetch XML from HTTP request
 * @param url server URL to address the request
 * @internal
 */
async function getXml(requestContext: ClientRequestContext, url: string, credentials?: RequestBasicCredentials): Promise<any> {
  const options: RequestOptions = {
    method: "GET",
    responseType: "text",
    timeout: { response: 20000 },
    retries: 2,
    auth: credentials,
  };
  const data = await request(requestContext, url, options);
  return data.text;
}

export namespace WmtsCapability {

  // Operations names
  export const OPS_GETCAPABILITIES = "GetCapabilities";
  export const OPS_GETTILE = "GetTile";
  export const OPS_GETFEATUREINFO = "GetFeatureInfo";

  // OWS xml tag names
  export const OWS_ABSTRACT_XMLTAG = "ows:Abstract";
  export const OWS_ALLOWEDVALUES_XMLTAG = "ows:AllowedValues";
  export const OWS_BOUNDINGBOX_XMLTAG = "ows:BoundingBox";
  export const OWS_CONSTRAINT_XMLTAG = "ows:Constraint";
  export const OWS_DCP_XMLTAG = "ows:DCP";
  export const OWS_GET_XMLTAG = "ows:Get";
  export const OWS_HTTP_XMLTAG = "ows:HTTP";
  export const OWS_IDENTIFIER_XMLTAG = "ows:Identifier";
  export const OWS_LOWERCORNER_XMLTAG = "ows:LowerCorner";
  export const OWS_OPERATION_XMLTAG = "ows:Operation";
  export const OWS_OPERATIONSMETADATA_XMLTAG = "ows:OperationsMetadata";
  export const OWS_POST_XMLTAG = "ows:Post";
  export const OWS_SERVICETYPE_XMLTAG = "ows:ServiceType";
  export const OWS_SERVICETYPEVERSION_XMLTAG = "ows:ServiceTypeVersion";
  export const OWS_TITLE_XMLTAG = "ows:Title";
  export const OWS_UPPERCORNER_XMLTAG = "ows:UpperCorner";
  export const OWS_VALUE_XMLTAG = "ows:Value";
  export const OWS_WGS84BOUNDINGBOX_XMLTAG = "ows:WGS84BoundingBox";

  // xml tag names
  export const TILEMATRIXSETLINK_XMLTAG = "TileMatrixSetLink";

  // other strings...
  export const CONSTRAINT_NAME_FILTER = "Encoding";
  export const STYLE_ISDEFAULT = "IsDefault";
  export const XLINK_HREF = "xlink:href";

  export class ServiceIdentification {
    public readonly abstract?: string;
    public readonly operationMetadata?: OperationMetadata;
    public readonly serviceType?: string;
    public readonly serviceTypeVersion?: string;
    public readonly title?: string;

    constructor(json: any) {
      this.abstract = json[OWS_ABSTRACT_XMLTAG]?._text;
      this.serviceType = json[OWS_SERVICETYPE_XMLTAG]?._text;
      this.serviceTypeVersion = json[OWS_SERVICETYPEVERSION_XMLTAG]?._text;
      this.title = json[OWS_TITLE_XMLTAG]?._text;
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
      if (op?._attributes?.name === OPS_GETCAPABILITIES)
        this._getCapabilities = new Operation(op);
      else if (op?._attributes?.name === OPS_GETTILE)
        this._getTile = new Operation(op);
      else if (op?._attributes?.name === OPS_GETFEATUREINFO)
        this._getFeatureInfo = new Operation(op);
    }

    constructor(json: any) {
      const operation = (json ? json[OWS_OPERATION_XMLTAG] : undefined);
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
      this.url = json?._attributes[XLINK_HREF];
      this.constraintName = (json ? json[OWS_CONSTRAINT_XMLTAG]?._attributes?.name : undefined);
      if (this.constraintName?.endsWith(CONSTRAINT_NAME_FILTER))
        this.encoding = json[OWS_CONSTRAINT_XMLTAG]?.[OWS_ALLOWEDVALUES_XMLTAG]?.[OWS_VALUE_XMLTAG]?._text;
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

      const dcpHttp = (json ? json[OWS_DCP_XMLTAG]?.[OWS_HTTP_XMLTAG] : undefined);
      if (!dcpHttp)
        return;

      const get = dcpHttp[OWS_GET_XMLTAG];
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

      const post = dcpHttp[OWS_POST_XMLTAG];
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

    constructor(private _json: any) {

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
    }
  }

  export class Style {
    public readonly isDefault: boolean = true;
    public readonly title?: string;
    public readonly identifier?: string;
    // TODO: LegendURL

    constructor(private _json: any) {
      if (!_json)
        return;

      if (_json._attributes.hasOwnProperty(STYLE_ISDEFAULT))
        this.isDefault = _json._attributes.isDefault;

      this.title = _json[OWS_TITLE_XMLTAG]?._text;
      this.identifier = _json[OWS_IDENTIFIER_XMLTAG]?._text;
    }
  }
  export class BoundingBox {
    public readonly crs?: string;
    public readonly range?: Range2d;

    constructor(_json: any) {
      this.crs = _json._attributes?.crs;
      const lowerCorner = _json[OWS_LOWERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      const upperCorner = _json[OWS_UPPERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      if (lowerCorner.length === 2 && upperCorner.length === 2)
        this.range = Range2d.createXYXY(lowerCorner[0], lowerCorner[1], upperCorner[0], upperCorner[1]);
    }
  }

  export class TileMatrixSetLink {
    public readonly tileMatrixSet: string;
    // TODO: TileMatrixSetLimits

    constructor(json: any) {
      this.tileMatrixSet = (json?.TileMatrixSet?._text ? json.TileMatrixSet._text : "");
    }
  }

  export class Layer {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly format?: string;
    public readonly wsg84BoundingBox?: MapCartoRectangle;
    public readonly boundingBox?: BoundingBox;
    public readonly style?: Style;
    public readonly tileMatrixSetLinks: TileMatrixSetLink[] = [];


    constructor(_json: any) {
      if (!_json)
        throw new Error("Invalid json data provided");

      this.identifier = _json[OWS_IDENTIFIER_XMLTAG]?._text;
      this.title = _json[OWS_TITLE_XMLTAG]?._text;
      this.format = _json.Format?._text;

      // BoundingBox
      this.boundingBox = (_json[OWS_BOUNDINGBOX_XMLTAG] ? new BoundingBox(_json[OWS_BOUNDINGBOX_XMLTAG]) : undefined);

      // WSG84 BoundingBox
      const lowerCorner = _json[OWS_WGS84BOUNDINGBOX_XMLTAG]?.[OWS_LOWERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      const upperCorner = _json[OWS_WGS84BOUNDINGBOX_XMLTAG]?.[OWS_UPPERCORNER_XMLTAG]?._text?.split(" ").map((x: string) => +x);
      if (lowerCorner?.length === 2 && upperCorner?.length === 2)
        this.wsg84BoundingBox = MapCartoRectangle.createFromDegrees(lowerCorner[0], lowerCorner[1], upperCorner[0], upperCorner[1]);

      // If we could not initialized WSG84 bounding box, attempt to initialized it from Bounding Box
      if (!this.wsg84BoundingBox && (this.boundingBox?.crs?.includes("EPSG:4326") || this.boundingBox?.crs?.includes("CRS:84"))) {
        this.wsg84BoundingBox = MapCartoRectangle.createFromDegrees(this.boundingBox.range?.low.x, this.boundingBox.range?.low.y, this.boundingBox.range?.high.x, this.boundingBox.range?.high.y);
      }

      // Style
      this.style = (_json.Style ? new Style(_json.Style) : undefined);

      // TileMatrixSetLink
      // TileMatrixSetLink is mandatory on Layer, if it doesn't exists, something is OFF with the capability.
      const tileMatrixSetLink = _json[TILEMATRIXSETLINK_XMLTAG];

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

    // Operations metadata
    if (_json?.Capabilities?.[WmtsCapability.OWS_OPERATIONSMETADATA_XMLTAG])
      this.operationsMetadata = new WmtsCapability.OperationMetadata(_json?.Capabilities?.[WmtsCapability.OWS_OPERATIONSMETADATA_XMLTAG]);

    // Contents
    if (_json.Capabilities?.Contents)
      this.contents = new WmtsCapability.Contents(_json.Capabilities?.Contents);
  }

  public static createFromXml(xmlCapabilities: string): WmtsCapabilities | undefined {
    const jsonCapabilities = xml2json(xmlCapabilities, { compact: true, nativeType: true, ignoreComment: true });
    const capabilities = JSON.parse(jsonCapabilities);
    return new WmtsCapabilities(capabilities);
  }

  public static async create(url: string, credentials?: RequestBasicCredentials): Promise<WmtsCapabilities | undefined> {
    const cached = WmtsCapabilities._capabilitiesCache.get(url);
    if (cached !== undefined)
      return cached;

    const xmlCapabilities = await getXml(new ClientRequestContext(""), `${WmsUtilities.getBaseUrl(url)}?request=GetCapabilities&service=WMS`, credentials);

    if (!xmlCapabilities)
      return undefined;

    const capabilities = WmtsCapabilities.createFromXml(xmlCapabilities);
    if (capabilities)
      WmtsCapabilities._capabilitiesCache.set(url, capabilities);

    return capabilities;
  }
}
