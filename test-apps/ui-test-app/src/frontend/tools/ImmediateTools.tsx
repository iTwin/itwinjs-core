/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Tools
 */

// cSpell: ignore popout

import * as React from "react";
import { IModelApp, IModelConnection, Tool } from "@itwin/core-frontend";
import { UiItemsProvidersTest } from "@itwin/ui-items-providers-test";

import {
  IconSpecUtilities, ToolbarItemUtilities,
} from "@itwin/appui-abstract";
import { LocalStateStorage } from "@itwin/core-react";
import {
  ChildWindowLocationProps, ContentDialog, ContentDialogManager, ContentGroup, ContentLayoutManager, ContentProps,
  FrontstageManager, StageContentLayout, StageContentLayoutProps, UiFramework,
} from "@itwin/appui-react";
import toolIconSvg from "@bentley/icons-generic/icons/window-add.svg";
import tool2IconSvg from "@bentley/icons-generic/icons/window-maximize.svg";
import tool3IconSvg from "@bentley/icons-generic/icons/3d-render.svg";
import tool4IconSvg from "@bentley/icons-generic/icons/3d.svg";
import layoutRestoreIconSvg from "@bentley/icons-generic/icons/download.svg";
import removeLayoutIconSvg from "@bentley/icons-generic/icons/remove.svg";
import layoutSaveIconSvg from "@bentley/icons-generic/icons/upload.svg?sprite";
import { PopupTestPanel } from "./PopupTestPanel";
import { PopupTestView } from "./PopupTestView";
import { ComponentExamplesPage } from "../appui/frontstages/component-examples/ComponentExamples";
import { ComponentExamplesProvider } from "../appui/frontstages/component-examples/ComponentExamplesProvider";
import { ITwinUIExamplesProvider } from "../appui/frontstages/component-examples/ITwinUIExamplesProvider";

export class TestExtensionUiProviderTool extends Tool {
  public static testExtensionLoaded = "";

  public static override toolId = "TestExtensionUiProvider";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public static override get keyin(): string {
    return "load test provider";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }
  public override async run(_args: any[]): Promise<boolean> {
    await UiItemsProvidersTest.initialize();
    return true;
  }
}

function getIModelSpecificKey(inKey: string, iModelConnection: IModelConnection | undefined) {
  const imodelId = iModelConnection?.iModelId ?? "unknownImodel";
  return `[${imodelId}]${inKey}`;
}

export async function hasSavedViewLayoutProps(activeFrontstageId: string, iModelConnection: IModelConnection | undefined) {
  const localSettings = new LocalStateStorage();
  return localSettings.hasSetting("ContentGroupLayout", getIModelSpecificKey(activeFrontstageId, iModelConnection));
}

export async function getSavedViewLayoutProps(activeFrontstageId: string, iModelConnection: IModelConnection | undefined) {
  const localSettings = new LocalStateStorage();
  const result = await localSettings.getSetting("ContentGroupLayout", getIModelSpecificKey(activeFrontstageId, iModelConnection));

  if (result.setting) {
    // Parse StageContentLayoutProps
    const savedViewLayoutProps: StageContentLayoutProps = result.setting;
    if (iModelConnection) {
      // Create ViewStates
      const viewStates = await StageContentLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);
      if (0 === viewStates.length)
        return undefined;

      // Add applicationData to the ContentProps
      savedViewLayoutProps.contentGroupProps.contents.forEach((contentProps: ContentProps, index: number) => {
        contentProps.applicationData = { viewState: viewStates[index], iModelConnection };
      });
    }
    return savedViewLayoutProps;
  }
  return undefined;
}

export class SaveContentLayoutTool extends Tool {
  public static override toolId = "SaveContentLayoutTool";
  public static override iconSpec = IconSpecUtilities.createSvgIconSpec(layoutSaveIconSvg);
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public static override get keyin(): string {
    return "content layout save";
  }

  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public override async run(): Promise<boolean> {
    if (FrontstageManager.activeFrontstageDef && ContentLayoutManager.activeLayout && ContentLayoutManager.activeContentGroup) {
      const localSettings = new LocalStateStorage();

      // Create props for the Layout, ContentGroup and ViewStates
      const savedViewLayoutProps = StageContentLayout.viewLayoutToProps(ContentLayoutManager.activeLayout,
        ContentLayoutManager.activeContentGroup, true, (contentProps: ContentProps) => {
          if (contentProps.applicationData) {
            if (contentProps.applicationData.iModelConnection)
              delete contentProps.applicationData.iModelConnection;
            if (contentProps.applicationData.viewState)
              delete contentProps.applicationData.viewState;
          }
        });

      if (savedViewLayoutProps.contentLayoutProps)
        delete savedViewLayoutProps.contentLayoutProps;

      if (FrontstageManager.activeFrontstageDef.contentGroupProvider)
        savedViewLayoutProps.contentGroupProps = FrontstageManager.activeFrontstageDef.contentGroupProvider.prepareToSaveProps(savedViewLayoutProps.contentGroupProps);

      await localSettings.saveSetting("ContentGroupLayout",
        getIModelSpecificKey(FrontstageManager.activeFrontstageDef.id, UiFramework.getIModelConnection()),
        savedViewLayoutProps);
    }
    return true;
  }

}

export class RestoreSavedContentLayoutTool extends Tool {
  public static override toolId = "RestoreSavedContentLayoutTool";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(layoutRestoreIconSvg);
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public static override get keyin(): string {
    return "content layout restore";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public override async run(): Promise<boolean> {
    if (FrontstageManager.activeFrontstageDef) {
      const savedViewLayoutProps = await getSavedViewLayoutProps(FrontstageManager.activeFrontstageDef.id, UiFramework.getIModelConnection());
      if (savedViewLayoutProps) {
        let contentGroupProps = savedViewLayoutProps.contentGroupProps;
        if (FrontstageManager.activeFrontstageDef.contentGroupProvider)
          contentGroupProps = FrontstageManager.activeFrontstageDef.contentGroupProvider.applyUpdatesToSavedProps(savedViewLayoutProps.contentGroupProps);
        const contentGroup = new ContentGroup(contentGroupProps);

        // activate the layout
        await ContentLayoutManager.setActiveContentGroup(contentGroup);

        // emphasize the elements
        StageContentLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps);
      }
    }
    return true;
  }
}

export class RemoveSavedContentLayoutTool extends Tool {
  public static override toolId = "RemoveSavedContentLayoutTool";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(removeLayoutIconSvg);
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public static override get keyin(): string {
    return "content layout remove";
  }
  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public override async run(): Promise<boolean> {
    if (FrontstageManager.activeFrontstageDef) {
      const localSettings = new LocalStateStorage();

      await localSettings.deleteSetting("ContentGroupLayout",
        getIModelSpecificKey(FrontstageManager.activeFrontstageDef.id, UiFramework.getIModelConnection()));
    }
    return true;
  }
}

export class OpenComponentExamplesPopoutTool extends Tool {
  public static override toolId = "openComponentExamplesChildWindow";
  public static override iconSpec = "@bentley/icons-generic/icons/window-add.svg";

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const location: ChildWindowLocationProps = {
      width: 800,
      height: 600,
      left: 0,
      top: 0,
    };
    const connection = UiFramework.getIModelConnection();
    if (connection)
      UiFramework.childWindowManager.openChildWindow("ComponentExamples", "Component Examples",
        <ComponentExamplesPage categories={[...ComponentExamplesProvider.categories, ...ITwinUIExamplesProvider.categories]} hideThemeOption />,
        location, UiFramework.useDefaultPopoutUrl);
  }

  public static override get flyover(): string {
    return "open examples popout";
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "open examples popout";
  }

  public static override get englishKeyin(): string {
    return "open examples popout";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    const iconSpec = IconSpecUtilities.createWebComponentIconSpec(toolIconSvg);
    return ToolbarItemUtilities.createActionButton(OpenComponentExamplesPopoutTool.toolId, itemPriority, iconSpec, OpenComponentExamplesPopoutTool.flyover,
      async () => { await IModelApp.tools.run(OpenComponentExamplesPopoutTool.toolId); }, overrides);
  }
}
export class OpenCustomPopoutTool extends Tool {
  public static override toolId = "OpenCustomPopout";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(tool2IconSvg);

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const location: ChildWindowLocationProps = {
      width: 800,
      height: 600,
      left: 0,
      top: 0,
    };
    UiFramework.childWindowManager.openChildWindow("CustomPopout", "Custom Popout", <PopupTestPanel />, location /* , UiFramework.useDefaultPopoutUrl*/);
  }

  public static override get flyover(): string {
    return "open custom popout";
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "open custom popout";
  }

  public static override get englishKeyin(): string {
    return "open custom popout";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(OpenCustomPopoutTool.toolId, itemPriority, OpenCustomPopoutTool.iconSpec, OpenCustomPopoutTool.flyover,
      async () => { await IModelApp.tools.run(OpenCustomPopoutTool.toolId); }, overrides);
  }
}

export class OpenViewPopoutTool extends Tool {
  public static override toolId = "OpenViewPopout";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(tool3IconSvg);

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const location: ChildWindowLocationProps = {
      width: 800,
      height: 600,
      left: 0,
      top: 0,
    };
    UiFramework.childWindowManager.openChildWindow("ViewPopout", "View Popout", <PopupTestView contentId="ui-test-app:popout-test" showViewPicker />, location);
  }

  public static override get flyover(): string {
    return "open view popout";
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "open view popout";
  }

  public static override get englishKeyin(): string {
    return "open view popout";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(OpenViewPopoutTool.toolId, itemPriority, OpenViewPopoutTool.iconSpec, OpenViewPopoutTool.flyover,
      async () => { await IModelApp.tools.run(OpenViewPopoutTool.toolId); }, overrides);
  }
}

// cSpell:ignore appui appuiprovider
// eslint-disable-next-line @typescript-eslint/naming-convention
export function IModelViewDialog({ x, y, id, title }: { x?: number, y?: number, id: string, title: string }) {
  const handleClose = React.useCallback(() => {
    ContentDialogManager.closeDialog(id);
  }, [id]);

  return (
    <ContentDialog
      title={title}
      inset={false}
      opened={true}
      onClose={handleClose}
      onEscape={handleClose}
      width={"40vw"}
      height={"40vh"}
      dialogId={id}
      x={x}
      y={y}
    >
      <PopupTestView contentId={id} />
    </ContentDialog>
  );
}

export class OpenViewDialogTool extends Tool {
  private static _counter = 0;
  public static override toolId = "OpenViewDialog";
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(tool4IconSvg);
  public static get dialogId(): string {
    return `ui-test-app:popup-view-dialog-${OpenViewDialogTool._counter}`;
  }

  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    await this._run();
    return true;
  }

  private async _run(): Promise<void> {
    OpenViewDialogTool._counter = OpenViewDialogTool._counter + 1;
    let x: number | undefined;
    let y: number | undefined;
    const stage = FrontstageManager.activeFrontstageDef;
    if (stage && stage.nineZoneState) {
      const floatingContentCount = stage.floatingContentControls?.length ?? 0;
      // we should not really every support more than 8 floating views
      if (floatingContentCount < 8 && stage.nineZoneState.size.width > 800 && stage.nineZoneState.size.height > 600) {
        x = (.3 * stage.nineZoneState.size.width) + (40 * (floatingContentCount - 1));
        y = (.3 * stage.nineZoneState.size.height) + (40 * (floatingContentCount - 1));
      }
    }
    ContentDialogManager.openDialog(<IModelViewDialog x={x} y={y} id={OpenViewDialogTool.dialogId}
      title={`IModel View (${OpenViewDialogTool._counter})`} />, OpenViewDialogTool.dialogId);
  }

  public static override get flyover(): string {
    return "open view dialog";
  }

  // if supporting localized key-ins return a localized string
  public static override get keyin(): string {
    return "open view dialog";
  }

  public static override get englishKeyin(): string {
    return "open view dialog";
  }

  public static getActionButtonDef(itemPriority: number, groupPriority?: number) {
    const overrides = {
      groupPriority,
    };
    return ToolbarItemUtilities.createActionButton(OpenViewDialogTool.toolId, itemPriority, OpenViewDialogTool.iconSpec, OpenViewDialogTool.flyover,
      async () => { await IModelApp.tools.run(OpenViewDialogTool.toolId); }, overrides);
  }
}
