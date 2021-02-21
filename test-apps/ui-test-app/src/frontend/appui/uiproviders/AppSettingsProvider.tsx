/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { UiFramework } from "@bentley/ui-framework";
import { SettingsEntry, SettingsProvider } from "@bentley/ui-components";
import { QuantityType } from "@bentley/imodeljs-frontend";
import { QuantityFormatSettingsPanel } from "../frontstages/QuantityFormatStage";
import { ConnectedUiSettingsPage } from "../frontstages/Settings";

// Sample UI items provider that dynamically adds ui items
export class AppSettingsProvider implements SettingsProvider {
  public readonly id = "AppSettingsProvider";

  public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsEntry> | undefined {
    return [
      {
        itemPriority: 10, tabId: "ui-test-app:Quantity", label: "Quantity",
        page: <QuantityFormatSettingsPanel initialQuantityType={QuantityType.Length} />,
        isDisabled: false,
        icon: "icon-measure",
        tooltip: "Quantity Formats",
      },
      {
        itemPriority: 20, tabId: "ui-test-app:UI", label:"UI",
        page: <ConnectedUiSettingsPage />,
        isDisabled: false,
        icon: "icon-paintbrush",
        tooltip: "UI and Accudraw Settings",
      },
    ];
  }

  public static initializeAppSettingProvider() {
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsProvider());
  }
}
