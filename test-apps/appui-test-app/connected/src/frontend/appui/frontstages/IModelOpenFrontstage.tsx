/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { StandardContentLayouts } from "@itwin/appui-abstract";
import {
  BackstageAppButton, BackstageItem, BackstageItemUtilities, ConfigurableCreateInfo, ConfigurableUiManager, ContentControl,
  ContentGroupProps, FrontstageManager, StageUsage, StandardFrontstageProps, StandardFrontstageProvider, UiItemsManager, UiItemsProvider,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../../index";
import { IModelOpen } from "../imodelopen/IModelOpen";

class IModelOpenControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (IModelApp.authorizationClient)
      this.reactNode = <IModelOpen onIModelSelected={this._onOpenIModel} />;
  }

  // called when an imodel has been selected in IModelOpen stage
  private _onOpenIModel = async (arg: { iTwinId: string, id: string }) => {
    await SampleAppIModelApp.openIModelAndViews(arg.iTwinId, arg.id);
  };
}

export class IModelOpenFrontstage {
  public static stageId = "appui-test-app:IModelOpen";

  public static register() {
    // if frontstage has not yet been registered register it now
    if (!FrontstageManager.hasFrontstage(IModelOpenFrontstage.stageId)) {
      const contentGroupProps: ContentGroupProps = {
        id: "appui-test-app:IModelOpenGroup",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "imodel-open",
            classId: IModelOpenControl,
          },
        ],
      };

      const stageProps: StandardFrontstageProps = {
        id: IModelOpenFrontstage.stageId,
        version: 1.0,
        contentGroupProps,
        cornerButton: <BackstageAppButton />,
        usage: StageUsage.Private,
        hideToolSettings: true,
        hideStatusBar: true,
      };

      ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(stageProps));
      UiItemsManager.register(new BackstageItemsProvider());
    }
  }

  public static async open() {
    IModelOpenFrontstage.register();
    const frontstageDef = await FrontstageManager.getFrontstageDef(IModelOpenFrontstage.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
  }
}

class BackstageItemsProvider implements UiItemsProvider {
  public readonly id = "local-file-open-stage-backstageItemProvider";

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createStageLauncher(IModelOpenFrontstage.stageId, 300, 10, IModelApp.localization.getLocalizedString("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
    ];
  }
}
