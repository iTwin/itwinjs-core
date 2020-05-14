
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelBridgeBase } from "../../IModelBridge";

class TestBridge extends IModelBridgeBase {
  public initialize(_params: any) {
    throw new Error("Method not implemented.");
  }

  public async openSource(_sourcePath: string, _dmsAccessToken: string | undefined): Promise<BentleyStatus> {
    return BentleyStatus.SUCCESS;
  }
  public async updateExistingData(_sourcePath: string) {

  }
  public async importDefinitions() {

  }
  public async importDynamicSchema() {

  }
  public async importDomainSchema(): Promise<BentleyStatus> {
    return BentleyStatus.SUCCESS;
  }

  public getApplicationId(): string {
    return "2661";
  }
  public getApplicationVersion(): string {
    return "1.0.0.0";
  }
}

export function getBridgeInstance() {
  return new TestBridge();
}
