/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  FrontstageProps,
  GroupButton,
  ToolButton,
  ToolWidget,
  WidgetState,
  NavigationWidget,
  ContentGroup,
  ModalDialogManager,
  FrontstageProvider,
  Frontstage,
  Zone,
  Widget,
  CoreTools,
  CommandItemDef,
  StagePanel,
  StagePanelState,
} from "@bentley/ui-framework";
import { DialogItemsManager } from "@bentley/ui-abstract";

import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VerticalPropertyGridWidgetControl, HorizontalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { BreadcrumbDemoWidgetControl } from "../widgets/BreadcrumbDemoWidget";
import { TableDemoWidgetControl } from "../widgets/TableDemoWidget";
import { TreeDemoWidgetControl } from "../widgets/TreeDemoWidget";
import { TreeSelectionDemoWidgetControl } from "../widgets/TreeSelectionDemoWidget";

import { Toolbar, Direction } from "@bentley/ui-ninezone";
import { TestModalDialog } from "../dialogs/TestModalDialog";
import { TestModalDialog2 } from "../dialogs/TestModalDialog2";
import { TestUiProviderDialog } from "../dialogs/TestUiProviderDialog";
import { PopupTestDialog } from "../dialogs/PopupTest";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
import { AppTools } from "../../tools/ToolSpecifications";
import { SpinnerTestDialog } from "../dialogs/SpinnerTestDialog";

export class Frontstage4 extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: "CubeContent",
          },
        ],
      },
    );

    return (
      <Frontstage
        id="Test4"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={myContentGroup}
        defaultContentId="TestContent1"
        isInFooterMode={true}
        applicationData={{ key: "value" }}
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
        rightPanel={<StagePanel
          defaultState={StagePanelState.Minimized}
          panelZones={{
            start: {
              widgets: [
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.BreadcrumbDemo" control={BreadcrumbDemoWidgetControl} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TreeDemo" control={TreeDemoWidgetControl} />,
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.TreeSelectionDemo" control={TreeSelectionDemoWidgetControl} />,
              ],
            },
            end: {
              widgets: [
                <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
                <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.HorizontalPropertyGrid" control={HorizontalPropertyGridWidgetControl} />,
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
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec!} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.tool1, AppTools.tool2, AppTools.infoMessageCommand, AppTools.warningMessageCommand, AppTools.errorMessageCommand,
                AppTools.item6, AppTools.item7, AppTools.item8]}
              direction={Direction.Bottom}
              itemsInColumn={4}
            />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId={AppTools.tool1.id} iconSpec={AppTools.tool1.iconSpec!} labelKey={AppTools.tool1.label} execute={AppTools.tool1.execute} />
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec!} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <GroupButton
              labelKey="SampleApp:buttons.anotherGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.tool1, AppTools.tool2, AppTools.item3, AppTools.item4, AppTools.item5,
                AppTools.item6, AppTools.item7, AppTools.item8,
              ]}
              direction={Direction.Right}
            />
            <ToolButton toolId={AppTools.tool2.id} iconSpec={AppTools.tool2.iconSpec!} labelKey={AppTools.tool2.label} execute={AppTools.tool2.execute} />
            <ToolButton toolId={AppTools.addMessageCommand.commandId} iconSpec={AppTools.addMessageCommand.iconSpec!} labelKey={AppTools.addMessageCommand.label} execute={AppTools.addMessageCommand.execute} />
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
      <TestModalDialog
        opened={true}
      />
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
        opened={true} />
    );
  }

  private get _spinnerTestDialogItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.spinnerTestDialog", execute: () => { ModalDialogManager.openDialog(<SpinnerTestDialog opened={true} />); },
    });
  }

  private testUiProviderDialog(): React.ReactNode {
    return (
      <TestUiProviderDialog
        opened={true} itemsManager={new DialogItemsManager()} />
    );
  }
  /** Define a NavigationWidget with Buttons to display in the TopRight zone.
   */
  private getNavigationWidget(): React.ReactNode {

    const horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId={AppTools.item6.id} iconSpec={AppTools.item6.iconSpec!} labelKey={AppTools.item6.label} />
            <ToolButton toolId={AppTools.item5.id} iconSpec={AppTools.item5.iconSpec!} labelKey={AppTools.item5.label} />
            <ToolButton toolId="openDialog" label="open modal" iconSpec="icon-placeholder" execute={() => ModalDialogManager.openDialog(this.modalDialog())} />
            <ToolButton toolId="openDialog2" label="open modal 2" iconSpec="icon-placeholder" execute={() => ModalDialogManager.openDialog(this.modalDialog2())} />
            <ToolButton toolId="openRadial" iconSpec="icon-placeholder" execute={() => ModalDialogManager.openDialog(this.radialMenu())} />
            <ToolButton toolId="popupTest" iconSpec="icon-placeholder" execute={() => ModalDialogManager.openDialog(this.testPopup())} />
            <ToolButton toolId="uiProviderModalTest" iconSpec="icon-placeholder" execute={() => ModalDialogManager.openDialog(this.testUiProviderDialog())} />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar
        expandsTo={Direction.Left}
        items={
          <>
            <ToolButton toolId={AppTools.item8.id} iconSpec={AppTools.item8.iconSpec!} labelKey={AppTools.item8.label} />
            <ToolButton toolId={AppTools.item7.id} iconSpec={AppTools.item7.iconSpec!} labelKey={AppTools.item7.label} />
            <GroupButton
              labelKey="SampleApp:buttons.toolGroup"
              iconSpec="icon-placeholder"
              items={[
                AppTools.successMessageBoxCommand, AppTools.informationMessageBoxCommand, AppTools.questionMessageBoxCommand,
                AppTools.warningMessageBoxCommand, AppTools.errorMessageBoxCommand, AppTools.openMessageBoxCommand, AppTools.openMessageBoxCommand2,
                this._spinnerTestDialogItem,
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
