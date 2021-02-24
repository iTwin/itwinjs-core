/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./ModalSettingsStage.scss";
import * as React from "react";
import { BackstageItemUtilities, ConditionalBooleanValue, IconSpecUtilities, StageUsage } from "@bentley/ui-abstract";
import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";
import { SettingsContainer, SettingsTab } from "@bentley/ui-core";
import { FrontstageManager, ModalFrontstageInfo, ModalFrontstageRequestedCloseEventArgs } from "./FrontstageManager";
import { UiFramework } from "../UiFramework";
import { SyncUiEventId } from "../syncui/SyncUiEventDispatcher";

function ModalSettingsStage({initialSettingsTabId}: {initialSettingsTabId?: string}) {
  const id=FrontstageManager.activeFrontstageDef?.id??"none";
  const stageUsage=FrontstageManager.activeFrontstageDef?.usage??StageUsage.General;
  const entries = UiFramework.settingsManager.getSettingEntries(id, stageUsage);

  const tabs: SettingsTab[] = !entries ? []: entries.sort((a, b)=> a.itemPriority - b.itemPriority).map((entry) => {
    return {
      tabId: entry.tabId,
      label: entry.label,
      page: entry.page,
      subLabel: entry.subLabel,
      icon: entry.icon,
      tooltip: entry.tooltip,
      disabled: ConditionalBooleanValue.getValue(entry.isDisabled),
      pageWillHandleCloseRequest: entry.pageWillHandleCloseRequest,
    };
  });

  const currentSettingsTab = React.useCallback(() => {
    const categoryToFind = initialSettingsTabId ? initialSettingsTabId.toLowerCase() : tabs[0].tabId.toLowerCase();
    let foundTab = tabs.find((entry) => entry.tabId.toLowerCase() === categoryToFind);
    if (!foundTab)
      foundTab = tabs.find((entry) => entry.label.toLowerCase() === categoryToFind);
    return foundTab;
  },[initialSettingsTabId, tabs]);

  React.useEffect (()=>{
    const handleFrontstageCloseRequested = ({modalFrontstage, stageCloseFunc}: ModalFrontstageRequestedCloseEventArgs) => {
      if (modalFrontstage instanceof SettingsModalFrontstage && stageCloseFunc) {
        UiFramework.settingsManager.closeSettingsContainer (stageCloseFunc);
      }
    };
    return FrontstageManager.onCloseModalFrontstageRequestedEvent.addListener(handleFrontstageCloseRequested);
  }, [currentSettingsTab, entries]);

  return (
    <div className="uifw-settings-container">
      {tabs.length &&
      <SettingsContainer tabs={tabs} currentSettingsTab={currentSettingsTab()} settingsManager={UiFramework.settingsManager} />
      }
    </div>
  );
}

/** Modal frontstage displaying and editing settings from registered settings providers.
 * @alpha
 */
export class SettingsModalFrontstage implements ModalFrontstageInfo {
  public static id = "ui-framework.modalSettingsStage";
  public title: string = UiFramework.i18n.translate("SampleApp:settingsStage.settings");
  constructor(public initialSettingsTabId?: string ) {}
  public notifyCloseRequest = true;
  public get content(): React.ReactNode { return (<ModalSettingsStage initialSettingsTabId={this.initialSettingsTabId} />); }
  private static noSettingsAvailable = () => new ConditionalBooleanValue(() => 0 === UiFramework.settingsManager.providers.length, [SyncUiEventId.SettingsProvidersChanged]);

  public static getBackstageActionItem(groupPriority: number, itemPriority: number) {
    return BackstageItemUtilities.createActionItem(SettingsModalFrontstage.id, groupPriority, itemPriority, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()),
      UiFramework.i18n.translate("UiFramework:settings.settingsStageLabel"),
      undefined, IconSpecUtilities.createSvgIconSpec(settingsIconSvg), { isHidden: SettingsModalFrontstage.noSettingsAvailable() });
  }

  public static showSettingsStage(initialSettingsTab?: string) {
    if (UiFramework.settingsManager.providers.length) {
      // Check to see if it is already open
      if (FrontstageManager.activeModalFrontstage && FrontstageManager.activeModalFrontstage instanceof SettingsModalFrontstage){
        if (initialSettingsTab)
          UiFramework.settingsManager.activateSettingsTab(initialSettingsTab);
        return;
      }
      FrontstageManager.openModalFrontstage(new SettingsModalFrontstage(initialSettingsTab));
    } else {
      const briefMessage =  UiFramework.i18n.translate("UiFramework:settings.noSettingsAvailable");
      const detailedMessage =  UiFramework.i18n.translate("UiFramework:settings.noSettingsProvidersRegistered");
      const info = new NotifyMessageDetails(OutputMessagePriority.Info, briefMessage, detailedMessage, OutputMessageType.Toast);
      IModelApp.notifications.outputMessage(info);
      Logger.logInfo(UiFramework.loggerCategory(this), detailedMessage);
    }
  }
}
