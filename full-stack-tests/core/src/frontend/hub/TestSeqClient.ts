/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, Config } from "@bentley/bentleyjs-core";
import { request, RequestOptions, UrlDiscoveryClient } from "@bentley/itwin-client";

/**
 * Utility to query SEQ logs for testing purposes
 */
export class TestSeqClient {
  private static readonly _urlSearchKey: string = "Seq.Url";
  private _forUsageLogging?: boolean;
  private _url?: string;
  private _apiKey?: string;

  /** Constructor
   * @param forUsageLogging Pass true if querying for seq messages from the usage logging service
   */
  public constructor(forUsageLogging?: boolean) {
    this._forUsageLogging = forUsageLogging;
  }

  private async getUrl(requestContext: ClientRequestContext): Promise<string> {
    if (this._url)
      return this._url;

    if (this._forUsageLogging) {
      const resolvedRegion = Config.App.getNumber(UrlDiscoveryClient.configResolveUrlUsingRegion, 0);
      if (resolvedRegion === 0) {
        this._url = "https://ulasseq.bentley.com/api/events/";
        return this._url;
      }
    }

    this._url = await (new UrlDiscoveryClient()).discoverUrl(requestContext, TestSeqClient._urlSearchKey, undefined);
    return this._url;
  }

  private getApiKey(): string {
    if (this._apiKey)
      return this._apiKey;

    let apiKeyConfig: string;
    const resolvedRegion = Config.App.getNumber(UrlDiscoveryClient.configResolveUrlUsingRegion, 0);
    if (resolvedRegion === 102)
      apiKeyConfig = "imjs_qa_seq_api_key";
    else if (resolvedRegion === 0)
      apiKeyConfig = "imjs_prod_seq_api_key";
    else
      throw new Error(`Test requires ${UrlDiscoveryClient.configResolveUrlUsingRegion} to be setup to a valid value`);

    this._apiKey = Config.App.getString(apiKeyConfig);
    if (!this._apiKey)
      throw new Error(`Test requires config '${apiKeyConfig}' to be setup to a valid SEQ key`);
    return this._apiKey;
  }

  /**
   * Query for seq logs based on the supplied filter
   * @param filter
   * @param count
   */
  public async query(filter?: string, count?: number): Promise<any> {
    const apiKey = this.getApiKey();
    const options: RequestOptions = {
      method: "GET",
      headers: {
        "X-Seq-ApiKey": apiKey,
      },
      qs: {
        filter,
        count,
      },
    };

    const requestContext = new ClientRequestContext();
    const url = await this.getUrl(requestContext) + "/api/events/";
    const res = await request(requestContext, url, options);
    return res.body;
  }
}
