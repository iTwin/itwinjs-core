/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./SettingsContainer.scss";
import React from "react";
import { VerticalTabs } from "@bentley/ui-core";
import { ActivateSettingsTabEventArgs, ProcessSettingsContainerCloseEventArgs, SettingsManager } from "./SettingsManager";

/**
 * @internal
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
 * @internal
 */
export interface SettingsContainerProps {
  tabs: SettingsTab[];
  // sets tab to set as active tab
  currentSettingsTab?: SettingsTab;
  // If plugging into Modal-Frontstage, then don't need a title as UiFramework will take care of this
  title?: string;
  // If plugging into Modal-Frontstage, then don't need a back button as UiFramework will take care of this
  showBackButton?: boolean;
  // If we're providing the back button, then provide the on click handlers for the back button
  onBackButtonClick?: () => void;
  // If plugging into a SPA and you need to modify the route, you can pass in additional logic here
  onSettingsTabSelected?: (tab: SettingsTab) => void;
  settingsManager: SettingsManager;
}

/**
 * Note that SettingsContainer is not rendered if tabs is empty
 */
export const SettingsContainer = ({title, tabs, showBackButton, onBackButtonClick, onSettingsTabSelected, currentSettingsTab, settingsManager}: SettingsContainerProps) => {
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
    <div className={"SettingsPage_layout"}>
      {showBackButton && (
        <div className={"SettingsPage_header"}>
          <div className={"SettingsPage_backButtonWrapper"}>
            {/* Added an inline svg instead of using the svg as a component because we don't use svg loaders to build & compile this pkg */}
            <svg
              viewBox="0 0 16 16"
              className="SettingsPage_backButton"
              onClick={() => {
                if (onBackButtonClick) {
                  onBackButtonClick();
                }
              }}
            >
              <path d="M9.47 3.47 10.53 4.53 7.06 8 10.53 11.47 9.47 12.53 4.939 8 9.47 3.47z" />
              <path d="M8 14.5A6.5 6.5 0 1 1 14.5 8 6.5074 6.5074 0 0 1 8 14.5M8 16A8 8 0 1 0 0 8a8 8 0 0 0 8 8" />
            </svg>
          </div>
          <div className={"SettingsPage_title"}>{title}</div>
        </div>
      )}
      <div className={"SettingsPage_content"}>
        <VerticalTabs labels={labels} activeIndex={activeIndex} onActivateTab={onActivateTab} />
        {openTab?.page ?? null}
      </div>
    </div>
  );
};
