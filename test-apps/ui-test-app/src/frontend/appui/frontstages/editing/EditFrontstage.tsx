/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { NodeKey } from "@bentley/presentation-common";
import { CommonToolbarItem, ConditionalBooleanValue, StagePanelLocation, StageUsage, ToolbarItemUtilities } from "@bentley/ui-abstract";
import { SelectionMode } from "@bentley/ui-components";
import {
  BasicNavigationWidget, BasicToolWidget, ContentGroup, ContentLayoutDef, ContentLayoutProps, ContentProps, CoreTools, CustomItemDef, Frontstage,
  FrontstageProvider, IModelConnectedViewSelector, ModelsTreeNodeType, StagePanel, StagePanelHeader, StagePanelState, ToolbarHelper,
  VisibilityComponentHierarchy, VisibilityWidget, Widget, WidgetState, Zone, ZoneLocation, ZoneState,
} from "@bentley/ui-framework";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../../../frontend/index";
import { EditTools } from "../../../tools/editing/ToolSpecifications";
import { AppUi } from "../../AppUi";
// cSpell:Ignore contentviews statusbars
import { IModelViewportControl } from "../../contentviews/IModelViewport";
import { EditStatusBarWidgetControl } from "../../statusbars/editing/EditStatusBar";
import { ActiveSettingsWidget } from "../../widgets/editing/ActiveSettingsWidget";
import { ModelCreationWidget } from "../../widgets/editing/ModelCreationWidget";
import { NavigationTreeWidgetControl } from "../../widgets/NavigationTreeWidget";
import { VisibilityTreeWidgetControl } from "../../widgets/VisibilityTreeWidget";

/* eslint-disable react/jsx-key */

export class EditFrontstage extends FrontstageProvider {
  public static stageId = "EditFrontstage";

  private _additionalTools = new AdditionalTools();

  public static savedViewLayoutProps: string;
  private _leftPanel = {
    widgets: [
      <Widget
        iconSpec="icon-placeholder"
        labelKey="SampleApp:widgets.VisibilityTree"
        control={VisibilityTreeWidgetControl}
      />,
    ],
  };

  private _rightPanel = {
    allowedZones: [2, 6, 9],
  };

  private _bottomPanel = {
    allowedZones: [2, 7],
  };

  constructor(public viewStates: ViewState[], public iModelConnection: IModelConnection) {
    super();
  }

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
    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(this.viewStates.length);
    if (!contentLayoutProps) {
      throw (Error(`Could not find layout ContentLayoutProps when number of viewStates=${this.viewStates.length}`));
    }

    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(contentLayoutProps);

    // create the content props that specifies an iModelConnection and a viewState entry in the application data.
    const contentProps: ContentProps[] = [];
    for (const viewState of this.viewStates) {
      const thisContentProps: ContentProps = {
        classId: IModelViewportControl,
        applicationData: { viewState, iModelConnection: this.iModelConnection },
      };
      contentProps.push(thisContentProps);
    }
    const myContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });
    return (
      <Frontstage id="EditFrontstage"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={contentLayoutDef} contentGroup={myContentGroup}
        isInFooterMode={true} applicationData={{ key: "value" }}
        usage={StageUsage.Edit}
        contentManipulationTools={
          < Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicToolWidget additionalHorizontalItems={this._additionalTools.additionalHorizontalToolbarItems}
                  additionalVerticalItems={this._additionalTools.additionalVerticalToolbarItems} showCategoryAndModelsContextTools={false} />} />,
              ]}
          />
        }
        toolSettings={
          < Zone
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
          < Zone
            widgets={
              [
                <Widget isFreeform={true} element={
                  <BasicNavigationWidget additionalVerticalItems={this._additionalNavigationVerticalToolbarItems} />
                } />,
              ]}
          />
        }
        centerLeft={
          < Zone
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
        centerRight={
          < Zone
            allowsMerging
            defaultState={ZoneState.Minimized}
            initialWidth={350}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} fillZone={true} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VisibilityTree" control={VisibilityTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection }} fillZone={true} />,
              <Widget iconSpec={VisibilityWidget.iconSpec} label={VisibilityWidget.label} control={VisibilityWidget}
                applicationData={{
                  iModelConnection: this.iModelConnection, enableHierarchiesPreloading: [VisibilityComponentHierarchy.Categories], useControlledTree: true,
                  config: { modelsTreeConfig: { selectionMode: SelectionMode.Extended, selectionPredicate: (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element } },
                }}
                fillZone={true} />,
            ]}
          />
        }
        bottomLeft={
          < Zone
            allowsMerging
            defaultState={ZoneState.Minimized}
            initialWidth={450}
            widgets={
              [
              ]}
          />
        }
        statusBar={
          < Zone
            widgets={
              [
                <Widget isStatusBar={true} control={EditStatusBarWidgetControl} />,
              ]}
          />
        }
        bottomRight={
          < Zone defaultState={ZoneState.Minimized} allowsMerging={true} mergeWithZone={ZoneLocation.CenterRight}
            widgets={
              [
              ]}
          />
        }
        leftPanel={
          < StagePanel
            header={< StagePanelHeader
              collapseButton
              collapseButtonTitle="Collapse"
              location={StagePanelLocation.Left}
              title="Visibility tree"
            />}
            defaultState={StagePanelState.Minimized}
            size={280}
            minSize={300}
            maxSize={800}
            widgets={this._leftPanel.widgets}
          />
        }
        rightPanel={
          < StagePanel
            allowedZones={this._rightPanel.allowedZones}
          />
        }
        bottomPanel={
          < StagePanel
            allowedZones={this._bottomPanel.allowedZones}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class AdditionalTools {

  public additionalHorizontalToolbarItems: CommonToolbarItem[] = [
    ToolbarHelper.createToolbarItemFromItemDef(110, CoreTools.keyinBrowserButtonItemDef),
    ToolbarHelper.createToolbarItemFromItemDef(115, EditTools.deleteElementTool),
    ToolbarHelper.createToolbarItemFromItemDef(115, EditTools.moveElementTool),
    ToolbarHelper.createToolbarItemFromItemDef(120, EditTools.placeLineStringTool),
    ToolbarHelper.createToolbarItemFromItemDef(130, EditTools.placeBlockTool),
  ];

  public getMiscGroupItem = (): CommonToolbarItem => {
    const children = ToolbarHelper.constructChildToolbarItems([
    ]);

    const groupHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
    const item = ToolbarItemUtilities.createGroupButton("SampleApp:buttons.misc", 130, "icon-tools", IModelApp.i18n.translate("SampleApp:buttons.misc"), children, { isHidden: groupHiddenCondition });
    return item;
  };

  // test ToolbarHelper.createToolbarItemsFromItemDefs
  public additionalVerticalToolbarItems: CommonToolbarItem[] = [this.getMiscGroupItem()];
}
