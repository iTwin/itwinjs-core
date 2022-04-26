/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { BackstageItemUtilities, ConditionalBooleanValue } from "@itwin/appui-abstract";
import { BackstageComposer, SettingsModalFrontstage } from "@itwin/appui-react";
import { LocalFileOpenFrontstage } from "../frontstages/LocalFileStage";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

import { IModelOpenFrontstage } from "../frontstages/IModelOpenFrontstage";
import { IModelIndexFrontstage } from "../frontstages/IModelIndexFrontstage";

export function AppBackstageComposer() {
  const imodelIndexHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.isIModelLocal, [SampleAppUiActionId.setIsIModelLocal]);
  const openLocalFileHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.testAppConfiguration?.snapshotPath === undefined, [SampleAppUiActionId.setIsIModelLocal]);

  const [backstageItems] = React.useState(() => {
    return [
      BackstageItemUtilities.createStageLauncher(IModelOpenFrontstage.stageId, 300, 10, IModelApp.localization.getLocalizedString("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
      BackstageItemUtilities.createStageLauncher(IModelIndexFrontstage.stageId, 300, 20, IModelApp.localization.getLocalizedString("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder", { isHidden: imodelIndexHidden }),
      BackstageItemUtilities.createActionItem(LocalFileOpenFrontstage.stageId, 300, 30, async () => LocalFileOpenFrontstage.open(), IModelApp.localization.getLocalizedString("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder", { isHidden: openLocalFileHidden }),
      SettingsModalFrontstage.getBackstageActionItem(400, 10),
    ];
  });

  return (
    <BackstageComposer items={backstageItems} />
  );
}
