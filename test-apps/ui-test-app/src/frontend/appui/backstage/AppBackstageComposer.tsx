/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { connect } from "react-redux";
import { UserInfo } from "@bentley/itwin-client";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { BackstageItemUtilities, ConditionalBooleanValue, IconSpecUtilities } from "@bentley/ui-abstract";
import { BackstageComposer, FrontstageManager, UserProfileBackstageItem } from "@bentley/ui-framework";
import { ComponentExamplesModalFrontstage } from "../frontstages/component-examples/ComponentExamples";
import { LocalFileOpenFrontstage } from "../frontstages/LocalFileStage";
import { SettingsModalFrontstage } from "../frontstages/Settings";
import { RootState, SampleAppIModelApp, SampleAppUiActionId } from "../..";

import stageIconSvg from "./imodeljs.svg?sprite";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";

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

  const [backstageItems] = React.useState(() => [
    BackstageItemUtilities.createStageLauncher("Test1", 100, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, "icon-placeholder"),
    BackstageItemUtilities.createStageLauncher("Test2", 100, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, "icon-placeholder"),
    BackstageItemUtilities.createStageLauncher("Test3", 100, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, "icon-placeholder", { isHidden: hiddenCondition3 }),
    BackstageItemUtilities.createStageLauncher("Test4", 100, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, "icon-placeholder", { isDisabled: enableCondition }),
    BackstageItemUtilities.createStageLauncher("Ui2", 100, 50, IModelApp.i18n.translate("SampleApp:backstage.testFrontstageUi20"), undefined, "icon-placeholder", { isHidden: notUi2Condition }),
    BackstageItemUtilities.createStageLauncher("IModelOpen", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
    BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder", { isHidden: imodelIndexHidden }),
    BackstageItemUtilities.createActionItem("SampleApp.open-local-file", 200, 30, () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder"),
    BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, IconSpecUtilities.createSvgIconSpec(settingsIconSvg)),
    BackstageItemUtilities.createActionItem("SampleApp.componentExamples", 300, 20, () => FrontstageManager.openModalFrontstage(new ComponentExamplesModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.componentExamples"), undefined, "icon-details"),
    BackstageItemUtilities.createStageLauncher("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
  ]);

  return (
    <BackstageComposer items={backstageItems}
      header={userInfo && <UserProfileBackstageItem userInfo={userInfo} />}
    />
  );
}

export const AppBackstageComposer = connect(mapStateToProps)(AppBackstageComposerComponent); // tslint:disable-line:variable-name
