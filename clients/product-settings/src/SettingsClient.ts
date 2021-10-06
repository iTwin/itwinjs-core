/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Settings
 */
import { AccessToken, BentleyError, BentleyStatus } from "@itwin/core-bentley";
import { Client, request, RequestOptions, Response } from "@bentley/itwin-client";
import { SettingsAdmin, SettingsMapResult, SettingsResult, SettingsStatus } from "./SettingsAdmin";

/** Client API for the iTwin Product Settings Service
 *
 * This class is not accessed directly from applications, they should use IModelApp.settingsAdmin.
 *
 * Requires the OIDC Scope `product-setting-service`
 *
 * @internal
 */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  public static readonly apiVersion: string = "v1.0";

  /** Creates an instance of ConnectSettingsClient.
   */
  public constructor(public applicationId: string) {
    super();
    this.baseUrl = "https://api.bentley.com/productsettings";
  }

  protected override async setupOptionDefaults(options: RequestOptions): Promise<void> {
    await super.setupOptionDefaults(options);
  }

  /** Gets the URL of the service.
   * Attempts to discover and cache the URL from the URL Discovery Service. If not
   * found uses the default URL provided by client implementations. Note that for consistency
   * sake, the URL is stripped of any trailing "/"
   * @param excludeApiVersion Pass true to optionally exclude the API version from the URL.
   * @returns URL for the service
   */
  public override async getUrl(excludeApiVersion?: boolean): Promise<string> {
    if (this._url)
      return this._url;

    const url = await super.getUrl();
    this._url = url;
    if (!excludeApiVersion)
      this._url = `${this._url}/${ConnectSettingsClient.apiVersion}`;

    return this._url;
  }

  // gets the portion of the Url that encapsulates the type of setting requested.
  private getUrlOptions(forRead: boolean, settingNamespace: string | undefined, settingName: string | undefined, userSpecific: boolean, applicationSpecific: boolean, shared: boolean, iTwinId?: string, iModelId?: string) {

    //  /Context/{ContextId}/Settings
    //  /Context/{ContextId}/SharedSettings
    //  /Context/{ContextId}/User/Settings
    //  /Context/{ContextId}/iModel/{iModelId}/Settings
    //  /Context/{ContextId}/iModel/{iModelId}/SharedSettings
    //  /Context/{ContextId}/iModel/{iModelId}/User/Settings

    //  /Application/{AppId}/Org/Settings
    //  /Application/{AppId}/User/Settings
    //  /Application/{AppId}/Context/{ContextId}/Settings
    //  /Application/{AppId}/Context/{ContextId}/SharedSettings
    //  /Application/{AppId}/Context/{ContextId}/User/Settings
    //  /Application/{AppId}/Context/{ContextId}/iModel/{iModelId}/Settings
    //  /Application/{AppId}/Context/{ContextId}/iModel/{iModelId}/SharedSettings
    //  /Application/{AppId}/Context/{ContextId}/iModel/{iModelId}/User/Settings

    // The types of settings are:
    // Application, iTwin, iModel, and User specific.
    // Application, iTwin, and User Specific
    // Application and User Specific
    // iTwin, iModel, and User specific
    // iTwin and User Specific
    // Application Specific
    let urlTerminator: string;
    if (userSpecific)
      urlTerminator = "/User/Setting";
    else if (shared)
      urlTerminator = "/SharedSetting";
    else
      urlTerminator = "/Setting";

    // CHANGE:
    //  - If you supply a context, do not require a user
    //  - If no context, default to user

    // Set up the settingsNamespace and settingName if appropriate.
    // Note: In the read case, we use a query rather than the URL including the namespace and setting because the Settings service returns an empty array rather than a 404 status in that case.
    //       We are avoiding the 404 status because it gets logged in various places.
    if (settingNamespace && settingName)
      urlTerminator = forRead ? urlTerminator.concat(`?$filter=namespace+eq+'${settingNamespace}'+and+name+eq+'${settingName}'`) : urlTerminator.concat(`/${settingNamespace}/${settingName}`);
    else if (settingNamespace)
      urlTerminator = forRead ? urlTerminator.concat(`?$filter=namespace+eq+'${settingNamespace}'`) : urlTerminator.concat(`/${settingNamespace}`);

    let urlOptions: string;
    if (applicationSpecific) {
      if (iTwinId) {
        if (iModelId) {
          urlOptions = `/Application/${this.applicationId}/Context/${iTwinId}/iModel/${iModelId}${urlTerminator}`;
        } else {
          urlOptions = `/Application/${this.applicationId}/Context/${iTwinId}${urlTerminator}`;
        }
      } else {
        if (userSpecific)
          urlOptions = `/Application/${this.applicationId}${urlTerminator}`;
        else
          urlOptions = `/Application/${this.applicationId}/Org/${urlTerminator}`;
      }
    } else {
      if (iTwinId) {
        if (iModelId) {
          urlOptions = `/Context/${iTwinId}/iModel/${iModelId}${urlTerminator}`;
        } else {
          urlOptions = `/Context/${iTwinId}${urlTerminator}`;
        }
      } else {
        // settings must depend on at least one of Application and iTwin
        throw new BentleyError(BentleyStatus.ERROR, "Improperly specified setting");
      }
    }
    return urlOptions;
  }

  /** Forms the response when there is an error.
   * @internal
   */
  public formErrorResponse(response: Response): SettingsResult {
    if (400 === response.status) {
      return new SettingsResult(SettingsStatus.ITwinInvalid, `Malformed URL or invalid iTwin ${JSON.stringify(response)}`);
    } else if (401 === response.status) {
      return new SettingsResult(SettingsStatus.AuthorizationError, `Authorization failure ${JSON.stringify(response)}`);
    } else if (404 === response.status) {
      return new SettingsResult(SettingsStatus.SettingNotFound);
    } else {
      return new SettingsResult(SettingsStatus.ServerError, `Status indicates server error ${JSON.stringify(response)}`);
    }
  }

  // Private function that can retrieve either user specific settings or non-user-specific settings
  private async saveAnySetting(accessToken: AccessToken, userSpecific: boolean, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();

    const options: RequestOptions = {
      method: "PUT",
      headers: { authorization: accessToken },
      body: {
        properties: settings,
      },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(false, settingNamespace, settingName, userSpecific, applicationSpecific, shared, iTwinId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    try {
      await request(url, options);
      return new SettingsResult(SettingsStatus.Success);
    } catch (response: any) {
      if ((response.status < 200) || (response.status > 299))
        return this.formErrorResponse(response);
      return new SettingsResult(SettingsStatus.UnknownError, `Unexpected Status ${JSON.stringify(response)}`);
    }
  }

  // Retrieves previously saved user settings
  private async getAnySetting(accessToken: AccessToken, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessToken },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(true, settingNamespace, settingName, userSpecific, applicationSpecific, shared, iTwinId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    try {
      const response = await request(url, options);
      // should get back an array. It should have either one item or be empty.
      if (Array.isArray(response.body) && (response.body.length > 0))
        return new SettingsResult(SettingsStatus.Success, undefined, response.body[0].properties);
      return new SettingsResult(SettingsStatus.SettingNotFound);
    } catch (response: any) {
      if ((response.status < 200) || (response.status > 299))
        return this.formErrorResponse(response);
      return new SettingsResult(SettingsStatus.UnknownError, `Unexpected Status ${JSON.stringify(response)}`);
    }
  }

  // Retrieves all saved settings with the same namespace.
  private async getAnySettingsByNamespace(accessToken: AccessToken, userSpecific: boolean, settingNamespace: string, applicationSpecific: boolean, shared: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsMapResult> {
    const baseUrl: string = await this.getUrl();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessToken },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(true, undefined, undefined, userSpecific, applicationSpecific, shared, iTwinId, iModelId);
    let url: string = baseUrl.concat(urlOptions);

    // now we want to append the query for the namespace.
    const queryString = `?$filter=namespace+eq+'${settingNamespace}'`;
    url = url.concat(queryString);

    const settingsMap: Map<string, any> = new Map<string, any>();
    while (true) {
      try {
        // attempt to get the settings
        const response: Response = await request(url, options);
        // body contains an array of settings.
        for (const settingBody of response.body) {
          settingsMap.set(settingBody.name, settingBody.properties);
        }

        // The absence of a continuation token indicates that there are no more settings to gather
        // However, adding check anyway
        if (undefined === response.header.continuationtoken || 0 === response.body.length)
          break;

        // Update the continuation token for the next iteration
        options.headers.continuationtoken = response.header.continuationtoken;
      } catch (errResponse: any) {
        if ((errResponse.status < 200) || (errResponse.status > 299))
          return this.formErrorResponse(errResponse);
        else
          return new SettingsResult(SettingsStatus.UnknownError, `Unexpected Status ${JSON.stringify(errResponse)}`);
      }
    }

    return new SettingsMapResult(SettingsStatus.Success, undefined, settingsMap);
  }

  private async deleteAnySetting(accessToken: AccessToken, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessToken },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(false, settingNamespace, settingName, userSpecific, applicationSpecific, shared, iTwinId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    try {
      await request(url, options);
      return new SettingsResult(SettingsStatus.Success);
    } catch (response: any) {
      if ((response.status < 200) || (response.status > 299))
        return this.formErrorResponse(response);
      else
        return new SettingsResult(SettingsStatus.UnknownError, `Unexpected Status ${JSON.stringify(response)}`);
    }
  }
  // app specific, no context, no shared, no user
  public async saveUserSetting(accessToken: AccessToken, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(accessToken, true, settings, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async getUserSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(accessToken, true, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async deleteUserSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(accessToken, true, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async getUserSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(accessToken, true, namespace, applicationSpecific, false, iTwinId, iModelId);
  }

  public async saveSharedSetting(accessToken: AccessToken, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(accessToken, false, settings, settingNamespace, settingName, applicationSpecific, true, iTwinId, iModelId);
  }

  public async getSharedSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(accessToken, false, settingNamespace, settingName, applicationSpecific, true, iTwinId, iModelId);
  }

  public async deleteSharedSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(accessToken, false, settingNamespace, settingName, applicationSpecific, true, iTwinId, iModelId);
  }

  public async getSharedSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(accessToken, false, namespace, applicationSpecific, true, iTwinId, iModelId);
  }

  public async saveSetting(accessToken: AccessToken, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(accessToken, false, settings, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async getSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(accessToken, false, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async deleteSetting(accessToken: AccessToken, settingNamespace: string, settingName: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(accessToken, false, settingNamespace, settingName, applicationSpecific, false, iTwinId, iModelId);
  }

  public async getSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(accessToken, false, namespace, applicationSpecific, false, iTwinId, iModelId);
  }
}
