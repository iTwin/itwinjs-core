/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @internal */
export class ArcGisUrl {

  // Extract the sub-url up to '/rest/'
  public static extractRestBaseUrl(url: URL): URL | undefined {
    const urlStr = url.toString();
    const searchStr = "/rest/";
    const restPos = urlStr.indexOf(searchStr);
    return (restPos === -1 ? undefined : new URL(urlStr.substring(0, restPos + searchStr.length)));

  }

  public static async getRestUrlFromGenerateTokenUrl(url: URL): Promise<URL | undefined> {
    const restUrl = ArcGisUrl.extractRestBaseUrl(url);
    if (restUrl === undefined) {
      return undefined;
    }

    // First attempt: derive the Oauth2 token URL from the 'tokenServicesUrl', exposed by the 'info request'
    const infoUrl = new URL(`${restUrl.toString()}info`);
    infoUrl.searchParams.append("f", "json");

    let json;
    try {
      json = await ArcGisUrl.fetchJson(infoUrl);
    } catch {

    }

    const tokenServicesUrl = json?.authInfo?.tokenServicesUrl;
    if (tokenServicesUrl === undefined) {
      return undefined;
    }
    return ArcGisUrl.extractRestBaseUrl(new URL(tokenServicesUrl));
  }

  private static async fetchJson(url: URL): Promise<any> {
    let json;
    try {
      const response = await fetch(url.toString(), { method: "GET" });
      json = await response.json();
    } catch {
    }
    return json;
  }
}
