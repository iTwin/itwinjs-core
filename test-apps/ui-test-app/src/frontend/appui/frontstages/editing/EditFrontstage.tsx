/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { CommonToolbarItem, ConditionalBooleanValue, IconSpecUtilities, StageUsage, ToolbarItemUtilities, WidgetState } from "@itwin/appui-abstract";
import {
  AccuDrawDialog, AccuDrawWidgetControl, BasicNavigationWidget, BasicToolWidget, CommandItemDef,
  CoreTools, CustomItemDef, Frontstage, FrontstageProvider, IModelConnectedViewSelector, ModelessDialogManager,
  StagePanel, ToolbarHelper, Widget, Zone, ZoneLocation, ZoneState,
} from "@itwin/appui-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../../../frontend/index";
import { EditTools } from "../../../tools/editing/ToolSpecifications";
// cSpell:Ignore contentviews statusbars
import { EditStatusBarWidgetControl } from "../../statusbars/editing/EditStatusBar";
import { ActiveSettingsWidget } from "../../widgets/editing/ActiveSettingsWidget";
import { ModelCreationWidget } from "../../widgets/editing/ModelCreationWidget";
import { Orientation } from "@itwin/core-react";

/* eslint-disable react/jsx-key, deprecation/deprecation */

import sketchIconSvg from "../../icons/draw.svg?sprite";
import { InitialIModelContentStageProvider } from "../ViewsFrontstage";

export class EditFrontstage extends FrontstageProvider {
  private _contentGroupProvider = new InitialIModelContentStageProvider(true);
  public static stageId = "EditFrontstage";
  public get id(): string {
    return EditFrontstage.stageId;
  }

  private _additionalTools = new AdditionalTools();

  public static savedViewLayoutProps: string;

  private _bottomPanel = {
    widgets: [
      <Widget id={AccuDrawWidgetControl.id} label={AccuDrawWidgetControl.label} control={AccuDrawWidgetControl} />,
    ],
  };

  /** Get the CustomItemDef for ViewSelector  */
  private get _viewSelectorItemDef() {
    return new CustomItemDef({
      customId: "sampleApp:viewSelector",
      reactElement: (
        <IModelConnectedViewSelector
          listenForShowUpdates={false}  // Demo for showing only the same type of view in ViewSelector - See IModelViewport.tsx, onActivated
        />
      ),
    });
  }

  private get _additionalNavigationVerticalToolbarItems() {
    return [
      ToolbarHelper.createToolbarItemFromItemDef(200, this._viewSelectorItemDef)];
  }

  public get frontstage() {
    return (
      <Frontstage id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={this._contentGroupProvider}
        isInFooterMode={true} applicationData={{ key: "value" }}
        usage={StageUsage.Edit}
        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicToolWidget additionalHorizontalItems={this._additionalTools.additionalHorizontalToolbarItems}
                  additionalVerticalItems={this._additionalTools.additionalVerticalToolbarItems} showCategoryAndModelsContextTools={false} />} />,
              ]}
          />
        }
        toolSettings={
          <Zone
            allowsMerging
            widgets={
              [
                <Widget
                  iconSpec="icon-placeholder"
                  isToolSettings={true}
                />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={
                  <BasicNavigationWidget additionalVerticalItems={this._additionalNavigationVerticalToolbarItems} />
                } />,
              ]}
          />
        }
        centerLeft={
          <Zone
            allowsMerging
            defaultState={ZoneState.Minimized}
            initialWidth={250}
            widgets={
              [
                <Widget defaultState={WidgetState.Closed} iconSpec="icon-active" labelKey="SampleApp:widgets.ActiveSettings" control={ActiveSettingsWidget}
                  syncEventIds={[SampleAppUiActionId.setTestProperty]}
                  stateFunc={(): WidgetState => SampleAppIModelApp.getTestProperty() !== "HIDE" ? WidgetState.Closed : WidgetState.Hidden}
                />,
                <Widget defaultState={WidgetState.Closed} iconSpec="icon-add" labelKey="SampleApp:widgets.ModelCreation" control={ModelCreationWidget}
                  syncEventIds={[SampleAppUiActionId.setTestProperty]}
                  stateFunc={(): WidgetState => SampleAppIModelApp.getTestProperty() !== "HIDE" ? WidgetState.Closed : WidgetState.Hidden}
                />,
              ]}
          />
        }
        statusBar={
          <Zone
            widgets={
              [
                <Widget isStatusBar={true} control={EditStatusBarWidgetControl} />,
              ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true} mergeWithZone={ZoneLocation.CenterRight}
            widgets={
              [
              ]}
          />
        }
        bottomPanel={
          <StagePanel
            widgets={this._bottomPanel.widgets}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class AdditionalTools {
  public sketchGroupItems = ToolbarHelper.constructChildToolbarItems([
    EditTools.placeLineStringTool, EditTools.placeArcTool]);

  public sketchGroupButtonItem = ToolbarItemUtilities.createGroupButton("SampleApp:buttons.sketch", 135, IconSpecUtilities.createSvgIconSpec(sketchIconSvg),
    IModelApp.localization.getLocalizedString("SampleApp:buttons.sketch"), this.sketchGroupItems);

  public additionalHorizontalToolbarItems: CommonToolbarItem[] = [...ToolbarHelper.createToolbarItemsFromItemDefs([
    CoreTools.keyinPaletteButtonItemDef, EditTools.deleteElementTool,
    EditTools.moveElementTool, EditTools.rotateElementTool, EditTools.placeBlockTool], 100),
  this.sketchGroupButtonItem];

  private get _accudrawDialogItemVertical() {
    const dialogId = "accudraw-vertical";
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.accuDrawDialogVertical",
      execute: () => {
        ModelessDialogManager.openDialog(
          <AccuDrawDialog
            opened={true}
            dialogId={dialogId}
            orientation={Orientation.Vertical}
            onClose={() => ModelessDialogManager.closeDialog(dialogId)}
          />, dialogId);
      },
    });
  }

  private get _accudrawDialogItemHorizontal() {
    const dialogId = "accudraw-horizontal";
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.accuDrawDialogHorizontal",
      execute: () => {
        ModelessDialogManager.openDialog(
          <AccuDrawDialog
            opened={true}
            dialogId={dialogId}
            orientation={Orientation.Horizontal}
            onClose={() => ModelessDialogManager.closeDialog(dialogId)}
          />, dialogId);
      },
    });
  }

  public getMiscGroupItem = (): CommonToolbarItem => {
    const children = ToolbarHelper.constructChildToolbarItems([
      this._accudrawDialogItemVertical, this._accudrawDialogItemHorizontal,
    ]);

    const groupHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
    const item = ToolbarItemUtilities.createGroupButton("SampleApp:buttons.misc", 130, "icon-tools", IModelApp.localization.getLocalizedString("SampleApp:buttons.misc"), children, { isHidden: groupHiddenCondition });
    return item;
  };

  // test ToolbarHelper.createToolbarItemsFromItemDefs
  public additionalVerticalToolbarItems: CommonToolbarItem[] = [this.getMiscGroupItem()];
}
