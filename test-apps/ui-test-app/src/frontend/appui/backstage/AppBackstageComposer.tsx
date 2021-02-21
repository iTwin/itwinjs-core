/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { UserInfo } from "@bentley/itwin-client";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { BackstageItemUtilities, BadgeType, ConditionalBooleanValue } from "@bentley/ui-abstract";
import { BackstageComposer, FrontstageManager, SettingsModalFrontstage, UserProfileBackstageItem } from "@bentley/ui-framework";
import { ComponentExamplesModalFrontstage } from "../frontstages/component-examples/ComponentExamples";
import { LocalFileOpenFrontstage } from "../frontstages/LocalFileStage";
import { RootState, SampleAppIModelApp, SampleAppUiActionId } from "../..";

import stageIconSvg from "./imodeljs.svg?sprite";
import { EditFrontstage } from "../frontstages/editing/EditFrontstage";
import { ViewsFrontstage } from "../frontstages/ViewsFrontstage";

function mapStateToProps(state: RootState) {
  const frameworkState = state.frameworkState;

  if (!frameworkState)
    return undefined;

  return { userInfo: frameworkState.sessionState.userInfo };
}

interface AppBackstageComposerProps {
  /** UserInfo from sign-in */
  userInfo: UserInfo | undefined;
}

export function AppBackstageComposerComponent({ userInfo }: AppBackstageComposerProps) {
  const hiddenCondition3 = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
  const enableCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
  const notUi2Condition = new ConditionalBooleanValue(() => SampleAppIModelApp.getUiFrameworkProperty() === "1", [SampleAppUiActionId.toggleFrameworkVersion, SampleAppUiActionId.setFrameworkVersion]);
  const imodelIndexHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.isIModelLocal, [SampleAppUiActionId.setIsIModelLocal]);
  const openLocalFileHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.testAppConfiguration?.snapshotPath === undefined, [SampleAppUiActionId.setIsIModelLocal]);

  const [backstageItems] = React.useState(() => {
    if (SampleAppIModelApp.allowWrite) {
      return [
        BackstageItemUtilities.createStageLauncher(EditFrontstage.stageId, 100, 10, IModelApp.i18n.translate("SampleApp:backstage.editIModel"), IModelApp.i18n.translate("SampleApp:backstage.editStage"), "icon-edit"),
        BackstageItemUtilities.createStageLauncher("IModelOpen", 300, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
        BackstageItemUtilities.createStageLauncher("IModelIndex", 300, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder", { isHidden: imodelIndexHidden }),
        BackstageItemUtilities.createActionItem("SampleApp.open-local-file", 300, 30, async () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder", { isHidden: openLocalFileHidden }),
        SettingsModalFrontstage.getBackstageActionItem (400, 10),
      ];
    }

    return [
      BackstageItemUtilities.createStageLauncher(ViewsFrontstage.stageId, 100, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
      BackstageItemUtilities.createStageLauncher("Test1", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, "icon-placeholder", { badgeType: BadgeType.TechnicalPreview }),
      BackstageItemUtilities.createStageLauncher("Test2", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, "icon-placeholder"),
      BackstageItemUtilities.createStageLauncher("Test3", 200, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, "icon-placeholder", { isHidden: hiddenCondition3 }),
      BackstageItemUtilities.createStageLauncher("Test4", 200, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, "icon-placeholder", { isDisabled: enableCondition }),
      BackstageItemUtilities.createStageLauncher("Ui2", 200, 50, IModelApp.i18n.translate("SampleApp:backstage.testFrontstageUi20"), undefined, "icon-placeholder", { isHidden: notUi2Condition }),
      BackstageItemUtilities.createStageLauncher("IModelOpen", 300, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
      BackstageItemUtilities.createStageLauncher("IModelIndex", 300, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder", { isHidden: imodelIndexHidden }),
      BackstageItemUtilities.createActionItem("SampleApp.open-local-file", 300, 30, async () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder", { isHidden: openLocalFileHidden }),
      SettingsModalFrontstage.getBackstageActionItem (400, 10),
      BackstageItemUtilities.createActionItem("SampleApp.componentExamples", 400, 20, () => FrontstageManager.openModalFrontstage(new ComponentExamplesModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.componentExamples"), undefined, "icon-details", { badgeType: BadgeType.New }),
    ];
  });

  return (
    <BackstageComposer items={backstageItems}
      header={userInfo && <UserProfileBackstageItem userInfo={userInfo} />}
    />
  );
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // eslint-disable-line @typescript-eslint/naming-convention
