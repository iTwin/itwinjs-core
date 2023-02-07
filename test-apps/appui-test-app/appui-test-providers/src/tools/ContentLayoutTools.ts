/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConditionalStringValue, IconSpecUtilities, StandardContentLayouts } from "@itwin/appui-abstract";
import { CommandItemDef, ContentGroup, ContentGroupProps, ContentProps,
  IModelViewportControl,
  StageContentLayout, StageContentLayoutProps, SyncUiEventId, ToolItemDef, UiFramework } from "@itwin/appui-react";
import { IModelApp, IModelConnection, Tool } from "@itwin/core-frontend";
import { LocalStateStorage } from "@itwin/core-react/lib/cjs/core-react";

import layoutRestoreIconSvg from "@bentley/icons-generic/icons/download.svg";
import layoutSaveIconSvg from "@bentley/icons-generic/icons/upload.svg";
import splitVerticalIconSvg from "@bentley/icons-generic/icons/window-split-vertical.svg";
import singlePaneIconSvg from "@bentley/icons-generic/icons/window.svg";

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
  public static override iconSpec = IconSpecUtilities.createWebComponentIconSpec(layoutSaveIconSvg);
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }
  public static override get keyin(): string {
    return "content layout save";
  }

  public static override get englishKeyin(): string {
    return this.keyin;
  }

  public override async run(): Promise<boolean> {
    if (UiFramework.frontstages.activeFrontstageDef && UiFramework.content.layouts.activeLayout && UiFramework.content.layouts.activeContentGroup) {
      const localSettings = new LocalStateStorage();

      // Create props for the Layout, ContentGroup and ViewStates
      const savedViewLayoutProps = StageContentLayout.viewLayoutToProps(UiFramework.content.layouts.activeLayout,
        UiFramework.content.layouts.activeContentGroup, true, (contentProps: ContentProps) => {
          if (contentProps.applicationData) {
            if (contentProps.applicationData.iModelConnection)
              delete contentProps.applicationData.iModelConnection;
            if (contentProps.applicationData.viewState)
              delete contentProps.applicationData.viewState;
          }
        });

      if (savedViewLayoutProps.contentLayoutProps)
        delete savedViewLayoutProps.contentLayoutProps;

      if (UiFramework.frontstages.activeFrontstageDef.contentGroupProvider)
        savedViewLayoutProps.contentGroupProps = UiFramework.frontstages.activeFrontstageDef.contentGroupProvider.prepareToSaveProps(savedViewLayoutProps.contentGroupProps);

      await localSettings.saveSetting("ContentGroupLayout",
        getIModelSpecificKey(UiFramework.frontstages.activeFrontstageDef.id, UiFramework.getIModelConnection()),
        savedViewLayoutProps);
    }
    return true;
  }

  public static get toolItemDef() {
    return new ToolItemDef({
      toolId: SaveContentLayoutTool.toolId,
      iconSpec: SaveContentLayoutTool.iconSpec,
      label: SaveContentLayoutTool.flyover,
      tooltip: SaveContentLayoutTool.description,
      execute: async () => {
        await IModelApp.tools.run(SaveContentLayoutTool.toolId);
      },
    });
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
    if (UiFramework.frontstages.activeFrontstageDef) {
      const savedViewLayoutProps = await getSavedViewLayoutProps(UiFramework.frontstages.activeFrontstageDef.id, UiFramework.getIModelConnection());
      if (savedViewLayoutProps) {
        let contentGroupProps = savedViewLayoutProps.contentGroupProps;
        if (UiFramework.frontstages.activeFrontstageDef.contentGroupProvider)
          contentGroupProps = UiFramework.frontstages.activeFrontstageDef.contentGroupProvider.applyUpdatesToSavedProps(savedViewLayoutProps.contentGroupProps);
        const contentGroup = new ContentGroup(contentGroupProps);

        // activate the layout
        await UiFramework.content.layouts.setActiveContentGroup(contentGroup);

        // emphasize the elements
        StageContentLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps);
      }
    }
    return true;
  }

  public static get toolItemDef() {
    return new ToolItemDef({
      toolId: RestoreSavedContentLayoutTool.toolId,
      iconSpec: RestoreSavedContentLayoutTool.iconSpec,
      label: RestoreSavedContentLayoutTool.flyover,
      tooltip: RestoreSavedContentLayoutTool.description,
      execute: async () => {
        await IModelApp.tools.run(RestoreSavedContentLayoutTool.toolId);
      },
    });
  }
}

export function getSplitSingleViewportCommandDef() {
  const commandId = "splitSingleViewportCommandDef";
  return new CommandItemDef({
    commandId,
    iconSpec: new ConditionalStringValue(() => IconSpecUtilities.createWebComponentIconSpec(1 === UiFramework.frontstages.activeFrontstageDef?.contentGroup?.getContentControls().length ? splitVerticalIconSvg :singlePaneIconSvg), [SyncUiEventId.ActiveContentChanged]),
    label: new ConditionalStringValue(() => 1 === UiFramework.frontstages.activeFrontstageDef?.contentGroup?.getContentControls().length ? "Split Content View" : "Single Content View", [SyncUiEventId.ActiveContentChanged]),
    execute: async () => {
      // if the active frontstage is only showing an single viewport then split it and have two copies of it
      const activeFrontstageDef = UiFramework.frontstages.activeFrontstageDef;
      if (activeFrontstageDef && 1 === activeFrontstageDef.contentGroup?.getContentControls().length &&
         activeFrontstageDef.contentControls[0].viewport) {
        const vp = activeFrontstageDef.contentControls[0].viewport;
        if (vp) {
          const contentPropsArray: ContentProps[] = [];
          contentPropsArray.push({
            id: "imodel-view-0",
            classId: IModelViewportControl.id,
            applicationData:
             {
               viewState: vp.view.clone(),
               iModelConnection: vp.view.iModel,
               featureOptions:
               {
                 defaultViewOverlay: {
                   enableScheduleAnimationViewOverlay: true,
                   enableAnalysisTimelineViewOverlay: true,
                   enableSolarTimelineViewOverlay: true,
                 },
               },
             },
          });
          contentPropsArray.push({
            id: "imodel-view-1",
            classId: IModelViewportControl.id,
            applicationData:
             {
               viewState: vp.view.clone(),
               iModelConnection: vp.view.iModel,
               featureOptions:
               {
                 defaultViewOverlay: {
                   enableScheduleAnimationViewOverlay: true,
                   enableAnalysisTimelineViewOverlay: true,
                   enableSolarTimelineViewOverlay: true,
                 },
               },
             },
          });

          let contentGroupProps: ContentGroupProps = {
            id: "split-vertical-group",
            layout: StandardContentLayouts.twoVerticalSplit,
            contents: contentPropsArray,
          };

          if (activeFrontstageDef.contentGroupProvider)
            contentGroupProps = activeFrontstageDef.contentGroupProvider.applyUpdatesToSavedProps(contentGroupProps);

          const contentGroup = new ContentGroup(contentGroupProps);
          await UiFramework.content.layouts.setActiveContentGroup(contentGroup);
        }
      } else if (activeFrontstageDef && 2 === activeFrontstageDef.contentGroup?.getContentControls().length &&
         activeFrontstageDef.contentControls[0].viewport) {
        const vp = activeFrontstageDef.contentControls[0].viewport;
        if (vp) {
          const contentPropsArray: ContentProps[] = [];
          contentPropsArray.push({
            id: "imodel-view-0",
            classId: IModelViewportControl.id,
            applicationData:
             {
               viewState: vp.view.clone(),
               iModelConnection: vp.view.iModel,
             },
          });

          let contentGroupProps: ContentGroupProps = {
            id: "single-content",
            layout: StandardContentLayouts.singleView,
            contents: contentPropsArray,
          };
          if (activeFrontstageDef.contentGroupProvider)
            contentGroupProps = activeFrontstageDef.contentGroupProvider.applyUpdatesToSavedProps(contentGroupProps);

          const contentGroup = new ContentGroup(contentGroupProps);
          await UiFramework.content.layouts.setActiveContentGroup(contentGroup);
        }
      }
    },
  });
}

