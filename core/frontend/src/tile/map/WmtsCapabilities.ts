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

/**
 * fetch XML from HTTP request
 * @param url server URL to address the request
 * @internal
 */
async function getXml(url: string, credentials?: RequestBasicCredentials): Promise<string|undefined> {
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

const getElementTextContent = (elem: Element, qualifiedName: string, defaultText?: string) => {
  let text: string|undefined, found = false;
  const tmpElem = elem.getElementsByTagName(qualifiedName);
  if (tmpElem.length > 0) {
    text = tmpElem[0].textContent ?? defaultText;
    found = true;
  }

  return {found, text};
};

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

    constructor(elem: Element) {
      const abstract = getElementTextContent(elem, OwsConstants.ABSTRACT_XMLTAG);
      if (abstract.found)
        this.abstract = abstract.text;

      const serviceType = getElementTextContent(elem, OwsConstants.SERVICETYPE_XMLTAG, "");
      if (serviceType.found)
        this.serviceType = serviceType.text;

      const serviceTypeVersion = getElementTextContent(elem, OwsConstants.SERVICETYPEVERSION_XMLTAG, "");
      if (serviceTypeVersion.found)
        this.serviceTypeVersion = serviceTypeVersion.text;

      const title = getElementTextContent(elem, OwsConstants.TITLE_XMLTAG);
      if (title.found)
        this.title = title.text;

      const keywords = elem.getElementsByTagName(OwsConstants.KEYWORDS_XMLTAG);
      if (keywords.length > 0) {
        const keyword =  keywords[0].getElementsByTagName(OwsConstants.KEYWORD_XMLTAG);
        this.keywords = [];
        for (const keyworkElem of keyword) {
          const keyWordText = keyworkElem.textContent;
          if (keyWordText)
            this.keywords.push(keyWordText);
        }
      }

      const accessConstraints = getElementTextContent(elem, OwsConstants.ACCESSCONSTRAINTS_XMLTAG, "");
      if (accessConstraints.found) {
        this.accessConstraints = accessConstraints.text;
      }

      const fees = getElementTextContent(elem, OwsConstants.FEES_XMLTAG);
      if (fees.found)
        this.fees = fees.text;
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
      const url = elem.getAttribute(WmtsCapability.XmlConstants.XLINK_HREF);
      if (url)
        this.url = url ?? "";

      const constraint = elem.getElementsByTagName(WmtsCapability.OwsConstants.CONSTRAINT_XMLTAG);
      if (constraint.length > 0) {
        this.constraintName = constraint[0].getAttribute("name") ?? "";
        if (this.constraintName?.endsWith(WmtsCapability.XmlConstants.CONSTRAINT_NAME_FILTER)) {
          const allowedValues = constraint[0].getElementsByTagName(WmtsCapability.OwsConstants.ALLOWEDVALUES_XMLTAG);
          if (allowedValues.length > 0) {
            const value = getElementTextContent(allowedValues[0], WmtsCapability.OwsConstants.VALUE_XMLTAG);
            if (value.found) {
              this.encoding = value.text;
            }
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

      const dcp = elem.getElementsByTagName(WmtsCapability.OwsConstants.DCP_XMLTAG);
      if (!dcp || dcp.length === 0)
        return;

      const dcpHttp = dcp[0].getElementsByTagName(WmtsCapability.OwsConstants.HTTP_XMLTAG);
      if (!dcpHttp || dcpHttp.length === 0)
        return;

      const get = dcpHttp[0].getElementsByTagName(WmtsCapability.OwsConstants.GET_XMLTAG);
      if (get.length > 0) {
        this._getDcpHttp = [];

        for (const getItem of get) {
          this._getDcpHttp?.push(new HttpDcp(getItem));
        }
      }

      const post = dcpHttp[0].getElementsByTagName(WmtsCapability.OwsConstants.POST_XMLTAG);
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
        if (tms.wellKnownScaleSet?.toLowerCase().includes(WmtsCapability.Constants.GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME))
          googleMapsTms.push(tms);

        // In case wellKnownScaleSet was not been set properly, infer from scaleDenominator
        // Note: some servers are quite inaccurate in their scale values, hence I used a delta value of 1.
        else if (   tms.tileMatrix.length > 0
                && Math.abs(tms.tileMatrix[0].scaleDenominator - WmtsCapability.Constants.GOOGLEMAPS_LEVEL0_SCALE_DENOM) < 1
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

      const title = getElementTextContent(elem, WmtsCapability.OwsConstants.TITLE_XMLTAG);
      if (title.found)
        this.title = title.text;

      const identifier = getElementTextContent(elem, WmtsCapability.OwsConstants.IDENTIFIER_XMLTAG);
      if (identifier.found)
        this.identifier = identifier.text;
    }
  }

  export class BoundingBox {
    public readonly crs?: string;
    public readonly range?: Range2d;

    constructor(elem: Element) {
      this.crs = elem.getAttribute("crs") ?? undefined;

      const lowerCorner = getElementTextContent(elem, WmtsCapability.OwsConstants.LOWERCORNER_XMLTAG);
      const upperCorner = getElementTextContent(elem, WmtsCapability.OwsConstants.UPPERCORNER_XMLTAG);
      if (lowerCorner.found && upperCorner.found) {
        const lowerCornerArray = lowerCorner.text?.split(" ").map((x: string) => +x);
        const upperCornerArray = upperCorner.text?.split(" ").map((x: string) => +x);
        if (lowerCornerArray && lowerCornerArray.length === 2 && upperCornerArray && upperCornerArray.length === 2)
          this.range = Range2d.createXYXY(lowerCornerArray[0], lowerCornerArray[1], upperCornerArray[0], upperCornerArray[1]);
      }
    }
  }

  export class TileMatrixSetLimits {
    public limits?: Range2d;
    public tileMatrix?: string;

    constructor(elem: Element) {
      const tileMatrix = getElementTextContent(elem, "TileMatrix");
      if (tileMatrix.found)
        this.tileMatrix = tileMatrix.text;

      const minTileRow = getElementTextContent(elem, "MinTileRow");
      const maxTileRow = getElementTextContent(elem, "MaxTileRow");
      const minTileCol = getElementTextContent(elem, "MinTileCol");
      const maxTileCol = getElementTextContent(elem, "MaxTileCol");

      if (minTileRow.text !== undefined && maxTileRow.text !== undefined && minTileCol.text !== undefined && maxTileCol.text )
        this.limits = Range2d.createXYXY(Number(minTileCol.text), Number(minTileRow.text), Number(maxTileCol.text), Number(maxTileRow.text));
    }
  }

  export class TileMatrixSetLink {
    public readonly tileMatrixSet: string;
    public readonly tileMatrixSetLimits = new Array<TileMatrixSetLimits>();

    constructor(elem: Element) {
      const tileMatrixSet = getElementTextContent(elem, "TileMatrixSet", "");
      this.tileMatrixSet = tileMatrixSet.text ? tileMatrixSet.text : "";

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
      const identifier = getElementTextContent(elem, WmtsCapability.OwsConstants.IDENTIFIER_XMLTAG, "");
      if (identifier.found)
        this.identifier = identifier.text!;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, WmtsCapability.OwsConstants.TITLE_XMLTAG).text;
      this.abstract =  getElementTextContent(elem, WmtsCapability.OwsConstants.ABSTRACT_XMLTAG).text;
      const supportedCrs = getElementTextContent(elem, WmtsCapability.OwsConstants.SUPPORTEDCRS_XMLTAG, "");

      if (supportedCrs.found)
        this.supportedCrs = supportedCrs.text!;
      else
        throw new Error("No supported CRS found.");

      this.wellKnownScaleSet = getElementTextContent(elem, WmtsCapability.XmlConstants.WELLKNOWNSCALESET_XMLTAG).text ?? "";

      // TileMatrix:
      // TileMatrix is mandatory on TileMatrixSet, if it doesn't exists, something is OFF with the capability.
      const tileMatrix = elem.getElementsByTagName( WmtsCapability.XmlConstants.TILEMATRIX_XMLTAG);
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
      const identifier = getElementTextContent(elem, WmtsCapability.OwsConstants.IDENTIFIER_XMLTAG, "");
      if (identifier.found)
        this.identifier = identifier.text!;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, WmtsCapability.OwsConstants.TITLE_XMLTAG).text;
      this.abstract = getElementTextContent(elem, WmtsCapability.OwsConstants.ABSTRACT_XMLTAG).text;

      // Scale denominator
      const scaleDenom = getElementTextContent(elem, WmtsCapability.XmlConstants.SCALEDENOMINATOR_XMLTAG, "");
      if (!scaleDenom.found)
        throw new Error("No scale denominator found on TileMatrix.");
      this.scaleDenominator = +scaleDenom.text!;

      // Top left corner
      const topLeftCorner = getElementTextContent(elem, WmtsCapability.XmlConstants.TOPLEFTCORNER_XMLTAG, "").text?.split(" ").map((x: string) => +x);
      if (topLeftCorner?.length !== 2)
        throw new Error("No TopLeftCorner found on TileMatrix.");
      this.topLeftCorner = Point2d.create(topLeftCorner[0], topLeftCorner[1]);

      // Tile Width
      const tileWidth = getElementTextContent(elem, XmlConstants.TILEWIDTH_XMLTAG, "");
      if (!tileWidth.found)
        throw new Error("No tile width found on TileMatrix.");
      this.tileWidth = +tileWidth.text!;

      // Tile Height
      const tileHeight = getElementTextContent(elem, XmlConstants.TILEHEIGHT_XMLTAG, "");
      if (!tileHeight.found)
        throw new Error("No tile height found on TileMatrix.");
      this.tileHeight = +tileHeight.text!;

      // Matrix Width
      const matrixWidth = getElementTextContent(elem, XmlConstants.MATRIXWIDTH_XMLTAG, "");
      if (!matrixWidth.found)
        throw new Error("No tile width found on TileMatrix.");
      this.matrixWidth = +matrixWidth.text!;

      // Matrix Height
      const matrixHeight = getElementTextContent(elem, XmlConstants.MATRIXHEIGHT_XMLTAG, "");
      if (!matrixHeight.found)
        throw new Error("No tile height found on TileMatrix.");
      this.matrixHeight = +matrixHeight.text!;
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

      const identifier = getElementTextContent(elem, WmtsCapability.OwsConstants.IDENTIFIER_XMLTAG, "");
      if (identifier.found)
        this.identifier = identifier.text!;
      else
        throw new Error("No Identifier found.");

      this.title = getElementTextContent(elem, WmtsCapability.OwsConstants.TITLE_XMLTAG).text;
      this.format = getElementTextContent(elem, "Format").text;

      // BoundingBox
      const boundingBox = elem.getElementsByTagName(WmtsCapability.OwsConstants.BOUNDINGBOX_XMLTAG);
      if (boundingBox.length > 0 )
        this.boundingBox =  new BoundingBox(boundingBox[0]);

      let lowerCornerArray: number[]|undefined, upperCornerArray: number[]|undefined;
      const bbox = elem.getElementsByTagName(WmtsCapability.OwsConstants.WGS84BOUNDINGBOX_XMLTAG);
      if (bbox.length > 0) {
        lowerCornerArray = getElementTextContent(bbox[0], WmtsCapability.OwsConstants.LOWERCORNER_XMLTAG).text?.split(" ").map((x: string) => +x);
        upperCornerArray = getElementTextContent(bbox[0], WmtsCapability.OwsConstants.UPPERCORNER_XMLTAG).text?.split(" ").map((x: string) => +x);
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
      const style  = elem.getElementsByTagName("Style");
      if (style.length > 0) {
        for (const styleElem of style)
          this.styles.push(new Style(styleElem));
      }

      // TileMatrixSetLink
      // TileMatrixSetLink is mandatory on Layer, if it doesn't exists, something is OFF with the capability.
      const tileMatrixSetLink = elem.getElementsByTagName( WmtsCapability.XmlConstants.TILEMATRIXSETLINK_XMLTAG);

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
      const serviceIdentification = capability.getElementsByTagName(WmtsCapability.OwsConstants.SERVICEIDENTIFICATION_XMLTAG);
      if (serviceIdentification.length > 0)
        this.serviceIdentification = new WmtsCapability.ServiceIdentification(serviceIdentification[0]);

      // Operations metadata
      const operationsMetadata = capability.getElementsByTagName(WmtsCapability.OwsConstants.OPERATIONSMETADATA_XMLTAG);
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
    const xmlDoc = parser.parseFromString(xmlCapabilities,"text/xml");
    return new WmtsCapabilities(xmlDoc);
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
