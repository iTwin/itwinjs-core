/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, IModelRepository, UserProfile } from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { SimpleViewState } from "./SimpleViewState";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import { OpenMode, assert } from "@bentley/bentleyjs-core";
import { ProjectAbstraction } from "./ProjectAbstraction";
import { showStatus } from "./Utils";

// A connection to a non-Connect-hosted project and iModel
export class NonConnectProject extends ProjectAbstraction {

  // Set up to access the iModel using iModelBank
  public async loginAndOpenImodel(state: SimpleViewState): Promise<void> {
    // This is where the app's frontend must be written to work with the
    // surrounding project, user, and deployment infrastructure.

    // *** SOLUTION TODO - ask the user mgr to authenticate the user and obtain an AccessToken.
    const userProfile = new UserProfile("first", "last", "email@organization.org", "userid", "organization", "organizationId", "ultimateSite", "usageCountryIso");
    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
    state.accessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper));

    // *** SOLUTION TODO - ask the project mgr to let the user choose an iModel.
    const iModelId = "233e1f55-561d-42a4-8e80-d6f91743863e";

    // *** SOLUTION TODO - ask the deployment infrastructure for the iModelBank to use for this iModel
    const iminfo = await this.getIModelbankFor(iModelId);
    assert(iminfo.iModelId === iModelId);

    // Now that we know what iModelBank to use, we can set up IModelApp to work with it.

    // Tell IModelApp to use this IModelBank client
    IModelApp.iModelClient = new IModelBankClient(iminfo.url, iminfo.hubDeploymentEnv, undefined);

    // Open the iModel
    state.iModel = { wsgId: iminfo.iModelId, ecId: iminfo.iModelId } as IModelRepository;
    state.project = { wsgId: "", ecId: "", name: iminfo.name };
    showStatus("opening iModel", state.project.name);
    state.iModelConnection = await IModelConnection.open(state.accessToken!, "", iminfo.iModelId, OpenMode.Readonly);
  }

  // Simulates how an app frontend might call out to some kind of deployment
  // infrastructure to ask for the imodelbank to use for a specified iModel.
  // In this demo, this method just gets a static resource that is keyed
  // to the iModelId from the Web server.
  private getIModelbankFor(iModelId: string): Promise<any> {
    return new Promise((resolve, _reject) => {
      const request: XMLHttpRequest = new XMLHttpRequest();
      request.open("GET", `imodelbank-${iModelId}.json`, false);
      request.setRequestHeader("Cache-Control", "no-cache");
      request.onreadystatechange = ((_event: Event) => {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            resolve(JSON.parse(request.responseText));
          }
        }
      });
      request.send();
    });
  }
}
