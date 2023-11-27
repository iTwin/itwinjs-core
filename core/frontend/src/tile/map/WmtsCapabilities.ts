/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Point2d, Range2d } from "@itwin/core-geometry";
import { request, RequestBasicCredentials, RequestOptions } from "../../request/Request";
import { MapCartoRectangle, WmsUtilities } from "../internal"; // WmsUtilities needed for getBaseUrl

enum OwsConstants {
  ABSTRACT_XMLTAG = "ows:Abstract",
  ACCESSCONSTRAINTS_XMLTAG = "ows:AccessConstraints",
  ALLOWEDVALUES_XMLTAG = "ows:AllowedValues",
  BOUNDINGBOX_XMLTAG = "ows:BoundingBox",
  CONSTRAINT_XMLTAG = "ows:Constraint",
  DCP_XMLTAG = "ows:DCP",
  FEES_XMLTAG = "ows:Fees",
  GET_XMLTAG = "ows:Get",
  HTTP_XMLTAG = "ows:HTTP",
  IDENTIFIER_XMLTAG = "ows:Identifier",
  KEYWORDS_XMLTAG = "ows:Keywords",
  KEYWORD_XMLTAG = "ows:Keyword",
  LOWERCORNER_XMLTAG = "ows:LowerCorner",
  OPERATION_XMLTAG = "ows:Operation",
  OPERATIONSMETADATA_XMLTAG = "ows:OperationsMetadata",
  POST_XMLTAG = "ows:Post",
  SERVICEIDENTIFICATION_XMLTAG = "ows:ServiceIdentification",
  SERVICETYPE_XMLTAG = "ows:ServiceType",
  SERVICETYPEVERSION_XMLTAG = "ows:ServiceTypeVersion",
  SUPPORTEDCRS_XMLTAG = "ows:SupportedCRS",
  TITLE_XMLTAG = "ows:Title",
  UPPERCORNER_XMLTAG = "ows:UpperCorner",
  VALUE_XMLTAG = "ows:Value",
  WGS84BOUNDINGBOX_XMLTAG = "ows:WGS84BoundingBox"

}

enum XmlConstants {
  // Operations names
  GETCAPABILITIES = "GetCapabilities",
  GETTILE = "GetTile",
  GETFEATUREINFO = "GetFeatureInfo",

  MATRIXWIDTH_XMLTAG = "MatrixWidth",
  MATRIXHEIGHT_XMLTAG = "MatrixHeight",
  SCALEDENOMINATOR_XMLTAG = "ScaleDenominator",

  TILEHEIGHT_XMLTAG = "TileHeight",
  TILEMATRIX_XMLTAG = "TileMatrix",
  TILEMATRIXSETLINK_XMLTAG = "TileMatrixSetLink",
  TILEWIDTH_XMLTAG = "TileWidth",
  TOPLEFTCORNER_XMLTAG = "TopLeftCorner",
  WELLKNOWNSCALESET_XMLTAG = "WellKnownScaleSet",

  CONSTRAINT_NAME_FILTER = "Encoding",
  STYLE_ISDEFAULT = "IsDefault",
  XLINK_HREF = "xlink:href",
}

/** @internal
*/
export enum WmtsConstants {
  GOOGLEMAPS_LEVEL0_SCALE_DENOM = 559082264.0287178,
  GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME = "googlemapscompatible",
}

/**
 * fetch XML from HTTP request
 * @param url server URL to address the request
 * @internal
 */
async function getXml(url: string, credentials?: RequestBasicCredentials): Promise<string> {
  const options: RequestOptions = {
    timeout: 20000,
    retryCount: 2,
    auth: credentials,
  };
  return request(url, "text", options);
}

/**
 * Utility function to extract an element' text content
 * @return An element's text content, default to provided defaultTest value if no text is available.
 * @param url server URL to address the request
 * @internal
 */
const getElementTextContent = (elem: Element, qualifiedName: string, defaultText?: string) => {

  const tmpElem = elem.getElementsByTagName(qualifiedName);
  if (tmpElem.length > 0) {
    return tmpElem[0].textContent ?? defaultText;
  } else
    return defaultText;

};

/** Encapsulation of the capabilities for an WMTS server
 * @internal
 */
export namespace WmtsCapability {
  export class ServiceIdentification {
    public readonly abstract?: string;
    public readonly accessConstraints?: string;
    public readonly fees?: string;
    public readonly serviceType?: string;
    public readonly serviceTypeVersion?: string;
    public readonly title?: string;
    public readonly keywords?: string[];

    constructor(elem: Element) {
      this.abstract = getElementTextContent(elem, OwsConstants.ABSTRACT_XMLTAG);
      this.serviceType = getElementTextContent(elem, OwsConstants.SERVICETYPE_XMLTAG);
      this.serviceTypeVersion = getElementTextContent(elem, OwsConstants.SERVICETYPEVERSION_XMLTAG);
      this.title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);

      const keywords = elem.getElementsByTagName(OwsConstants.KEYWORDS_XMLTAG);
      if (keywords.length > 0) {
        const keyword = keywords[0].getElementsByTagName(OwsConstants.KEYWORD_XMLTAG);
        this.keywords = [];
        for (const keyworkElem of keyword) {
          const keyWordText = keyworkElem.textContent;
          if (keyWordText)
            this.keywords.push(keyWordText);
        }
      }

      this.accessConstraints = getElementTextContent(elem, OwsConstants.ACCESSCONSTRAINTS_XMLTAG);

      this.fees = getElementTextContent(elem, OwsConstants.FEES_XMLTAG);
    }
  }

  export class OperationMetadata {
    private _getCapabilities?: Operation;
    public get getCapabilities(): Operation | undefined { return this._getCapabilities; }

    private _getFeatureInfo?: Operation;
    public get getFeatureInfo(): Operation | undefined { return this._getFeatureInfo; }

    private _getTile?: Operation;
    public get getTile(): Operation | undefined { return this._getTile; }

    private readOperation(op: Element) {
      const nameAttr = op.attributes.getNamedItem("name");
      if (!nameAttr)
        return;

      if (nameAttr.textContent === XmlConstants.GETCAPABILITIES) {
        this._getCapabilities = new Operation(op);
      } else if (nameAttr.textContent === XmlConstants.GETTILE) {
        this._getTile = new Operation(op);
      } else if (nameAttr.textContent === XmlConstants.GETFEATUREINFO) {
        this._getFeatureInfo = new Operation(op);
      }
    }

    constructor(elem: Element) {
      const operation = elem.getElementsByTagName(OwsConstants.OPERATION_XMLTAG);
      if (operation.length > 0) {
        for (const op of operation) {
          this.readOperation(op);
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

    constructor(elem: Element) {
      const url = elem.getAttribute(XmlConstants.XLINK_HREF);
      if (url)
        this.url = url ?? "";

      const constraint = elem.getElementsByTagName(OwsConstants.CONSTRAINT_XMLTAG);
      if (constraint.length > 0) {
        this.constraintName = constraint[0].getAttribute("name") ?? "";
        if (this.constraintName?.endsWith(XmlConstants.CONSTRAINT_NAME_FILTER)) {
          const allowedValues = constraint[0].getElementsByTagName(OwsConstants.ALLOWEDVALUES_XMLTAG);
          if (allowedValues.length > 0) {
            this.encoding = getElementTextContent(allowedValues[0], OwsConstants.VALUE_XMLTAG);
          }
        }
      }
    }
  }

  export class Operation {
    public readonly name?: string;
    private _getDcpHttp?: HttpDcp[];
    public get getDcpHttp(): HttpDcp[] | undefined { return this._getDcpHttp; }
    private _postDcpHttp?: HttpDcp[];
    public get postDcpHttp(): HttpDcp[] | undefined { return this._postDcpHttp; }

    constructor(elem: Element) {
      const name = elem.getAttribute("name");
      if (name)
        this.name = name;

      const dcp = elem.getElementsByTagName(OwsConstants.DCP_XMLTAG);
      if (!dcp || dcp.length === 0)
        return;

      const dcpHttp = dcp[0].getElementsByTagName(OwsConstants.HTTP_XMLTAG);
      if (!dcpHttp || dcpHttp.length === 0)
        return;

      const get = dcpHttp[0].getElementsByTagName(OwsConstants.GET_XMLTAG);
      if (get.length > 0) {
        this._getDcpHttp = [];

        for (const getItem of get) {
          this._getDcpHttp?.push(new HttpDcp(getItem));
        }
      }

      const post = dcpHttp[0].getElementsByTagName(OwsConstants.POST_XMLTAG);
      if (post.length > 0) {
        this._postDcpHttp = [];

        for (const postItem of post) {
          this._postDcpHttp?.push(new HttpDcp(postItem));
        }
      }
    }
  }

  export class Contents {
    public readonly layers: Layer[] = [];
    public readonly tileMatrixSets: TileMatrixSet[] = [];

    constructor(elem: Element) {
      // Layers
      const layer = elem.getElementsByTagName("Layer");
      if (layer) {
        for (const layerElem of layer)
          this.layers.push(new Layer(layerElem));
      }

      // TileMatrixSet
      const tms = elem.querySelectorAll("Contents > TileMatrixSet");
      if (tms) {
        for (const tmsElem of tms)
          this.tileMatrixSets.push(new TileMatrixSet(tmsElem));
      }

    }

    public getGoogleMapsCompatibleTileMatrixSet(): TileMatrixSet[] {
      const googleMapsTms: TileMatrixSet[] = [];
      this.tileMatrixSets.forEach((tms) => {
        if (tms.wellKnownScaleSet?.toLowerCase().includes(WmtsConstants.GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME))
          googleMapsTms.push(tms);

        // In case wellKnownScaleSet was not been set properly, infer from scaleDenominator
        // Note: some servers are quite inaccurate in their scale values, hence I used a delta value of 1.
        else if (tms.tileMatrix.length > 0
          && Math.abs(tms.tileMatrix[0].scaleDenominator - WmtsConstants.GOOGLEMAPS_LEVEL0_SCALE_DENOM) < 1
          && (tms.supportedCrs.includes("3857") || tms.supportedCrs.includes("900913"))
        )
          googleMapsTms.push(tms);
      });
      return googleMapsTms;
    }

    public getEpsg4326CompatibleTileMatrixSet(): TileMatrixSet[] {
      return this.tileMatrixSets.filter((tms) => tms.supportedCrs.includes("4326"));
    }
  }

  export class Style {
    public readonly isDefault: boolean = false;
    public readonly title?: string;
    public readonly identifier?: string;
    // TODO: LegendURL

    constructor(elem: Element) {
      if (!elem)
        return;

      const isDefault = elem.getAttribute("isDefault");
      if (isDefault)
        this.isDefault = isDefault.toLowerCase() === "true";

      this.title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);
      this.identifier = getElementTextContent(elem, OwsConstants.IDENTIFIER_XMLTAG);
    }
  }

  export class BoundingBox {
    public readonly crs?: string;
    public readonly range?: Range2d;

    constructor(elem: Element) {
      this.crs = elem.getAttribute("crs") ?? undefined;

      const lowerCorner = getElementTextContent(elem, OwsConstants.LOWERCORNER_XMLTAG);
      const upperCorner = getElementTextContent(elem, OwsConstants.UPPERCORNER_XMLTAG);
      if (lowerCorner && upperCorner) {
        const lowerCornerArray = lowerCorner?.split(" ").map((x: string) => +x);
        const upperCornerArray = upperCorner?.split(" ").map((x: string) => +x);
        if (lowerCornerArray && lowerCornerArray.length === 2 && upperCornerArray && upperCornerArray.length === 2)
          this.range = Range2d.createXYXY(lowerCornerArray[0], lowerCornerArray[1], upperCornerArray[0], upperCornerArray[1]);
      }
    }
  }

  export class TileMatrixSetLimits {
    public limits?: Range2d;
    public tileMatrix?: string;

    constructor(elem: Element) {

      this.tileMatrix = getElementTextContent(elem, "TileMatrix");

      const minTileRow = getElementTextContent(elem, "MinTileRow");
      const maxTileRow = getElementTextContent(elem, "MaxTileRow");
      const minTileCol = getElementTextContent(elem, "MinTileCol");
      const maxTileCol = getElementTextContent(elem, "MaxTileCol");

      if (minTileRow !== undefined && maxTileRow !== undefined && minTileCol !== undefined && maxTileCol)
        this.limits = Range2d.createXYXY(Number(minTileCol), Number(minTileRow), Number(maxTileCol), Number(maxTileRow));
    }
  }

  export class TileMatrixSetLink {
    public readonly tileMatrixSet: string;
    public readonly tileMatrixSetLimits = new Array<TileMatrixSetLimits>();

    constructor(elem: Element) {

      this.tileMatrixSet = getElementTextContent(elem, "TileMatrixSet", "")!;

      const tileMatrixLimitsRoot = elem.getElementsByTagName("TileMatrixSetLimits");
      if (tileMatrixLimitsRoot.length > 0) {
        const tileMatrixLimits = tileMatrixLimitsRoot[0].getElementsByTagName("TileMatrixSetLimits");
        for (const tmsl of tileMatrixLimits) {
          this.tileMatrixSetLimits.push(new TileMatrixSetLimits(tmsl));
        }
      }
    }
  }

  export class TileMatrixSet {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly supportedCrs: string;
    public readonly wellKnownScaleSet: string;
    public readonly tileMatrix: TileMatrix[] = [];

    constructor(elem: Element) {
      const identifier = getElementTextContent(elem, OwsConstants.IDENTIFIER_XMLTAG);
      if (identifier)
        this.identifier = identifier;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);
      this.abstract = getElementTextContent(elem, OwsConstants.ABSTRACT_XMLTAG);

      const supportedCrs = getElementTextContent(elem, OwsConstants.SUPPORTEDCRS_XMLTAG);
      if (supportedCrs)
        this.supportedCrs = supportedCrs;
      else
        throw new Error("No supported CRS found.");

      this.wellKnownScaleSet = getElementTextContent(elem, XmlConstants.WELLKNOWNSCALESET_XMLTAG, "")!;

      // TileMatrix:
      // TileMatrix is mandatory on TileMatrixSet, if it doesn't exists, something is OFF with the capability.
      const tileMatrix = elem.getElementsByTagName(XmlConstants.TILEMATRIX_XMLTAG);
      if (tileMatrix.length === 0)
        throw new Error("No matrix set link found for WMTS layer");

      for (const tm of tileMatrix) {
        this.tileMatrix.push(new TileMatrix(tm));
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

    constructor(elem: Element) {
      const identifier = getElementTextContent(elem, OwsConstants.IDENTIFIER_XMLTAG, "");
      if (identifier)
        this.identifier = identifier;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);
      this.abstract = getElementTextContent(elem, OwsConstants.ABSTRACT_XMLTAG);

      // Scale denominator
      const scaleDenom = getElementTextContent(elem, XmlConstants.SCALEDENOMINATOR_XMLTAG, "");
      if (!scaleDenom)
        throw new Error("No scale denominator found on TileMatrix.");
      this.scaleDenominator = +scaleDenom;

      // Top left corner
      const topLeftCorner = getElementTextContent(elem, XmlConstants.TOPLEFTCORNER_XMLTAG, "")?.split(" ").map((x: string) => +x);
      if (topLeftCorner?.length !== 2)
        throw new Error("No TopLeftCorner found on TileMatrix.");
      this.topLeftCorner = Point2d.create(topLeftCorner[0], topLeftCorner[1]);

      // Tile Width
      const tileWidth = getElementTextContent(elem, XmlConstants.TILEWIDTH_XMLTAG);
      if (!tileWidth)
        throw new Error("No tile width found on TileMatrix.");
      this.tileWidth = +tileWidth;

      // Tile Height
      const tileHeight = getElementTextContent(elem, XmlConstants.TILEHEIGHT_XMLTAG);
      if (!tileHeight)
        throw new Error("No tile height found on TileMatrix.");
      this.tileHeight = +tileHeight;

      // Matrix Width
      const matrixWidth = getElementTextContent(elem, XmlConstants.MATRIXWIDTH_XMLTAG);
      if (!matrixWidth)
        throw new Error("No tile width found on TileMatrix.");
      this.matrixWidth = +matrixWidth;

      // Matrix Height
      const matrixHeight = getElementTextContent(elem, XmlConstants.MATRIXHEIGHT_XMLTAG);
      if (!matrixHeight)
        throw new Error("No tile height found on TileMatrix.");
      this.matrixHeight = +matrixHeight;
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

    constructor(elem: Element) {

      const identifier = getElementTextContent(elem, OwsConstants.IDENTIFIER_XMLTAG, "");
      if (identifier)
        this.identifier = identifier;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);
      this.format = getElementTextContent(elem, "Format");

      // BoundingBox
      const boundingBox = elem.getElementsByTagName(OwsConstants.BOUNDINGBOX_XMLTAG);
      if (boundingBox.length > 0)
        this.boundingBox = new BoundingBox(boundingBox[0]);

      let lowerCornerArray: number[] | undefined, upperCornerArray: number[] | undefined;
      const bbox = elem.getElementsByTagName(OwsConstants.WGS84BOUNDINGBOX_XMLTAG);
      if (bbox.length > 0) {
        lowerCornerArray = getElementTextContent(bbox[0], OwsConstants.LOWERCORNER_XMLTAG)?.split(" ").map((x: string) => +x);
        upperCornerArray = getElementTextContent(bbox[0], OwsConstants.UPPERCORNER_XMLTAG)?.split(" ").map((x: string) => +x);
      }

      if (lowerCornerArray?.length === 2 && upperCornerArray?.length === 2)
        this.wsg84BoundingBox = MapCartoRectangle.fromDegrees(lowerCornerArray[0], lowerCornerArray[1], upperCornerArray[0], upperCornerArray[1]);

      // If we could not initialized WSG84 bounding box, attempt to initialized it from Bounding Box
      if (!this.wsg84BoundingBox && (this.boundingBox?.crs?.includes("EPSG:4326") || this.boundingBox?.crs?.includes("CRS:84"))) {
        const range = this.boundingBox.range;
        if (range)
          this.wsg84BoundingBox = MapCartoRectangle.fromDegrees(range.low.x, range.low.y, range.high.x, range.high.y);
        else
          this.wsg84BoundingBox = MapCartoRectangle.createMaximum();
      }

      // Style
      const style = elem.getElementsByTagName("Style");
      if (style.length > 0) {
        for (const styleElem of style)
          this.styles.push(new Style(styleElem));
      }

      // TileMatrixSetLink
      // TileMatrixSetLink is mandatory on Layer, if it doesn't exists, something is OFF with the capability.
      const tileMatrixSetLink = elem.getElementsByTagName(XmlConstants.TILEMATRIXSETLINK_XMLTAG);

      if (tileMatrixSetLink.length === 0)
        throw new Error("No matrix set link found for WMTS layer");

      for (const tmsl of tileMatrixSetLink)
        this.tileMatrixSetLinks.push(new TileMatrixSetLink(tmsl));
    }
  }
}
/** @internal */
export class WmtsCapabilities {
  private static _capabilitiesCache = new Map<string, WmtsCapabilities | undefined>();

  public readonly version?: string;
  public readonly serviceIdentification?: WmtsCapability.ServiceIdentification;
  public readonly contents?: WmtsCapability.Contents;

  public readonly operationsMetadata?: WmtsCapability.OperationMetadata;

  constructor(xmlDoc: Document) {

    const capabilities = xmlDoc.getElementsByTagName("Capabilities");
    if (capabilities.length !== 0) {
      const capability = capabilities[0];
      this.version = capability.getAttribute("version") ?? undefined;

      // Service Identification
      const serviceIdentification = capability.getElementsByTagName(OwsConstants.SERVICEIDENTIFICATION_XMLTAG);
      if (serviceIdentification.length > 0)
        this.serviceIdentification = new WmtsCapability.ServiceIdentification(serviceIdentification[0]);

      // Operations metadata
      const operationsMetadata = capability.getElementsByTagName(OwsConstants.OPERATIONSMETADATA_XMLTAG);
      if (operationsMetadata.length > 0)
        this.operationsMetadata = new WmtsCapability.OperationMetadata(operationsMetadata[0]);

      // Contents
      const content = capability.getElementsByTagName("Contents");
      if (content.length > 0)
        this.contents = new WmtsCapability.Contents(content[0]);
    }
  }

  public static createFromXml(xmlCapabilities: string): WmtsCapabilities | undefined {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlCapabilities, "text/xml");
    return new WmtsCapabilities(xmlDoc);
  }

  public static async create(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean, queryParams?: {[key: string]: string}): Promise<WmtsCapabilities | undefined> {
    if (!ignoreCache) {
      const cached = WmtsCapabilities._capabilitiesCache.get(url);
      if (cached !== undefined)
        return cached;
    }

    const tmpUrl = new URL(WmsUtilities.getBaseUrl(url));
    tmpUrl.searchParams.append("request", "GetCapabilities");
    tmpUrl.searchParams.append("service", "WMTS");
    if (queryParams) {
      Object.keys(queryParams).forEach((paramKey) => {
        if (!tmpUrl.searchParams.has(paramKey))
          tmpUrl.searchParams.append(paramKey, queryParams[paramKey]);
      });
    }

    const xmlCapabilities = await getXml(tmpUrl.toString(), credentials);
    if (!xmlCapabilities)
      return undefined;

    const capabilities = WmtsCapabilities.createFromXml(xmlCapabilities);
    if (capabilities)
      WmtsCapabilities._capabilitiesCache.set(url, capabilities);

    return capabilities;
  }
}
