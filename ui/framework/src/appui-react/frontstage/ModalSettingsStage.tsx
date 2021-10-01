/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import "./ModalSettingsStage.scss";
import * as React from "react";
import { BackstageItemUtilities, ConditionalBooleanValue, IconSpecUtilities, StageUsage } from "@itwin/appui-abstract";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { Logger } from "@itwin/core-bentley";
import { Centered, SettingsContainer } from "@itwin/core-react";
import { FrontstageManager, ModalFrontstageInfo, ModalFrontstageRequestedCloseEventArgs } from "./FrontstageManager";
import { UiFramework } from "../UiFramework";
import { SyncUiEventId } from "../syncui/SyncUiEventDispatcher";

function ModalSettingsStage({ initialSettingsTabId }: { initialSettingsTabId?: string }) {
  const id = FrontstageManager.activeFrontstageDef?.id ?? "none";
  const stageUsage = FrontstageManager.activeFrontstageDef?.usage ?? StageUsage.General;
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
    return FrontstageManager.onCloseModalFrontstageRequestedEvent.addListener(handleFrontstageCloseRequested);
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
    return BackstageItemUtilities.createActionItem(SettingsModalFrontstage.id, groupPriority, itemPriority, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()),
      UiFramework.translate("settings.settingsStageLabel"),
      undefined, IconSpecUtilities.createSvgIconSpec(settingsIconSvg), { isHidden: SettingsModalFrontstage.noSettingsAvailable() });
  }

  public static showSettingsStage(initialSettingsTab?: string) {
    if (UiFramework.settingsManager.providers.length) {
      // Check to see if it is already open
      // istanbul ignore else
      if (FrontstageManager.activeModalFrontstage && FrontstageManager.activeModalFrontstage instanceof SettingsModalFrontstage) {
        if (initialSettingsTab) {
          UiFramework.settingsManager.activateSettingsTab(initialSettingsTab);
          return;
        }
      }
      FrontstageManager.openModalFrontstage(new SettingsModalFrontstage(initialSettingsTab));
    } else {
      const briefMessage = UiFramework.translate("settings.noSettingsAvailable");
      const detailedMessage = UiFramework.translate("settings.noSettingsProvidersRegistered");
      const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, detailedMessage, OutputMessageType.Toast);
      IModelApp.notifications.outputMessage(info);
      Logger.logInfo(UiFramework.loggerCategory(this), detailedMessage);
    }
  }
}
