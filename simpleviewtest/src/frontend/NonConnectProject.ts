/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, IModelRepository, UserProfile, IModelBankAccessContext } from "@bentley/imodeljs-clients";
import { SimpleViewState } from "./SimpleViewState";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { OpenMode } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { ProjectAbstraction } from "./ProjectAbstraction";
import { showStatus } from "./Utils";

// A connection to a non-Connect-hosted project and iModel
export class NonConnectProject extends ProjectAbstraction {
  private _cfg: any | undefined;

  // Retrieves the configuration for Connect-related settings from connect-configuration.json file located in the built public folder
  private retrieveConfiguration(): Promise<void> {
    return new Promise((resolve, _reject) => {
      const request: XMLHttpRequest = new XMLHttpRequest();
      request.open("GET", "non-connect-configuration.json", false);
      request.setRequestHeader("Cache-Control", "no-cache");
      request.onreadystatechange = ((_event: Event) => {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            this._cfg = JSON.parse(request.responseText);
            resolve();
          }
          // Everything is good, the response was received.
        } else {
          // Not ready yet.
        }
      });
      request.send();
    });
  }

  // Set up to access the iModel using iModelBank
  public async loginAndOpenImodel(state: SimpleViewState): Promise<void> {
    await this.retrieveConfiguration();
    if (this._cfg === undefined)
      throw new Error("retrieveConfiguration failed for non-Connect case");

    const cfg = this._cfg;

    // *** Somehow authenticate the user and obtain an AccessToken.
    // For this demo, I read the user profile from a config file, and then create a "foreign" AccessToken around it.
    const uprof = cfg.userProfile;
    const userProfile = new UserProfile(uprof.firstName, uprof.lastName, uprof.email, uprof.userid, uprof.organization);
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
    state.accessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper));

    // *** Somehow choose an iModel. Somehow get the corresponding iModelId.
    // For this demo, I read the iModelId from a config file.
    const iminfo = cfg.imodelBank;

    // Tell IModelApp to use an IModelBank client, rather than using the default iModelHub client.
    const imbcontext = new IModelBankAccessContext(iminfo.iModelId, iminfo.url, IModelApp.hubDeploymentEnv);
    IModelApp.iModelClient = imbcontext.client!;

    // Open the iModel
    state.iModel = { wsgId: iminfo.iModelId, ecId: iminfo.iModelId } as IModelRepository;
    state.project = { wsgId: "", ecId: "", name: iminfo.name };
    showStatus("opening iModel", state.project.name);
    state.iModelConnection = await IModelConnection.open(state.accessToken!, imbcontext.toIModelTokenContextId(), iminfo.iModelId, OpenMode.Readonly);
  }
}
