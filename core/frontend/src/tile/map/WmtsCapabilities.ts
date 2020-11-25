/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { request, RequestBasicCredentials, RequestOptions } from "@bentley/itwin-client";
import { xml2json } from "xml-js";
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

  const WMTS_OWS_ABSTRACT_XML_TAG = "ows:Abstract";
  const WMTS_OWS_OPERATIONMETADATA_XML_TAG = "ows:OperationMetadata";
  const WMTS_OWS_SERVICETYPE_XML_TAG = "ows:ServiceType";
  const WMTS_OWS_SERVICETYPEVERSION_XML_TAG = "ows:ServiceTypeVersion";

  export class ServiceIdentification {
    public readonly abstract?: string;
    public readonly operationMetadata?: OperationMetadata;
    public readonly serviceType?: string;
    public readonly serviceTypeVersion?: string;
    public readonly title?: string;

    constructor(json: any) {
      this.abstract = json[WMTS_OWS_ABSTRACT_XML_TAG]?._text;
      this.operationMetadata = json[WMTS_OWS_OPERATIONMETADATA_XML_TAG]?._text;;
      this.serviceType = json[WMTS_OWS_SERVICETYPE_XML_TAG]?._text;
      this.serviceTypeVersion = json[WMTS_OWS_SERVICETYPEVERSION_XML_TAG]?._text;
      this.title = json["ows:Title"]?._text;
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
      if (op?._attributes?.name === "GetCapabilities")
        this._getCapabilities = new Operation(op);
      else if (op?._attributes?.name === "GetTile")
        this._getTile = new Operation(op);
      else if (op?._attributes?.name === "GetFeatureInfo")
        this._getFeatureInfo = new Operation(op);
    }

    constructor(json: any) {
      const operation = (json && json.hasOwnProperty("ows:Operation")) ? json["ows:Operation"] : undefined;
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
    // a generic constraint value.  We make sure the constraint name is 'encoding' related.
    public readonly encoding?: string;

    constructor(json: any) {
      this.url = json?._attributes["xlink:href"];
      this.constraintName = (json ? json["ows:Constraint"]?._attributes?.name : undefined);
      if (this.constraintName?.endsWith("Encoding"))
        this.encoding = json["ows:Constraint"]?.["ows:AllowedValues"]?.["ows:Value"]?._text;
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

      const dcpHttp = (json ? json["ows:DCP"]?.["ows:HTTP"] : undefined);
      if (!dcpHttp)
        return;

      const get = dcpHttp["ows:Get"];
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

      const post = dcpHttp["ows:Post"];
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

  export class Layer {
    public readonly identifier: string;
    public readonly title?: string;
    public readonly abstract?: string;
    public readonly format?: string;

    constructor(json: any) {
      this.identifier = json["ows:Identifier"]?._text;
      this.title = json["ows:Title"]?._text;
      this.format = json.Format?._text;
    }
  }
}

/** @internal */
export class WmtsCapabilities {
  private static _capabilitiesCache = new Map<string, WmtsCapabilities | undefined>();

  public get json() { return this._json; }

  public readonly version?: string;
  public readonly serviceIdentification?: WmtsCapability.ServiceIdentification;
  public readonly layers: WmtsCapability.Layer[] = [];
  public readonly operationsMetadata?: WmtsCapability.OperationMetadata;

  constructor(private _json: any) {
    this.version = _json?.Capabilities?._attributes.version;

    if (_json?.Capabilities?.["ows:OperationsMetadata"])
      this.operationsMetadata = new WmtsCapability.OperationMetadata(_json?.Capabilities?.["ows:OperationsMetadata"]);

    const jsonLayer = _json.Capabilities?.Contents?.Layer;
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

