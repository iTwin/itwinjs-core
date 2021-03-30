/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./SettingsContainer.scss";
import * as React from "react";
import { ActivateSettingsTabEventArgs, ProcessSettingsContainerCloseEventArgs, ProcessSettingsTabActivationEventArgs, SettingsManager, SettingsTabEntry } from "./SettingsManager";
import { VerticalTabs } from "../tabs/VerticalTabs";
import { ConditionalBooleanValue } from "@bentley/ui-abstract";

/*  ---------------------------------------------------------------------------------------------------
// A typical implementation of a saveFunction callback
const saveChanges = React.useCallback((afterSaveFunction: (args: any) => void, args?: any) => {
  if (dataIsDirty) {
    // prompt user to save changes passing in function and arguments to call after saving changes.
    ModalDialogManager.openDialog(<CustomSavePromptModalDialog customProps={customProps}
      onDialogCloseArgs={args} onDialogClose={afterSaveFunction} />);
    return;
  }
  afterSaveFunction(args);
}, []);
---------------------------------------------------------------------------------------------------------- */

/** Hook to use within Settings Page component to allow saving the current page's data before the Setting Container is closed.
 * @beta
 */
export function useSaveBeforeClosingSettingsContainer(settingsManager: SettingsManager, saveFunction: (closeFunc: (args: any) => void, closeFuncArgs?: any) => void) {
  React.useEffect (()=>{
    const handleProcessSettingsContainerClose = ({closeFunc, closeFuncArgs}: ProcessSettingsContainerCloseEventArgs) => {
      saveFunction (closeFunc, closeFuncArgs);
    };
    return settingsManager.onProcessSettingsContainerClose.addListener(handleProcessSettingsContainerClose);
  }, [saveFunction, settingsManager]);
}

/** Hook to use within Settings Page component to allow saving the current page's data before loading to the requested Setting Tab's page.
 * @beta
 */
export function useSaveBeforeActivatingNewSettingsTab(settingsManager: SettingsManager, saveFunction: (tabSelectionFunc: (args: any) => void, requestedSettingsTabId?: string) => void) {
  React.useEffect (()=>{
    const handleProcessSettingsTabActivation = ({tabSelectionFunc, requestedSettingsTabId}: ProcessSettingsTabActivationEventArgs) => {
      saveFunction (tabSelectionFunc, requestedSettingsTabId);
    };
    return settingsManager.onProcessSettingsTabActivation.addListener(handleProcessSettingsTabActivation);
  }, [saveFunction, settingsManager]);
}

/**
 * @beta
 */
export interface SettingsContainerProps {
  tabs: SettingsTabEntry[];
  // sets tab to set as active tab
  currentSettingsTab?: SettingsTabEntry;
  // If plugging into a SPA and you need to modify the route, you can pass in additional logic here
  onSettingsTabSelected?: (tab: SettingsTabEntry) => void;
  // The SettingsManager that can have event handlers registered against it so pages can save its settings before the page is closed.
  settingsManager: SettingsManager;
  // if true show tab label as header above page contents.
  showHeader?: boolean;
}

/**
 * SettingsContainer component that displays Setting Tabs on Left and the P
 * Note: that SettingsContainer is not rendered if tabs array is empty
 * @beta
 */
export const SettingsContainer = ({tabs, onSettingsTabSelected, currentSettingsTab, settingsManager, showHeader}: SettingsContainerProps) => {
  // sort the tabs based on itemPriority
  tabs = tabs.sort((a, b)=> a.itemPriority - b.itemPriority);

  const [openTab, setOpenTab] = React.useState(()=>{
    if (currentSettingsTab && !ConditionalBooleanValue.getValue(currentSettingsTab.isDisabled))
      return currentSettingsTab;
    else
      return tabs[0];
  });

  const processTabSelection = React.useCallback((tab: SettingsTabEntry) => {
    if (ConditionalBooleanValue.getValue(tab.isDisabled))
      return;
    onSettingsTabSelected && onSettingsTabSelected(tab);
    setOpenTab(tab);
  }, [onSettingsTabSelected]);

  const processTabSelectionById = React.useCallback((tabId: string) => {
    const tabToActivate = tabs.find((tab)=>tab.tabId === tabId);
    tabToActivate && processTabSelection (tabToActivate);
  }, [processTabSelection, tabs]);

  const onActivateTab =  React.useCallback((tabIndex: number) => {
    const selectedTab = tabs[tabIndex];
    if (openTab && openTab.pageWillHandleCloseRequest)
      settingsManager.onProcessSettingsTabActivation.emit({ requestedSettingsTabId:selectedTab.tabId, tabSelectionFunc: processTabSelectionById});
    else
      processTabSelection(selectedTab);
  }, [openTab, processTabSelection, processTabSelectionById, settingsManager, tabs]);

  React.useEffect (()=>{
    const handleActivateSettingsTab = ({settingsTabId}: ActivateSettingsTabEventArgs) => {
      const idToFind = settingsTabId.toLowerCase();
      let tabToActivate = tabs.find((tab)=>tab.tabId.toLowerCase() === idToFind);
      if (!tabToActivate)
        tabToActivate = tabs.find((tab)=>tab.label.toLowerCase() === idToFind);
      // istanbul ignore else
      if (tabToActivate) {
        if (openTab && openTab.pageWillHandleCloseRequest)
          settingsManager.onProcessSettingsTabActivation.emit({ requestedSettingsTabId:tabToActivate.tabId, tabSelectionFunc: processTabSelectionById});
        else
          processTabSelection(tabToActivate);
      }
    };

    return settingsManager.onActivateSettingsTab.addListener(handleActivateSettingsTab);
  }, [openTab, processTabSelection, processTabSelectionById, settingsManager, settingsManager.onActivateSettingsTab, tabs]);

  React.useEffect (()=>{
    const handleSettingsContainerClose = ({closeFunc, closeFuncArgs}: ProcessSettingsContainerCloseEventArgs) => {
      if (openTab && openTab.pageWillHandleCloseRequest)
        settingsManager.onProcessSettingsContainerClose.emit({ closeFunc, closeFuncArgs });
      else
        closeFunc(closeFuncArgs);
    };
    return settingsManager.onCloseSettingsContainer.addListener(handleSettingsContainerClose);
  }, [openTab, processTabSelection, settingsManager, settingsManager.onActivateSettingsTab, tabs]);

  const labels=tabs.map((tab)=> {
    return {label:tab.label, subLabel: tab.subLabel, icon: tab.icon,
      tooltip: tab.tooltip, tabId: tab.tabId, disabled: ConditionalBooleanValue.getValue(tab.isDisabled)};
  });
  const activeIndex = tabs.findIndex((tab)=>tab.tabId === openTab.tabId);
  return (
    <div className="core-settings-container">
      <div className="core-settings-container-left">
        <VerticalTabs labels={labels} activeIndex={activeIndex} onActivateTab={onActivateTab} />
      </div>
      <div className="core-settings-container-right">
        {showHeader && <div className="core-settings-container-right-header">
          <span className="core-settings-container-main-header">{openTab.label}</span>
          {openTab.subLabel && <span className="core-settings-container-main-sub-header">{openTab.subLabel}</span>}
        </div>}
        <div className="core-settings-container-right-contents">
          {openTab.page}
        </div>
      </div>
    </div>
  );
};
