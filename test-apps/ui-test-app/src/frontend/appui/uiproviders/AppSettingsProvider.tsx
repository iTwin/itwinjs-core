/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { getQuantityFormatsSettingsManagerEntry, UiFramework } from "@bentley/ui-framework";
import { SettingsProvider, SettingsTabEntry } from "@bentley/ui-core";
import { ConnectedUiSettingsPage } from "../frontstages/Settings";

// Sample settings provider that dynamically adds settings into the setting stage
export class AppSettingsProvider implements SettingsProvider {
  public readonly id = "AppSettingsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    return [
      getQuantityFormatsSettingsManagerEntry(10, {availableUnitSystems:new Set(["metric","imperial","usSurvey"])}),
      {
        itemPriority: 20, tabId: "ui-test-app:UI", label: "UI",
        page: <ConnectedUiSettingsPage />,
        isDisabled: false,
        icon: "icon-paintbrush",
        subLabel: "UI and Accudraw",
        tooltip: "UI and Accudraw Settings",
      },
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsProvider());
  }
}
