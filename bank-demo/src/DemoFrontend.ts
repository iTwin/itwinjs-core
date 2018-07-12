/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken, IModelAccessContext } from "@bentley/imodeljs-clients";
import { NonBentleyProject } from "./NonBentleyProject";
import { BentleyCloudProject } from "./BentleyCloudProject";

export class DemoFrontend {
  public useIModelHub: boolean;
  public projectId: string;        // This is used only as a namespace to help the iModel server identify the iModel.
  public accessToken!: AccessToken; // This is an opaque piece of data that the iModel server passes back to the validator, when it needs to check permissions

  constructor(hub: boolean) {
    this.useIModelHub = hub;
    this.projectId = "";
  }

  // Simulate user login and choosing an iModel from some project.
  public async login() {
    if (this.useIModelHub) {
      this.accessToken = await BentleyCloudProject.getAccessToken("Regular.IModelJsTestUser@mailinator.com", "Regular@iMJs");
      this.projectId = await BentleyCloudProject.queryProjectIdByName(this.accessToken, "iModelJsTest"); // simulate using picking a Connect project
    } else {
      // iModelBank
      this.accessToken = NonBentleyProject.getAccessToken(); // WIP work with non-Bentley project/user mgmt system ...
      this.projectId = ""; // projectId is meaningless to iModelBank.
    }
  }

  // Pretend the user picks an iModel from the project
  public async chooseIModel() {
    // tslint:disable-next-line:no-var-requires
    const iModelInfo = require("../assets/imodel.json");
    return iModelInfo.wsgId;
  }

  public async getIModelAccessContext(iModelId: string): Promise<IModelAccessContext> {
    if (this.useIModelHub)
      return BentleyCloudProject.getIModelAccessContext(iModelId, this.projectId);

    return NonBentleyProject.getIModelAccessContext(iModelId, this.projectId);
  }
}
