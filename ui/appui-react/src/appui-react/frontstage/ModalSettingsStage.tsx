/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import "./ModalSettingsStage.scss";
import * as React from "react";
import { BackstageItemUtilities, ConditionalBooleanValue, IconSpecUtilities } from "@itwin/appui-abstract";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { Logger } from "@itwin/core-bentley";
import { Centered, SettingsContainer } from "@itwin/core-react";
import { ModalFrontstageInfo, ModalFrontstageRequestedCloseEventArgs } from "../framework/FrameworkFrontstages";
import { UiFramework } from "../UiFramework";
import { SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { StageUsage } from "./StageUsage";

function ModalSettingsStage({ initialSettingsTabId }: { initialSettingsTabId?: string }) {
  const id = UiFramework.frontstages.activeFrontstageDef?.id ?? "none";
  const stageUsage = UiFramework.frontstages.activeFrontstageDef?.usage ?? StageUsage.General;
  const tabEntries = UiFramework.settingsManager.getSettingEntries(id, stageUsage);
  const noSettingsAvailableLabel = React.useRef(UiFramework.translate("settings.noSettingsAvailable"));

  const currentSettingsTab = React.useCallback(() => {
    const categoryToFind = initialSettingsTabId ? initialSettingsTabId.toLowerCase() : tabEntries[0].tabId.toLowerCase();
    let foundTab = tabEntries.find((entry) => entry.tabId.toLowerCase() === categoryToFind);
    if (!foundTab)
      foundTab = tabEntries.find((entry) => entry.label.toLowerCase() === categoryToFind);
    return foundTab;
  }, [initialSettingsTabId, tabEntries]);

  React.useEffect(() => {
    const handleFrontstageCloseRequested = ({ modalFrontstage, stageCloseFunc }: ModalFrontstageRequestedCloseEventArgs) => {
      // istanbul ignore else
      if (modalFrontstage instanceof SettingsModalFrontstage && stageCloseFunc) {
        UiFramework.settingsManager.closeSettingsContainer(stageCloseFunc);
      }
    };
    return UiFramework.frontstages.onCloseModalFrontstageRequestedEvent.addListener(handleFrontstageCloseRequested);
  }, [tabEntries]);

  return (
    <div className="uifw-settings-container">
      {tabEntries.length ?
        <SettingsContainer tabs={tabEntries} currentSettingsTab={currentSettingsTab()} settingsManager={UiFramework.settingsManager} /> :
        <Centered>{noSettingsAvailableLabel.current}</Centered>
      }
    </div>
  );
}

/** Modal frontstage displaying and editing settings from registered settings providers. See [SettingsManager]($core-react)
 * and [SettingsContainer]($core-react).
 * @beta
 */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public static id = "appui-react.modalSettingsStage";
  public title: string = UiFramework.translate("settings.settingsStageLabel");
  constructor(public initialSettingsTabId?: string) { }
  public notifyCloseRequest = true;
  public get content(): React.ReactNode {
    return (<ModalSettingsStage initialSettingsTabId={this.initialSettingsTabId} />);
  }
  private static noSettingsAvailable = () => new ConditionalBooleanValue(() => 0 === UiFramework.settingsManager.providers.length, [SyncUiEventId.SettingsProvidersChanged]);

  public static getBackstageActionItem(groupPriority: number, itemPriority: number) {
    return BackstageItemUtilities.createActionItem(SettingsModalFrontstage.id, groupPriority, itemPriority, () => UiFramework.frontstages.openModalFrontstage(new SettingsModalFrontstage()), // eslint-disable-line deprecation/deprecation
      UiFramework.translate("settings.settingsStageLabel"),
      undefined, IconSpecUtilities.createWebComponentIconSpec(settingsIconSvg), { isHidden: SettingsModalFrontstage.noSettingsAvailable() });
  }

  public static showSettingsStage(initialSettingsTab?: string) {
    if (UiFramework.settingsManager.providers.length) {
      // Check to see if it is already open
      // istanbul ignore else
      if (UiFramework.frontstages.activeModalFrontstage && UiFramework.frontstages.activeModalFrontstage instanceof SettingsModalFrontstage) {
        if (initialSettingsTab) {
          UiFramework.settingsManager.activateSettingsTab(initialSettingsTab);
          return;
        }
      }
      UiFramework.frontstages.openModalFrontstage(new SettingsModalFrontstage(initialSettingsTab));
    } else {
      const briefMessage = UiFramework.translate("settings.noSettingsAvailable");
      const detailedMessage = UiFramework.translate("settings.noSettingsProvidersRegistered");
      const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, detailedMessage, OutputMessageType.Toast);
      IModelApp.notifications.outputMessage(info);
      Logger.logInfo(UiFramework.loggerCategory(this), detailedMessage);
    }
  }
}
