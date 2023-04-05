/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, assert, IModelStatus } from "@itwin/core-bentley";
import { Subject } from "@itwin/core-backend";
import { IModelError } from "@itwin/core-common";
import { ItemState } from "./Synchronizer";
import * as fs from "fs";
import * as path from "path";

enum ModelNames {
  Physical,
  Group,
  Definition
}

class TestConnectorSchema {
  public constructor() {

  }
  public static registerSchema(): void {

  }
}
class DocumentStatus {
  public elementProps: any;
  public constructor(){
    this.itemState = ItemState.Unchanged;
  }
  public itemState: ItemState;
}
class BaseConnector {
  public constructor() {
    this._data = "";
    this._sourceDataState = ItemState.Unchanged;
    this._sourceData = "";
    this._repositoryLinkId = "";
    this._documentStatus = {itemState : ItemState.Unchanged, elementProps: undefined};
  }
  protected _data: string;
  protected _sourceDataState: ItemState;
  protected _sourceData: string;
  protected _repositoryLinkId: string;
  protected _documentStatus: DocumentStatus;
  public synchronizer: any;
  public issueReporter: any;
  public jobSubject: any;

  protected createGroupModel(): void {
  }
  protected createPhysicalModel(): void {
  }
  protected createDefinitionModel(): void {
  }
  protected getDocumentStatus(): DocumentStatus {
    return this._documentStatus;
  }

  protected insertCodeSpecs(): void {
  }

}

// __PUBLISH_EXTRACT_START__ TestConnector-extendsBaseConnector.example-code
export default class TestConnector extends BaseConnector {
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-initializeJob.example-code
  public async initializeJob(): Promise<void> {
    if (ItemState.New === this._sourceDataState) {
      this.createGroupModel();
      this.createPhysicalModel();
      this.createDefinitionModel();
    }
  }

  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-openSourceData.example-code
  public async openSourceData(sourcePath: string): Promise<void> {
    // ignore the passed in source and open the test file
    const json = fs.readFileSync(sourcePath, "utf8");
    this._data = JSON.parse(json);
    this._sourceData = sourcePath;

    const documentStatus = this.getDocumentStatus(); // make sure the repository link is created now, while we are in the repository channel
    this._sourceDataState = documentStatus.itemState;
    assert(documentStatus.elementProps.id !== undefined);
    this._repositoryLinkId = documentStatus.elementProps.id;
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-importDomainSchema.example-code
  public async importDomainSchema(_requestContext: AccessToken): Promise<any> {

    if (this._sourceDataState === ItemState.Unchanged) {
      return;
    }
    TestConnectorSchema.registerSchema();

    const fileName = path.join(__dirname, "..", "..", "..", "test", "assets", "TestConnector.ecschema.xml");

    await this.synchronizer.imodel.importSchemas([fileName]);
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-importDefinitions.example-code

  // importDefinitions is for definitions that are written to shared models such as DictionaryModel
  public async importDefinitions(): Promise<any> {
    if (this._sourceDataState === ItemState.Unchanged) {
      return;
    }
    this.insertCodeSpecs();
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-updateExistingData.example-code
  public async updateExistingData() {
    const groupModelId = this.queryGroupModel();
    const physicalModelId = this.queryPhysicalModel();
    const definitionModelId = this.queryDefinitionModel();
    if (undefined === groupModelId || undefined === physicalModelId || undefined === definitionModelId) {
      const error = `Unable to find model Id for ${undefined === groupModelId ? ModelNames.Group : (undefined === physicalModelId ? ModelNames.Physical : ModelNames.Definition)}`;
      throw new IModelError(IModelStatus.BadArg, error);
    }

    this.issueReporter?.reportIssue(physicalModelId, "source", "Warning", "Test", "Test Message", "Type");

    if (this._sourceDataState === ItemState.New) {
      this.insertCategories();
      this.insertMaterials();
      this.insertGeometryParts();

      // Create this (unused) Subject here just to generate the following code path for the tests:
      // While running in its own private channel ...
      // ... a connector inserts an element that is a child of its channel parent ...
      // ... and that element is inserted into the repository model.
      // That is perfectly legal ... as long as the correct locks are held. The HubMock and integration
      // tests should fail if the correct locks are not held.
      Subject.insert(this.synchronizer.imodel, this.jobSubject.id, "Child Subject");
    }

    this.convertGroupElements(groupModelId);
    this.convertPhysicalElements(physicalModelId, definitionModelId, groupModelId);
    this.synchronizer.imodel.views.setDefaultViewId(this.createView(definitionModelId, physicalModelId, "TestConnectorView"));
  }

  // __PUBLISH_EXTRACT_END__
  public queryGroupModel() {
    throw new Error("Method not implemented.");
  }
  public queryPhysicalModel() {
    throw new Error("Method not implemented.");
  }
  public queryDefinitionModel() {
    throw new Error("Method not implemented.");
  }
  public insertCategories() {
    throw new Error("Method not implemented.");
  }
  public insertMaterials() {
    throw new Error("Method not implemented.");
  }
  public insertGeometryParts() {
    throw new Error("Method not implemented.");
  }

  public convertGroupElements(_groupModelId: any) {
    throw new Error("Method not implemented.");
  }

  public convertPhysicalElements(_physicalModelId: any, _definitionModelId: any, _groupModelId: any) {
    throw new Error("Method not implemented.");
  }

  public createView(_definitionModelId: any, _physicalModelId: any, _arg2: string): any {
    throw new Error("Method not implemented.");
  }

}

