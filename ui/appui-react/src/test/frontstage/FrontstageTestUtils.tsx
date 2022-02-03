/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { StandardContentLayouts, WidgetState } from "@itwin/appui-abstract";
import type {
  ConfigurableCreateInfo, FrontstageProps, StatusBarWidgetControlArgs} from "../../appui-react";
import { ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageProvider,
  MessageCenterField, StatusBarWidgetControl, Widget, WidgetControl, Zone, ZoneLocation, ZoneState,
} from "../../appui-react";
import { ToolItemDef } from "../../appui-react/shared/ToolItemDef";

/* eslint-disable react/jsx-key */

/** @internal */
export class TestContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <div />;
  }
}

/** @internal */
export class TestWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <TestWidgetElement />;
  }
}

/** @internal */
export class TestWidgetElement extends React.Component {
  public override componentDidMount() {
  }

  public override componentWillUnmount() {
  }

  public override render() {
    return <div />;
  }
}

/** @internal */
export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <>
        <MessageCenterField isInFooterMode={isInFooterMode} onOpenWidget={onOpenWidget} openWidget={openWidget} />
      </>
    );
  }
}

/** @internal */
export class TestFrontstage extends FrontstageProvider {
  public static stageId = "TestFrontstage";
  public get id(): string {
    return TestFrontstage.stageId;
  }

  public get defaultToolDef() {
    return new ToolItemDef({
      toolId: "dummy",
      iconSpec: "dummy",
      label: "dummy",
      description: "dummy",
      execute: async () => { },
    });
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
        usage="MyUsage"
        topLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true} applicationData={{ key: "value" }}
            widgets={[
              <Widget isFreeform={true} element={<div />} />,
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
        centerLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="widget3" defaultState={WidgetState.Open} control={TestWidget}
                onWidgetStateChanged={() => { }}
                saveTransientState={() => { }}
                restoreTransientState={() => false} />,
            ]}
          />
        }
        centerRight={
          <Zone defaultState={ZoneState.Open}
            widgets={[
              <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
              <Widget id="widget6_2" element={<div />} />,
            ]}
          />
        }
        bottomLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="widget4" defaultState={WidgetState.Open} control={TestWidget} />,
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
        bottomRight={
          <Zone defaultState={ZoneState.Open} mergeWithZone={ZoneLocation.CenterRight}
            widgets={[
              <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
              <Widget id="widget2" defaultState={WidgetState.Hidden} element={<div />} />,
            ]}
          />
        }
      />
    );
  }
}

/** @internal */
export class TestFrontstage2 extends FrontstageProvider {
  public static stageId = "TestFrontstage2";
  public get id(): string {
    return TestFrontstage2.stageId;
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
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        defaultContentId="defaultContentId"
        isInFooterMode={false}
        applicationData={{ key: "value" }}
        usage="MyUsage"
        contentManipulationTools={
          <Zone defaultState={ZoneState.Open} allowsMerging={true} applicationData={{ key: "value" }}
            widgets={[
              <Widget isFreeform={true} element={<div />} />,
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
        centerLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="widget3" defaultState={WidgetState.Open} control={TestWidget}
                onWidgetStateChanged={() => { }}
                saveTransientState={() => { }}
                restoreTransientState={() => false} />,
            ]}
          />
        }
        centerRight={
          <Zone defaultState={ZoneState.Open}
            widgets={[
              <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
              <Widget id="widget6_2" element={<div />} />,
            ]}
          />
        }
        bottomLeft={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget id="widget4" defaultState={WidgetState.Open} control={TestWidget} />,
            ]}
          />
        }
        statusBar={
          <Zone
            widgets={[
              <Widget id="statusBar" isStatusBar={true} iconSpec="icon-placeholder" labelKey="App:widgets.StatusBar"
                control={AppStatusBarWidgetControl} applicationData={{ key: "value" }} />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Open} mergeWithZone={ZoneLocation.CenterRight}
            widgets={[
              <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
              <Widget id="widget2" defaultState={WidgetState.Hidden} element={<div />} />,
            ]}
          />
        }
      />
    );
  }
}

/** @internal */
export class TestFrontstage3 extends FrontstageProvider {
  public static stageId = "TestFrontstage3";
  public get id(): string {
    return TestFrontstage3.stageId;
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "test-group",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "main", classId: TestContentControl,
          },
        ],
      },
    );

    return (
      <Frontstage
        id={this.id}
        defaultTool={new ToolItemDef({ toolId: "test" })}
        contentGroup={myContentGroup}
        defaultContentId="defaultContentId"
        isInFooterMode={false}
      />
    );
  }
}
