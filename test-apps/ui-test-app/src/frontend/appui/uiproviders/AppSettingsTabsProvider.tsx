/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { getQuantityFormatsSettingsManagerEntry, getUiSettingsManagerEntry, UiFramework } from "@itwin/appui-react";
import { SettingsTabEntry, SettingsTabsProvider } from "@itwin/core-react";
import { AccudrawSettingsPageComponent, TargetSettingsPageComponent } from "../frontstages/Settings";

// Sample settings provider that dynamically adds settings into the setting stage
export class AppSettingsTabsProvider implements SettingsTabsProvider {
  public readonly id = "AppSettingsTabsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10, { availableUnitSystems: new Set(["metric", "imperial", "usSurvey"]) }),
      {
        itemPriority: 20, tabId: "ui-test-app:Accudraw", label: "Accudraw",
        page: <AccudrawSettingsPageComponent />,
        isDisabled: false,
        icon: "icon-paintbrush",
        tooltip: "Accudraw Settings",
      },
      getUiSettingsManagerEntry(30, true), // eslint-disable-line deprecation/deprecation
      {
        itemPriority: 20, tabId: "ui-test-app:Target", label: "Drop Targets",
        page: <TargetSettingsPageComponent />,
        isDisabled: false,
        icon: "icon-drag",
        tooltip: "Drop Target Settings",
      },
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsTabsProvider());
  }
}
