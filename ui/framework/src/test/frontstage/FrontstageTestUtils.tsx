/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  Frontstage,
  FrontstageProvider,
  FrontstageProps,
  ContentLayoutDef,
  Zone,
  Widget,
  ContentGroup,
  ZoneState,
  ContentControl,
  ConfigurableCreateInfo,
  WidgetState,
  WidgetControl,
  ZoneLocation,
  CoreTools,
  StatusBarWidgetControl,
  MessageCenterField,
  StatusBarWidgetControlArgs,
} from "../../ui-framework";

// tslint:disable: completed-docs

export class TestContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <div />;
  }
}

export class TestWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TestWidgetElement />;
  }
}

export class TestWidgetElement extends React.Component {
  public componentDidMount() {
  }

  public componentWillUnmount() {
  }

  public render() {
    return <div />;
  }
}

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

export class TestFrontstage extends FrontstageProvider {

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
        id="TestFrontstage"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={contentLayoutDef}
        contentGroup={myContentGroup}
        defaultContentId="defaultContentId"
        isInFooterMode={false}
        applicationData={{ key: "value" }}
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
              <Widget id="widget3" defaultState={WidgetState.Open} control={TestWidget} />,
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
