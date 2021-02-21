/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./SettingsPage.scss";

import React from "react";

import SettingsTabLink from "./SettingsTabLink";

/**
 *
 */
export interface SettingsPageTab {
  /** unique id for entry */
  readonly tabId: string;
  /** localized display label */
  readonly label: string;
  /** Setting page content to display when tab item is selected. */
  readonly page: JSX.Element;
  /** Optional Subtitle to show below label. */
  readonly subtitle?: string;
  /** Icon specification */
  readonly icon?: string | JSX.Element;
  /** Tooltip. Allows JSX|Element to support react-tooltip component */
  readonly tooltip?: string | JSX.Element;
  /** Allows Settings entry to be disabled */
  readonly disabled?: boolean;
}

/**
 *
 */
export interface SettingsContainerProps {
  tabs: SettingsPageTab[];
  // sets tab to set as active tab
  currentSettingsTab?: SettingsPageTab;
  // If plugging into Modal-Frontstage, then don't need a title as UiFramework will take care of this
  title?: string;
  // If plugging into Modal-Frontstage, then don't need a back button as UiFramework will take care of this
  showBackButton?: boolean;
  // If we're providing the back button, then provide the on click handlers for the back button
  onBackButtonClick?: () => void;
  // If plugging into a SPA and you need to modify the route, you can pass in additional logic here
  onSettingsTabSelected?: (tab: SettingsPageTab) => void;
}

// interface SettingsTabsMap {
//   [tabName: string]: SettingsPageTab;
// }

/**
 * Note that SettingsContainer is not rendered if tabs is empty
 */
export const SettingsContainer = ({title, tabs, showBackButton, onBackButtonClick, onSettingsTabSelected, currentSettingsTab}: SettingsContainerProps) => {
  const [openTab, setOpenTab] = React.useState(()=>{
    if (currentSettingsTab && !currentSettingsTab.disabled)
      return currentSettingsTab;
    else
      return tabs[0];
  });

  const processTabSelection = React.useCallback((tab: SettingsPageTab) => {
    if (!tab.disabled) {
      if (onSettingsTabSelected) {
        onSettingsTabSelected(tab);
      }
      setOpenTab(tab);
    }
  }, [onSettingsTabSelected]);

  const onSelectTabId =  React.useCallback((tabId: string) => {
    const selectedTab = tabs.find((tab)=>tab.tabId === tabId);
    if (selectedTab) {
      processTabSelection(selectedTab);
    }
  }, [processTabSelection, tabs]);

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
        <div className={"SettingsPage_tabs"}>
          <div className={"SettingsPage_tabsList"}>
            {tabs.map((tab) => (
              <SettingsTabLink
                tabId={tab.tabId}
                isOpenTab={tab.tabId === openTab.tabId}
                tabLabel={tab.label}
                onClick={onSelectTabId}
                key={tab.tabId}
                disabled={tab.disabled}
                tooltip={tab.tooltip}
              />
            ))}
          </div>
        </div>
        {openTab?.page ?? null}
      </div>
    </div>
  );
};
