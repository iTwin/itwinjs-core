/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Settings */

import { request, RequestOptions, Response } from "./Request";
import { Client } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { SettingsAdmin, SettingsStatus, SettingsResult } from "./SettingsAdmin";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import { ImsDelegationSecureTokenClient } from "./ImsClients";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** Client API for the CONNECT ProductSettingsService - implements the SettingsAdmin interface when settings are stored by CONNECT. */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  public static readonly searchKey: string = "ProductSettingsService.RP";
  /**
   * Creates an instance of ConnectSettingsClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public applicationId: string) { super(); }

  /** Convenience method to get access token from a SAML authorization token.
   * @param alctx Activity logging context
   * @param authSamlToken Authorization SAML token (e.g. as obtained from ImsFederatedAuthenticationClient)
   * @returns SAML access token
   */
  public async getAccessToken(alctx: ActivityLoggingContext, authSamlToken: AuthorizationToken): Promise<AccessToken> {
    const baseUrl: string = await this.getUrl(alctx);

    const imsClient = new ImsDelegationSecureTokenClient();
    return await imsClient.getToken(alctx, authSamlToken, baseUrl);
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string { return ConnectSettingsClient.searchKey; }

  // gets the portion of the Url that encapsulates the type of setting requested.
  private getUrlOptions(settingNamespace: string, settingName: string, userSpecific: boolean, applicationSpecific: boolean, projectId?: string, iModelId?: string) {
    // The types of settings are:
    // Application, Project, iModel, and User specific.
    // Application, Project, and User Specific
    // Application and User Specific
    // Project, iModel, and User specific
    // Project and User Specific
    // Application Specific
    let urlTerminator: string;
    if (userSpecific)
      urlTerminator = `/User/Setting/${settingNamespace}/${settingName}`;
    else
      urlTerminator = `/Setting/${settingNamespace}/${settingName}`;

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
  private async saveAnySetting(alctx: ActivityLoggingContext, userSpecific: boolean, settings: any, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(alctx);
    const accessTokenString: string | undefined = accessToken.toTokenString();

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

    return request(alctx, url, options).then((_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Retrieves previously saved user settings
  private async getAnySetting(alctx: ActivityLoggingContext, userSpecific: boolean, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(alctx);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(alctx, url, options).then((response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success, undefined, response.body.properties));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  private async deleteAnySetting(alctx: ActivityLoggingContext, userSpecific: boolean, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(alctx);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessTokenString },

    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(alctx, url, options).then((_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Saves user settings
  public async saveUserSetting(alctx: ActivityLoggingContext, settings: any, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(alctx, true, settings, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }

  public async getUserSetting(alctx: ActivityLoggingContext, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(alctx, true, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteUserSetting(alctx: ActivityLoggingContext, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(alctx, true, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }

  public async saveSetting(alctx: ActivityLoggingContext, settings: any, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(alctx, false, settings, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }

  public async getSetting(alctx: ActivityLoggingContext, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(alctx, false, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteSetting(alctx: ActivityLoggingContext, settingNamespace: string, settingName: string, accessToken: AccessToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(alctx, false, settingNamespace, settingName, accessToken, applicationSpecific, projectId, iModelId);
  }
}
