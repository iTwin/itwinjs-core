/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Settings */

import { request, RequestOptions, RequestQueryOptions, Response } from "./Request";
import { Client, DeploymentEnv, UrlDescriptor } from "./Client";
import { AuthorizationToken, AccessToken } from "./Token";
import { SettingsAdmin, SettingsStatus, SettingsResult } from "./SettingsAdmin";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core/lib/BentleyError";
import { ImsDelegationSecureTokenClient } from "./ImsClients";

/** Client API for the CONNECT ProductSettingsService - implements the SettingsAdmin interface when settings are stored to CONNECT. */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  private authToken?: AuthorizationToken;
  private accessToken?: AccessToken;
  public static readonly searchKey: string = "ProductSettingsService.RP";
  private static readonly defaultUrlDescriptor: UrlDescriptor = {
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

    if ((this.authToken === authToken) && (this.accessToken))
      return this.accessToken;

    this.accessToken = undefined;
    this.authToken = authToken;
    const imsClient = new ImsDelegationSecureTokenClient(this.deploymentEnv);
    this.accessToken = await imsClient.getToken(this.authToken, baseUrl);
    return this.accessToken;
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
    return ConnectSettingsClient.defaultUrlDescriptor[this.deploymentEnv];
  }

  // gets the portion of the Url that encapsulates the type of setting requested.
  private getUrlOptions(userSpecific: boolean, applicationSpecific: boolean, projectId?: string, iModelId?: string) {
    // The types of settings are:
    // Application, Project, iModel, and User specific.
    // Application, Project, and User Specific
    // Application and User Specific
    // Project, iModel, and User specific
    // Project and User Specific
    // Application Specific
    const urlTerminator: string = userSpecific ? "/User/Setting" : "/Setting";
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
  private async saveAllSettings(userSpecific: boolean, settings: any, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        type,
        version,
        bag: settings,
      },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(userSpecific, applicationSpecific, projectId, iModelId);
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
  private async getAllSettings(userSpecific: boolean, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const queryOptions: RequestQueryOptions = {
      $filter: `Type eq '${type}' and Version eq ${version}`,
    };

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
      qs: queryOptions,
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(userSpecific, applicationSpecific, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(url, options).then((response: Response): Promise<SettingsResult> => {
      return Promise.resolve(new SettingsResult(SettingsStatus.Success, undefined, response.body.bag));
    }, (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      else
        return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  private async deleteAllSettings(userSpecific: boolean, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl();
    const accessToken: AccessToken = await this.getAccessToken(authToken);
    const accessTokenString: string | undefined = accessToken.toTokenString();

    const queryOptions: RequestQueryOptions = {
      $filter: `Type eq '${type}' and Version eq ${version}`,
    };

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessTokenString },
      qs: queryOptions,

    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(userSpecific, applicationSpecific, projectId, iModelId);
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
  public async saveUserSetting(settings: any, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAllSettings(true, settings, type, version, authToken, applicationSpecific, projectId, iModelId);
  }

  public async getUserSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAllSettings(true, type, version, authToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteUserSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAllSettings(true, type, version, authToken, applicationSpecific, projectId, iModelId);
  }

  public async saveSetting(settings: any, type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAllSettings(false, settings, type, version, authToken, applicationSpecific, projectId, iModelId);
  }

  public async getSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAllSettings(false, type, version, authToken, applicationSpecific, projectId, iModelId);
  }

  public async deleteSetting(type: string, version: number, authToken: AuthorizationToken, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAllSettings(false, type, version, authToken, applicationSpecific, projectId, iModelId);
  }
}
