import { AccessToken } from "@itwin/core-bentley";

import { request, RequestOptions } from "../../request/Request";
import { ExtensionProps, extensionPropsFromJSON } from "./ExtensionProvider";

/**
 * Client for querying, publishing and deleting iModel.js Extensions.
 *
 * The `imodel-extension-service-api` OIDC scope is required for all operations and the `imodel-extension-service:modify` is
 * required for modification operations (modify, publish, and deleting).
 * @alpha
 */
export class ExtensionClient {
  private readonly _baseUrl: string;
  public constructor() {
    this._baseUrl = "https://api.bentley.com/iModelExtensionService/";
  }

  public get baseUrl(): string {
    const prefix = process.env.IMJS_URL_PREFIX;
    const baseUrl = new URL(this._baseUrl);
    if (prefix)
      baseUrl.hostname = prefix + new URL(baseUrl).hostname;

    if (!baseUrl.pathname.endsWith("/"))
      baseUrl.pathname += "/";

    baseUrl.pathname += "v1.0/";
    return baseUrl.toString();
  }

  private parseExtensionPropsArray(json: any): ExtensionProps[] {
    if (!(json instanceof Array))
      return [];

    const ret: ExtensionProps[] = [];
    json.forEach((extensionJson) => {
      const extension = extensionPropsFromJSON(extensionJson);
      if (extension !== undefined)
        ret.push(extension);
    });

    return ret;
  }

  /**
   * Gets information on extensions. If extensionName is undefined, will return all extensions in the context.
   * If it's defined, will return all versions of that extension.
   * @param contextId Context Id
   * @param extensionName Extension name (optional)
   */
  public async getExtensions(accessToken: AccessToken, contextId: string, extensionName?: string): Promise<ExtensionProps[]> {
    const options: RequestOptions = { method: "GET" };
    options.headers = { authorization: accessToken };
    const urlBase = this.baseUrl;
    const response = await request(`${urlBase}${contextId}/IModelExtension/${extensionName ?? ""}`, options);
    if (response.status !== 200)
      throw new Error(`Server returned status: ${response.status}, message: ${response.body.message}`);

    if (!(response.body instanceof Array) || response.body.length < 1)
      return [];

    return this.parseExtensionPropsArray(response.body);
  }

  /**
   * Gets information about an extension's specific version
   * @param contextId Context Id
   * @param extensionName Extension name
   * @param version Extension version
   */
  public async getExtensionProps(accessToken: AccessToken, contextId: string, extensionName: string, version: string): Promise<ExtensionProps | undefined> {

    const options: RequestOptions = { method: "GET" };
    options.headers = { authorization: accessToken };
    const urlBase = this.baseUrl;
    const response = await request(`${urlBase}${contextId}/IModelExtension/${extensionName}/${version}`, options);
    if (response.status !== 200)
      throw new Error(`Server returned status: ${response.status}, message: ${response.body.message}`);

    if (!(response.body instanceof Array) || response.body.length < 1)
      return undefined;
    if (response.body.length > 1)
      throw new Error("Server returned too many extensions");

    return extensionPropsFromJSON(response.body[0]);
  }
}
