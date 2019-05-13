/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */
import { request, RequestOptions, Response } from "./Request";
import { Client } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { SettingsAdmin, SettingsStatus, SettingsResult, SettingsMapResult } from "./SettingsAdmin";
import { BentleyError, BentleyStatus, ClientRequestContext } from "@bentley/bentleyjs-core";
import { ImsDelegationSecureTokenClient } from "./ImsClients";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";

/**
 * Client API for the CONNECT ProductSettingsService - implements the SettingsAdmin interface when settings are stored by CONNECT.
 * This class is not accessed directly from applications, they should use IModelApp.SettingsAdmin.
 * @internal
 */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  public static readonly searchKey: string = "ProductSettingsService.RP";
  /**
   * Creates an instance of ConnectSettingsClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public applicationId: string) { super(); }

  /** Convenience method to get access token from a SAML authorization token.
   * @param requestContext The client request context.
   * @param authSamlToken Authorization SAML token (e.g. as obtained from ImsFederatedAuthenticationClient)
   * @returns SAML access token
   */
  public async getAccessToken(requestContext: ClientRequestContext, authSamlToken: AuthorizationToken): Promise<AccessToken> {
    const baseUrl: string = await this.getUrl(requestContext);

    const imsClient = new ImsDelegationSecureTokenClient();
    return imsClient.getToken(requestContext, authSamlToken, baseUrl);
  }

  protected getUrlSearchKey(): string { return ConnectSettingsClient.searchKey; }

  // gets the portion of the Url that encapsulates the type of setting requested.
  private getUrlOptions(settingNamespace: string | undefined, settingName: string | undefined, userSpecific: boolean, applicationSpecific: boolean, projectId?: string, iModelId?: string) {
    // The types of settings are:
    // Application, Project, iModel, and User specific.
    // Application, Project, and User Specific
    // Application and User Specific
    // Project, iModel, and User specific
    // Project and User Specific
    // Application Specific
    let urlTerminator: string;
    if (userSpecific)
      urlTerminator = "/User/Setting";
    else
      urlTerminator = "/Setting";

    // append the settingsNamespace and settingName if appropriate.
    if (settingNamespace)
      urlTerminator = urlTerminator.concat(`/${settingNamespace}`);
    if (settingName)
      urlTerminator = urlTerminator.concat(`/${settingName}`);

    let urlOptions: string;
    if (applicationSpecific) {
      if (projectId) {
        if (iModelId) {
          urlOptions = `/v1.0/Application/${this.applicationId}/Context/${projectId}/iModel/${iModelId}${urlTerminator}`;
        } else {
          urlOptions = `/v1.0/Application/${this.applicationId}/Context/${projectId}${urlTerminator}`;
        }
      } else {
        urlOptions = `/v1.0/Application/${this.applicationId}${urlTerminator}`;
      }
    } else {
      if (projectId) {
        if (iModelId) {
          urlOptions = `/v1.0/Context/${projectId}/iModel/${iModelId}${urlTerminator}`;
        } else {
          urlOptions = `/v1.0/Context/${projectId}${urlTerminator}`;
        }
      } else {
        // settings must depend on at least one of Application and Project
        throw new BentleyError(BentleyStatus.ERROR, "Improperly specified setting");
      }
    }
    return urlOptions;
  }

  // Forms the response when there is an error.
  private formErrorResponse(response: Response): SettingsResult {
    if (400 === response.status) {
      return new SettingsResult(SettingsStatus.ProjectInvalid, "Malformed URL or invalid Project " + JSON.stringify(response));
    } else if (401 === response.status) {
      return new SettingsResult(SettingsStatus.AuthorizationError, "Authorization failure " + JSON.stringify(response));
    } else if (404 === response.status) {
      return new SettingsResult(SettingsStatus.SettingNotFound);
    } else {
      return new SettingsResult(SettingsStatus.ServerError, "Status indicates server error " + JSON.stringify(response));
    }
  }

  // Private function that can retrieve either user specific settings or non-user-specific settings
  private async saveAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "PUT",
      headers: { authorization: accessTokenString },
      body: {
        properties: settings,
      },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(requestContext, url, options).then(async (_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, async (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Retrieves previously saved user settings
  private async getAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(requestContext, url, options).then(async (response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success, undefined, response.body.properties));
    }, async (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Retrieves all saved settings with the same namespace.
  private async getAnySettingsByNamespace(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(undefined, undefined, userSpecific, applicationSpecific, projectId, iModelId);
    let url: string = baseUrl.concat(urlOptions);

    // now we want to append the query for the namespace.
    const queryString = `?$filter=namespace+eq+'${settingNamespace}'`;
    url = url.concat(queryString);

    return request(requestContext, url, options).then(async (response: Response): Promise<SettingsResult> => {
      const settingsMap: Map<string, any> = new Map<string, any>();
      for (const settingBody of response.body) {
        settingsMap.set(settingBody.name, settingBody.properties);
      }
      return Promise.resolve(new SettingsMapResult(SettingsStatus.Success, undefined, settingsMap));
    }, async (response: Response): Promise<SettingsMapResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  private async deleteAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessTokenString },

    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(requestContext, url, options).then(async (_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, async (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  public async saveUserSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(requestContext, true, settings, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async getUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(requestContext, true, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async deleteUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(requestContext, true, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async saveSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(requestContext, false, settings, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async getSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async deleteSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, projectId, iModelId);
  }

  public async getSettingsByNamespace(requestContext: AuthorizedClientRequestContext, namespace: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(requestContext, false, namespace, applicationSpecific, projectId, iModelId);
  }

  public async getUserSettingsByNamespace(requestContext: AuthorizedClientRequestContext, namespace: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(requestContext, true, namespace, applicationSpecific, projectId, iModelId);
  }

}
