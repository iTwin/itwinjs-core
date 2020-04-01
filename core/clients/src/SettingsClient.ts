/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */
import { request, RequestOptions, Response } from "./Request";
import { Client } from "./Client";
import { SettingsAdmin, SettingsStatus, SettingsResult, SettingsMapResult } from "./SettingsAdmin";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "./AuthorizedClientRequestContext";

// this internal class is used to collect the settings when we are asking for them by namespace, because in that case there is a continuationToken when
// there are more than 20, so we have to continue to call the Setting Service to get more.
type resolveFunc = ((arg: SettingsMapResult) => void);
type rejectFunc = ((arg: Error) => void);
class SettingsFromNamespaceCollector {
  private _resolve: resolveFunc | undefined;
  private _settingsMap: Map<string, any>;
  constructor(private _settingsClient: ConnectSettingsClient, private _requestContext: AuthorizedClientRequestContext, private _options: RequestOptions, private _url: string) {
    this._settingsMap = new Map<string, any>();
  }

  public async executor(resolve: resolveFunc, _reject: rejectFunc) {
    // NOTE: we always resolve with an answer, never reject.
    this._resolve = resolve;

    while (true) {
      try {
        // attempt to get the settings
        const response: Response = await request(this._requestContext, this._url, this._options);
        // body contains an array of settings.
        for (const settingBody of response.body) {
          this._settingsMap.set(settingBody.name, settingBody.properties);
        }
        if (response.header.continuationtoken) {
          this._options.headers.continuationtoken = response.header.continuationtoken;
        } else {
          this._resolve(new SettingsMapResult(SettingsStatus.Success, undefined, this._settingsMap));
          break;
        }
      } catch (errResponse) {
        if ((errResponse.status < 200) || (errResponse.status > 299))
          return this._resolve(this._settingsClient.formErrorResponse(errResponse));
        else
          return this._resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(errResponse)));
      }
    }
  }
}

/**
 * Client API for the CONNECT ProductSettingsService - implements the SettingsAdmin interface when settings are stored by CONNECT.
 * This class is not accessed directly from applications, they should use IModelApp.SettingsAdmin.
 * @internal
 */
export class ConnectSettingsClient extends Client implements SettingsAdmin {
  public static readonly searchKey: string = "ProductSettingsService.RP";
  /**
   * Creates an instance of ConnectSettingsClient.
   */
  public constructor(public applicationId: string) { super(); }

  protected getUrlSearchKey(): string { return ConnectSettingsClient.searchKey; }

  // gets the portion of the Url that encapsulates the type of setting requested.
  private getUrlOptions(forRead: boolean, settingNamespace: string | undefined, settingName: string | undefined, userSpecific: boolean, applicationSpecific: boolean, shared: boolean, projectId?: string, iModelId?: string) {
    // The types of settings are:
    // Application, Project, iModel, and User specific.
    // Application, Project, and User Specific
    // Application and User Specific
    // Project, iModel, and User specific
    // Project and User Specific
    // Application Specific
    let urlTerminator: string;
    if (userSpecific) {
      urlTerminator = "/User/Setting";
    } else {
      if (shared)
        urlTerminator = "/SharedSetting";
      else
        urlTerminator = "/Setting";
    }
    // set up the settingsNamespace and settingName if appropriate.
    // Note: In the read case, we use a query rather than the URL including the namespace and setting because the Settings service returns an empty array rather than a 404 status in that case.
    //       We are avoiding the 404 status because it gets logged in various places.
    if (settingNamespace && settingName)
      urlTerminator = forRead ? urlTerminator.concat(`?$filter=namespace+eq+'${settingNamespace}'+and+name+eq+'${settingName}'`) : urlTerminator.concat(`/${settingNamespace}/${settingName}`);
    else if (settingNamespace)
      urlTerminator = forRead ? urlTerminator.concat(`?$filter=namespace+eq+'${settingNamespace}'`) : urlTerminator.concat(`/${settingNamespace}`);

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
  /** @internal */
  public formErrorResponse(response: Response): SettingsResult {
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
  private async saveAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    requestContext.enter();
    const baseUrl: string = await this.getUrl(requestContext);
    requestContext.enter();
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "PUT",
      headers: { authorization: accessTokenString },
      body: {
        properties: settings,
      },
    };
    await this.setupOptionDefaults(options);
    requestContext.enter();

    const urlOptions: string = this.getUrlOptions(false, settingNamespace, settingName, userSpecific, applicationSpecific, shared, projectId, iModelId);
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
  private async getAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(true, settingNamespace, settingName, userSpecific, applicationSpecific, shared, projectId, iModelId);
    const url: string = baseUrl.concat(urlOptions);

    return request(requestContext, url, options).then(async (response: Response): Promise<SettingsResult> => {
      // should get back an array. It should have either one item or be empty.
      if (Array.isArray(response.body) && (response.body.length > 0))
        return Promise.resolve(new SettingsResult(SettingsStatus.Success, undefined, response.body[0].properties));
      return Promise.resolve(new SettingsResult(SettingsStatus.SettingNotFound));
    }, async (response: Response): Promise<SettingsResult> => {
      if ((response.status < 200) || (response.status > 299))
        return Promise.resolve(this.formErrorResponse(response));
      return Promise.resolve(new SettingsResult(SettingsStatus.UnknownError, "Unexpected Status " + JSON.stringify(response)));
    });
  }

  // Retrieves all saved settings with the same namespace.
  private async getAnySettingsByNamespace(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, applicationSpecific: boolean, shared: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(true, undefined, undefined, userSpecific, applicationSpecific, shared, projectId, iModelId);
    let url: string = baseUrl.concat(urlOptions);

    // now we want to append the query for the namespace.
    const queryString = `?$filter=namespace+eq+'${settingNamespace}'`;
    url = url.concat(queryString);

    const collector = new SettingsFromNamespaceCollector(this, requestContext, options, url);
    return new Promise(collector.executor.bind(collector));
  }

  private async deleteAnySetting(requestContext: AuthorizedClientRequestContext, userSpecific: boolean, settingNamespace: string, settingName: string, applicationSpecific: boolean, shared: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    const baseUrl: string = await this.getUrl(requestContext);
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "DELETE",
      headers: { authorization: accessTokenString },

    };
    await this.setupOptionDefaults(options);

    const urlOptions: string = this.getUrlOptions(false, settingNamespace, settingName, userSpecific, applicationSpecific, shared, projectId, iModelId);
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
    return this.saveAnySetting(requestContext, true, settings, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async getUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(requestContext, true, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async deleteUserSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(requestContext, true, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async getUserSettingsByNamespace(requestContext: AuthorizedClientRequestContext, namespace: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(requestContext, true, namespace, applicationSpecific, false, projectId, iModelId);
  }

  public async saveSharedSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(requestContext, false, settings, settingNamespace, settingName, applicationSpecific, true, projectId, iModelId);
  }

  public async getSharedSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, true, projectId, iModelId);
  }

  public async deleteSharedSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, true, projectId, iModelId);
  }

  public async getSharedSettingsByNamespace(requestContext: AuthorizedClientRequestContext, namespace: string, applicationSpecific: boolean, projectId: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(requestContext, false, namespace, applicationSpecific, true, projectId, iModelId);
  }

  public async saveSetting(requestContext: AuthorizedClientRequestContext, settings: any, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.saveAnySetting(requestContext, false, settings, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async getSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.getAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async deleteSetting(requestContext: AuthorizedClientRequestContext, settingNamespace: string, settingName: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsResult> {
    return this.deleteAnySetting(requestContext, false, settingNamespace, settingName, applicationSpecific, false, projectId, iModelId);
  }

  public async getSettingsByNamespace(requestContext: AuthorizedClientRequestContext, namespace: string, applicationSpecific: boolean, projectId?: string, iModelId?: string): Promise<SettingsMapResult> {
    return this.getAnySettingsByNamespace(requestContext, false, namespace, applicationSpecific, false, projectId, iModelId);
  }

}
