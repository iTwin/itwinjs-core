/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { getQuantityFormatsSettingsManagerEntry, getUiSettingsManagerEntry, UiFramework } from "@itwin/appui-react";
import { SettingsTabEntry, SettingsTabsProvider } from "@itwin/core-react";
import { AccudrawSettingsPageComponent } from "../frontstages/Settings";

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
      getUiSettingsManagerEntry(30, true),
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsTabsProvider());
  }
}
