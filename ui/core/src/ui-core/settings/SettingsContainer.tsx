/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import "./SettingsContainer.scss";
import * as React from "react";
import { ActivateSettingsTabEventArgs, ProcessSettingsContainerCloseEventArgs, SettingsManager } from "./SettingsManager";
import { VerticalTabs } from "../tabs/VerticalTabs";

/**
 * @alpha
 */
export interface SettingsTab {
  /** unique id for entry */
  readonly tabId: string;
  /** localized display label */
  readonly label: string;
  /** Setting page content to display when tab item is selected. */
  readonly page: JSX.Element;
  /** If the page content needs to save any unsaved content before closing the this value is set to true. */
  readonly pageWillHandleCloseRequest?: boolean;
  /** Optional sub-label to show below label. */
  readonly subLabel?: string;
  /** Icon specification */
  readonly icon?: string | JSX.Element;
  /** Tooltip. Allows JSX|Element to support react-tooltip component */
  readonly tooltip?: string | JSX.Element;
  /** Allows Settings entry to be disabled */
  readonly disabled?: boolean;
}

/**
 * @alpha
 */
export interface SettingsContainerProps {
  tabs: SettingsTab[];
  // sets tab to set as active tab
  currentSettingsTab?: SettingsTab;
  // If plugging into a SPA and you need to modify the route, you can pass in additional logic here
  onSettingsTabSelected?: (tab: SettingsTab) => void;
  // The SettingsManager that can have event handlers registered against it so pages can save its settings before the page is closed.
  settingsManager: SettingsManager;
}

/**
 * Note that SettingsContainer is not rendered if tabs is empty
 */
export const SettingsContainer = ({tabs, onSettingsTabSelected, currentSettingsTab, settingsManager}: SettingsContainerProps) => {
  const [openTab, setOpenTab] = React.useState(()=>{
    if (currentSettingsTab && !currentSettingsTab.disabled)
      return currentSettingsTab;
    else
      return tabs[0];
  });

  const processTabSelection = React.useCallback((tab: SettingsTab) => {
    if (tab.disabled)
      return;
    if (onSettingsTabSelected)
      onSettingsTabSelected(tab);
    setOpenTab(tab);
  }, [onSettingsTabSelected]);

  const processTabSelectionById = React.useCallback((tabId: string) => {
    const tabToActivate = tabs.find((tab)=>tab.tabId === tabId);
    if (tabToActivate)
      processTabSelection (tabToActivate);
  }, [processTabSelection, tabs]);

  const onActivateTab =  React.useCallback((tabIndex: number) => {
    const selectedTab = tabs[tabIndex];
    if (selectedTab) {
      if (openTab && openTab.pageWillHandleCloseRequest)
        settingsManager.processSettingsTabActivation(selectedTab.tabId, processTabSelectionById);
      else
        processTabSelection(selectedTab);
    }
  }, [openTab, processTabSelection, processTabSelectionById, settingsManager, tabs]);

  React.useEffect (()=>{
    const handleActivateSettingsTab = ({settingsTabId}: ActivateSettingsTabEventArgs) => {
      const idToFind = settingsTabId.toLowerCase();
      let tabToActivate = tabs.find((tab)=>tab.tabId.toLowerCase() === idToFind);
      if (!tabToActivate)
        tabToActivate = tabs.find((tab)=>tab.label.toLowerCase() === idToFind);
      if (tabToActivate) {
        if (openTab && openTab.pageWillHandleCloseRequest)
          settingsManager.processSettingsTabActivation(tabToActivate.tabId, processTabSelectionById);
        else
          processTabSelection(tabToActivate);
      }
    };

    return settingsManager.onActivateSettingsTab.addListener(handleActivateSettingsTab);
  }, [openTab, processTabSelection, processTabSelectionById, settingsManager, settingsManager.onActivateSettingsTab, tabs]);

  React.useEffect (()=>{
    const handleSettingsContainerClose = ({closeFunc, closeFuncArgs}: ProcessSettingsContainerCloseEventArgs) => {
      if (openTab && openTab.pageWillHandleCloseRequest)
        settingsManager.processSettingsContainerClose(closeFunc, closeFuncArgs);
      else
        closeFunc(closeFuncArgs);
    };
    return settingsManager.onCloseSettingsContainer.addListener(handleSettingsContainerClose);
  }, [openTab, processTabSelection, settingsManager, settingsManager.onActivateSettingsTab, tabs]);

  const labels=tabs.map((tab)=> {
    return {label:tab.label, subLabel: tab.subLabel, icon: tab.icon,
      tooltip: tab.tooltip, tabId: tab.tabId, disabled: tab.disabled};
  });
  const activeIndex = tabs.findIndex((tab)=>tab.tabId === openTab.tabId);
  return (
    <div className="core-settings-container">
      <div className="core-settings-container-left">
        <VerticalTabs labels={labels} activeIndex={activeIndex} onActivateTab={onActivateTab} />
      </div>
      <div className="core-settings-container-right">
        <div className="core-settings-container-right-header">
          <span className="core-settings-container-main-header">{openTab?.label}</span>
          {openTab?.subLabel && <span className="core-settings-container-main-sub-header">{openTab?.subLabel}</span>}
        </div>
        <div className="core-settings-container-right-contents">
          {openTab?.page ?? null}
        </div>
      </div>
    </div>
  );
};
