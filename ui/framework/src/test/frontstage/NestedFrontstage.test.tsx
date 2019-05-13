/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import TestUtils from "../TestUtils";
import { expect } from "chai";
import {
  Frontstage,
  FrontstageManager,
  FrontstageProvider,
  FrontstageProps,
  ContentLayoutDef,
  Zone,
  Widget,
  ContentGroup,
  ZoneState,
  NestedFrontstage,
  ToolWidget,
  CoreTools,
} from "../../ui-framework";
import { TestFrontstage, TestContentControl, AppStatusBarWidgetControl } from "./FrontstageTestUtils";

class TestNestedFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      {
        id: "SingleContent",
        descriptionKey: "App:ContentLayoutDef.SingleContent",
        priority: 100,
      },
    );

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: TestContentControl,
            applicationData: { label: "Content 1a", bgColor: "black" },
          },
        ],
      },
    );

    return (
      <Frontstage
        id="Test1"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={contentLayoutDef}
        contentGroup={myContentGroup}
        defaultContentId="defaultContentId"
        isInFooterMode={false}
        applicationData={{ key: "value" }}
        topLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true} applicationData={{ key: "value" }}
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />,
            ]}
          />
        }
        topCenter={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        bottomCenter={
          <Zone
            widgets={[
              <Widget id="statusBar" isStatusBar={true} iconSpec="icon-placeholder" labelKey="App:widgets.StatusBar"
                control={AppStatusBarWidgetControl} applicationData={{ key: "value" }} />,
            ]}
          />
        }
      />
    );
  }
}

class FrontstageToolWidget extends React.Component {
  public render() {
    return (
      <ToolWidget
        appButton={NestedFrontstage.backToPreviousFrontstageCommand}
      />
    );
  }
}

describe("NestedFrontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
  });

  it("activeNestedFrontstage should return undefined if none active", () => {
    expect(FrontstageManager.activeNestedFrontstage).to.be.undefined;
    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);
  });

  it("openNestedFrontstage & closeNestedFrontstage should open/close nested frontstages", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    expect(FrontstageManager.activeFrontstageDef).to.eq(frontstageProvider.frontstageDef);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);

    const nestedFrontstageProvider = new TestNestedFrontstage();
    const nestedFrontstageDef = nestedFrontstageProvider.initializeDef();
    await FrontstageManager.openNestedFrontstage(nestedFrontstageDef);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(1);
    expect(FrontstageManager.activeNestedFrontstage).to.eq(nestedFrontstageDef);

    const nestedFrontstageProvider2 = new TestNestedFrontstage();
    const nestedFrontstageDef2 = nestedFrontstageProvider2.initializeDef();
    await FrontstageManager.openNestedFrontstage(nestedFrontstageDef2);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(2);
    expect(FrontstageManager.activeNestedFrontstage).to.eq(nestedFrontstageDef2);

    NestedFrontstage.backToPreviousFrontstageCommand.execute();
    expect(FrontstageManager.nestedFrontstageCount).to.eq(1);

    NestedFrontstage.backToPreviousFrontstageCommand.execute();
    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);

    expect(FrontstageManager.activeFrontstageDef).to.eq(frontstageProvider.frontstageDef);
  });

});
