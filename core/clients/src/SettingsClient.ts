/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Settings */

import { request, RequestOptions, Response } from "./Request";
import { Client, DeploymentEnv, UrlDescriptor } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { SettingsAdmin, SettingsStatus, SettingsResult } from "./SettingsAdmin";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import { ImsDelegationSecureTokenClient } from "./ImsClients";

/** Client API for the CONNECT ProductSettingsService - implements the SettingsAdmin interface when settings are stored to CONNECT. */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  private _authToken?: AuthorizationToken;
  private _accessToken?: AccessToken;
  public static readonly searchKey: string = "ProductSettingsService.RP";
  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-productsettingsservice.bentley.com",
    QA: "https://qa-connect-productsettingsservice.bentley.com",
    PROD: "https://connect-productsettingsservice.bentley.com",
    PERF: "https://qa-connect-productsettingsservice.bentley.com",
  };

  /**
   * Creates an instance of ConnectSettingsClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv, public applicationId: string) {
    super(deploymentEnv);
  }

  private async getAccessToken(authToken: AuthorizationToken): Promise<AccessToken> {
    const baseUrl: string = await this.getUrl();

    if ((this._authToken === authToken) && (this._accessToken))
      return this._accessToken;

    this._accessToken = undefined;
    this._authToken = authToken;
    const imsClient = new ImsDelegationSecureTokenClient(this.deploymentEnv);
    this._accessToken = await imsClient.getToken(this._authToken, baseUrl);
    return this._accessToken;
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return ConnectSettingsClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return ConnectSettingsClient._defaultUrlDescriptor[this.deploymentEnv];
  }

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
  private async saveAnySetting(userSpecific: boolean, settings: any, settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
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

    return request(url, options).then((_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Retrieves previously saved user settings
  private async getAnySetting(userSpecific: boolean, settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(url, options).then((response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success, undefined, response.body.properties));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  private async deleteAnySetting(userSpecific: boolean, settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessTokenString },

    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(settingNamespace, settingName, userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(url, options).then((_response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Saves user settings
  public async saveUserSetting(settings: any, settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(true, settings, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }

  public async getUserSetting(settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(true, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteUserSetting(settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(true, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }

  public async saveSetting(settings: any, settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(false, settings, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }

  public async getSetting(settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(false, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteSetting(settingNamespace: string, settingName: string, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(false, settingNamespace, settingName, authToken, applicationSpecific, projectId, iModelId);
  }
}
