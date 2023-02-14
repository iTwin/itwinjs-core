/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import {
  DialogButtonDef, DialogButtonType, DialogItem, DialogItemValue, DialogLayoutDataProvider, DialogPropertyItem, DialogPropertySyncItem,
  PropertyChangeResult, PropertyChangeStatus, PropertyDescription, StandardContentLayouts, StandardTypeNames, WidgetState,
} from "@itwin/appui-abstract";
import {
  ActionItemButton, CommandItemDef, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider, GroupButton,
  NavigationWidget, StagePanel, StagePanelState, ToolButton, ToolWidget, UiFramework, Widget, Zone, ZoneState,
} from "@itwin/appui-react";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { AppTools } from "../../tools/ToolSpecifications";
import { PopupTestDialog } from "../dialogs/PopupTest";
import { SampleModalDialog } from "../dialogs/SampleModalDialog";
import { SampleModelessDialog } from "../dialogs/SampleModelessDialog";
import { SpinnerTestDialog } from "../dialogs/SpinnerTestDialog";
import { TestModalDialog } from "../dialogs/TestModalDialog";
import { TestModalDialog2 } from "../dialogs/TestModalDialog2";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
import { TestReactSelectDialog } from "../dialogs/TestReactSelectDialog";
import { TestUiProvider } from "../dialogs/TestUiProviderDialog";
import { BreadcrumbDemoWidgetControl } from "../widgets/BreadcrumbDemoWidget";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import {
  HorizontalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl2, VerticalPropertyGridWidgetControl,
} from "../widgets/PropertyGridDemoWidget";
import { TableDemoWidgetControl } from "../widgets/TableDemoWidget";
import { TreeSelectionDemoWidgetControl } from "../widgets/TreeSelectionDemoWidget";

/* eslint-disable react/jsx-key, deprecation/deprecation */

class DynamicModalUiDataProvider extends DialogLayoutDataProvider {
  public currentPageIndex = 0;
  public numberOfPages = 2;
  public static userPropertyName = "username";
  private static _getUserDescription = (): PropertyDescription => {
    return {
      name: DynamicModalUiDataProvider.userPropertyName,
      displayLabel: "User",
      typename: StandardTypeNames.String,
    };
  };

  private _userValue: DialogItemValue = { value: "unknown" };
  private get user(): string {
    return this._userValue.value as string;
  }
  private set user(option: string) {
    this._userValue.value = option;
  }

  public static cityPropertyName = "city";
  private static _getCityDescription = (): PropertyDescription => {
    return {
      name: DynamicModalUiDataProvider.cityPropertyName,
      displayLabel: "City",
      typename: StandardTypeNames.String,
    };
  };

  private _cityValue: DialogItemValue = { value: "unknown" };
  private get city(): string {
    return this._cityValue.value as string;
  }
  private set city(option: string) {
    this._cityValue.value = option;
  }

  // called to apply a single property value change.
  public override applyUiPropertyChange = (updatedValue: DialogPropertySyncItem): void => {
    this.processChangesInUi([updatedValue]);
  };

  /** Called by UI to inform data provider of changes.  */
  public override processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
    if (properties.length > 0) {
      for (const prop of properties) {
        if (prop.propertyName === DynamicModalUiDataProvider.userPropertyName) {
          this.user = prop.value.value ? prop.value.value as string : "";
          continue;
        } else if (prop.propertyName === DynamicModalUiDataProvider.cityPropertyName) {
          this.city = prop.value.value ? prop.value.value as string : "";
          continue;
        }
      }
    }

    this.fireDialogButtonsReloadEvent();
    return { status: PropertyChangeStatus.Success };
  }

  /** Used Called by UI to request available properties when UI is manually created. */
  public override supplyDialogItems(): DialogItem[] | undefined {
    const items: DialogItem[] = [];

    items.push({ value: this._userValue, property: DynamicModalUiDataProvider._getUserDescription(), editorPosition: { rowPriority: 1, columnIndex: 1 } });
    if (this.currentPageIndex > 0) {
      items.push({ value: this._cityValue, property: DynamicModalUiDataProvider._getCityDescription(), editorPosition: { rowPriority: 2, columnIndex: 1 } });
    }
    return items;
  }

  public handleNext = () => {
    if (this.currentPageIndex < this.numberOfPages) {
      this.currentPageIndex++;
      this.reloadDialogItems();
    }
  };

  public handlePrevious = () => {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.reloadDialogItems();
    }
  };

  public override supplyButtonData(): DialogButtonDef[] | undefined {
    const buttons: DialogButtonDef[] = [];

    if (this.currentPageIndex > 0 && this.currentPageIndex < this.numberOfPages)
      buttons.push({ type: DialogButtonType.Previous, onClick: this.handlePrevious });

    if (this.currentPageIndex < this.numberOfPages - 1)
      buttons.push({ type: DialogButtonType.Next, onClick: this.handleNext });

    if (this.currentPageIndex === this.numberOfPages - 1) {
      buttons.push({ type: DialogButtonType.OK, onClick: () => { }, disabled: (this.user === "unknown" || this.city === "unknown") });
    }

    buttons.push({ type: DialogButtonType.Cancel, onClick: () => { } });
    return buttons;
  }
}

export class Frontstage4 extends FrontstageProvider {
  public static stageId = "ui-test-app:Test4";

  public get id(): string {
    return Frontstage4.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "CubeContent",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "navigationCube",
            classId: "CubeContent",
          },
        ],
      },
    );

    return (
      <Frontstage
        id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        defaultContentId="TestContent1"
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={this.getToolWidget()} />,
            ]}
          />
        }
        toolSettings={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={this.getNavigationWidget()} />,
            ]}
          />
        }
        centerRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={false}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.BreadcrumbDemo" control={BreadcrumbDemoWidgetControl} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TreeSelectionDemo" control={TreeSelectionDemoWidgetControl} />,
            ]}
          />
        }
        rightPanel={<StagePanel
          defaultState={StagePanelState.Minimized}
          panelZones={{
            start: {
              widgets: [
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.BreadcrumbDemo" control={BreadcrumbDemoWidgetControl} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TreeSelectionDemo" control={TreeSelectionDemoWidgetControl} />,
              ],
            },
            end: {
              widgets: [
                <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
                <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl2} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TableDemo" control={TableDemoWidgetControl} />,
              ],
            },
          }}
        />}
        statusBar={
          <Zone
            widgets={[
              <Widget isStatusBar={true} classId="SmallStatusBar" />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TableDemo" control={TableDemoWidgetControl} />,
            ]}
          />
        }
      />
    );
  }

  /** Define a ToolWidget with Buttons to display in the TopLeft zone. */
  private getToolWidget(): React.ReactNode {
    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.tool1, AppTools.tool2, AppTools.infoMessageCommand, AppTools.warningMessageCommand, AppTools.errorMessageCommand, AppTools.noIconMessageCommand,
                AppTools.item6, AppTools.item7, AppTools.item8]}
              direction={Direction.Bottom}
              itemsInColumn={5}
            />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId={AppTools.tool1.id} iconSpec={AppTools.tool1.iconSpec} labelKey={AppTools.tool1.label} execute={AppTools.tool1.execute} />
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.anotherGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.tool1, AppTools.tool2, AppTools.item3, AppTools.item4, AppTools.item5,
                AppTools.item6, AppTools.item7, AppTools.item8,
              ]}
              direction={Direction.Right}
            />
            <ActionItemButton actionItem={AppTools.activityMessageItem} />
            <ToolButton toolId={AppTools.addMessageCommand.commandId} iconSpec={AppTools.addMessageCommand.iconSpec} labelKey={AppTools.addMessageCommand.label}
              execute={AppTools.addMessageCommand.execute} />
          </>
        }
      />;

    return (
      <ToolWidget
        appButton={AppTools.backstageToggleCommand}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }

  private modalDialog(): React.ReactNode {
    return (
      <TestModalDialog />
    );
  }

  private modalDialog2(): React.ReactNode {
    return (
      <TestModalDialog2
        opened={true}
      />
    );
  }

  private testPopup(): React.ReactNode {
    return (
      <PopupTestDialog
        opened={true}
      />
    );
  }

  private radialMenu(): React.ReactNode {
    return (
      <TestRadialMenu
        opened={true} onClose={this._closeModal} />
    );
  }

  private _closeModal = () => {
    UiFramework.dialogs.modal.close();
  };

  private get _spinnerTestDialogItem() {
    const id = "spinners";
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.spinnerTestDialog",
      execute: () => { UiFramework.dialogs.modeless.open(<SpinnerTestDialog opened={true} onClose={() => UiFramework.dialogs.modeless.close(id)} />, id); },
    });
  }

  private get _sampleModelessDialogItem() {
    const dialogId = "sample";
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.sampleModelessDialog",
      execute: () => {
        UiFramework.dialogs.modeless.open(
          <SampleModelessDialog
            dialogId={dialogId}
            onClose={() => this._handleModelessClose(dialogId)}
          />, dialogId);
      },
    });
  }

  private _handleModelessClose = (dialogId: string) => {
    UiFramework.dialogs.modeless.close(dialogId);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Closed modeless dialog: ${dialogId}`));
  };

  private get _sampleModalDialogItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder",
      labelKey: "SampleApp:buttons.sampleModalDialog",
      // eslint-disable-next-line no-console
      execute: () => {
        UiFramework.dialogs.modal.open(
          <SampleModalDialog
            onResult={(result) => this._handleModalResult(result)}
          />);
      },
    });
  }

  private _handleModalResult(result: DialogButtonType) {
    UiFramework.dialogs.modal.close();
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Modal dialog result: ${result}`));
  }

  private handleOpenUiProviderDialogModal = () => {
    IModelApp.uiAdmin.openDialog(new TestUiProvider(), "Test UiProvider", true, "TestUiProvider", {
      movable: true,
      width: "auto",
    });
  };

  private testReactSelectDialog(): React.ReactNode {
    return (
      <TestReactSelectDialog
        opened={true} />
    );
  }

  private handleOpenDynamicModal = () => {
    IModelApp.uiAdmin.openDialog(new DynamicModalUiDataProvider(), "Dynamic Model", true, "SampleApp:DynamicModal", {
      movable: true, width: 280, minWidth: 280,
    });
  };

  /** Define a NavigationWidget with Buttons to display in the TopRight zone.
   */
  private getNavigationWidget(): React.ReactNode {

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId={AppTools.item6.id} iconSpec={AppTools.item6.iconSpec} labelKey={AppTools.item6.label} />
            <ToolButton toolId={AppTools.item5.id} iconSpec={AppTools.item5.iconSpec} labelKey={AppTools.item5.label} />
            <ToolButton toolId="openDialog" label="open modal" iconSpec="icon-placeholder" execute={() => UiFramework.dialogs.modal.open(this.modalDialog())} />
            <ToolButton toolId="openDialog2" label="open modal 2" iconSpec="icon-placeholder" execute={() => UiFramework.dialogs.modal.open(this.modalDialog2())} />
            <ToolButton toolId="openDynamicModal" label="open dynamic modal" iconSpec="icon-tools" execute={this.handleOpenDynamicModal} />
            <ToolButton toolId="openRadial" iconSpec="icon-placeholder" execute={() => UiFramework.dialogs.modal.open(this.radialMenu())} />
            <ToolButton toolId="popupTest" iconSpec="icon-placeholder" execute={() => UiFramework.dialogs.modal.open(this.testPopup())} />
            <ToolButton toolId="uiProviderModalTest" iconSpec="icon-placeholder" execute={this.handleOpenUiProviderDialogModal} />
            <ToolButton toolId="reactSelectModalTest" iconSpec="icon-lightbulb" execute={() => UiFramework.dialogs.modal.open(this.testReactSelectDialog())} />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Left}
        items={
          <>
            <ToolButton toolId={AppTools.item8.id} iconSpec={AppTools.item8.iconSpec} labelKey={AppTools.item8.label} />
            <ToolButton toolId={AppTools.item7.id} iconSpec={AppTools.item7.iconSpec} labelKey={AppTools.item7.label} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.noIconMessageBoxCommand, AppTools.successMessageBoxCommand, AppTools.informationMessageBoxCommand, AppTools.questionMessageBoxCommand,
                AppTools.warningMessageBoxCommand, AppTools.errorMessageBoxCommand, AppTools.openMessageBoxCommand, AppTools.openMessageBoxCommand2,
                this._spinnerTestDialogItem,
                this._sampleModelessDialogItem,
                this._sampleModalDialogItem,
              ]}
              direction={Direction.Left}
              itemsInColumn={7}
            />
          </>
        }
      />;

    return (
      <NavigationWidget
        navigationAidId="CubeNavigationAid"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}
