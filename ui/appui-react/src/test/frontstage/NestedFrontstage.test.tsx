/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import {
  ContentGroup, Frontstage, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider, NestedFrontstage,
  ToolItemDef,
  ToolWidget, Widget, Zone, ZoneState,
} from "../../appui-react";
import TestUtils from "../TestUtils";
import { AppStatusBarWidgetControl, TestContentControl, TestFrontstage } from "./FrontstageTestUtils";

class TestNestedFrontstage extends FrontstageProvider {
  public get defaultToolDef() {
    return new ToolItemDef({
      toolId: "dummy",
      iconSpec: "dummy",
      label: "dummy",
      description: "dummy",
      execute: async () => { },
    });
  }

  public static stageId = "Test1";
  public get id(): string {
    return TestNestedFrontstage.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "test-group",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "main",
            classId: TestContentControl,
            applicationData: { label: "Content 1a", bgColor: "black" },
          },
        ],
      },
    );

    return (
      <Frontstage
        id={this.id}
        defaultTool={this.defaultToolDef}
        contentGroup={myContentGroup}
        defaultContentId="defaultContentId"
        isInFooterMode={false}
        applicationData={{ key: "value" }}
        topLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true} applicationData={{ key: "value" }}
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />, // eslint-disable-line react/jsx-key
            ]}
          />
        }
        topCenter={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />, // eslint-disable-line react/jsx-key
            ]}
          />
        }
        bottomCenter={
          <Zone
            widgets={[
              <Widget id="statusBar" isStatusBar={true} iconSpec="icon-placeholder" labelKey="App:widgets.StatusBar" // eslint-disable-line react/jsx-key
                control={AppStatusBarWidgetControl} applicationData={{ key: "value" }} />,
            ]}
          />
        }
      />
    );
  }
}

class FrontstageToolWidget extends React.Component {
  public override render() {
    return (
      <ToolWidget // eslint-disable-line deprecation/deprecation
        appButton={NestedFrontstage.backToPreviousFrontstageCommand}
      />
    );
  }
}

describe("NestedFrontstage", async () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("activeNestedFrontstage should return undefined if none active", () => {
    expect(FrontstageManager.activeNestedFrontstage).to.be.undefined;
    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);
  });

  it("openNestedFrontstage & closeNestedFrontstage should open/close nested frontstages", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageDef.create(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();

    expect(FrontstageManager.activeFrontstageDef).to.eq(frontstageDef);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);

    const nestedFrontstageProvider = new TestNestedFrontstage();
    const nestedFrontstageDef = await FrontstageDef.create(nestedFrontstageProvider);
    const spyActivated = sinon.spy(nestedFrontstageDef, "_onActivated" as any);
    const spyDeactivated = sinon.spy(nestedFrontstageDef, "_onDeactivated" as any);

    await FrontstageManager.openNestedFrontstage(nestedFrontstageDef);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(1);
    expect(FrontstageManager.activeNestedFrontstage).to.eq(nestedFrontstageDef);
    expect(spyActivated.calledOnce).to.be.true;

    const nestedFrontstageProvider2 = new TestNestedFrontstage();
    const nestedFrontstageDef2 = await FrontstageDef.create(nestedFrontstageProvider2);
    await FrontstageManager.openNestedFrontstage(nestedFrontstageDef2);
    expect(FrontstageManager.nestedFrontstageCount).to.eq(2);
    expect(FrontstageManager.activeNestedFrontstage).to.eq(nestedFrontstageDef2);
    expect(spyDeactivated.calledOnce).to.be.true;

    NestedFrontstage.backToPreviousFrontstageCommand.execute();
    await TestUtils.flushAsyncOperations();

    expect(FrontstageManager.nestedFrontstageCount).to.eq(1);

    NestedFrontstage.backToPreviousFrontstageCommand.execute();
    await TestUtils.flushAsyncOperations();

    expect(FrontstageManager.nestedFrontstageCount).to.eq(0);
    expect(FrontstageManager.activeFrontstageDef).to.eq(frontstageDef);
  });

});
