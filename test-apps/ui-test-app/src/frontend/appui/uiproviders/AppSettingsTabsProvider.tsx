/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { getUiSettingsManagerEntry, UiFramework } from "@bentley/ui-framework";
import { SettingsTabEntry, SettingsTabsProvider } from "@bentley/ui-core";
import { getQuantityFormatsSettingsManagerEntry } from "../frontstages/QuantityFormatStage";
import { UiSettingsPageComponent } from "../frontstages/Settings";

// Sample UI items provider that dynamically adds ui items
export class AppSettingsTabsProvider implements SettingsTabsProvider {
  public readonly id = "AppSettingsTabsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10),
      {
        itemPriority: 20, tabId: "ui-test-app:Accudraw", label: "Accudraw",
        page: <UiSettingsPageComponent />,
        isDisabled: false,
        icon: "icon-paintbrush",
        tooltip: "Accudraw Settings",
      },
      getUiSettingsManagerEntry(30),
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsTabsProvider());
  }
}
