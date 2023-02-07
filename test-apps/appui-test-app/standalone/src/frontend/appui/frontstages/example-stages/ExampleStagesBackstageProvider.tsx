/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackstageItem, BackstageItemUtilities, UiItemsManager, UiItemsProvider } from "@itwin/appui-react";
import { registerCustomFrontstage } from "./CustomFrontstage";
import stageIconSvg from "../imodeljs.svg?sprite";
import { registerViewportFrontstage } from "./ViewportFrontstage";

class ExampleStagesBackstageItemsProvider implements UiItemsProvider {
  public readonly id = "main-stage-backstageItemProvider";

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createStageLauncher("example:ViewportFrontstage", 100, 20, "Simple viewport", undefined, `svg:${stageIconSvg}`),
      BackstageItemUtilities.createStageLauncher("example:CustomFrontstage", 100, 30, "Simple custom frontstage", undefined, `svg:${stageIconSvg}`),
    ];
  }
}

export function registerExampleFrontstages(): void {
  registerCustomFrontstage();
  registerViewportFrontstage();
}

export function addExampleFrontstagesToBackstage(): void {
  UiItemsManager.register(new ExampleStagesBackstageItemsProvider());
}
