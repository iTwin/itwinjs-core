/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Tray from "@src/toolbar/item/expandable/history/Tray";
import HistoryIcon from "@src/toolbar/item/expandable/history/Icon";
import Panel from "@src/toolbar/item/expandable/group/Panel";
import Group from "@src/toolbar/item/expandable/group/Group";
import Column from "@src/toolbar/item/expandable/group/Column";
import Nested from "@src/toolbar/item/expandable/group/Nested";
import Tool from "@src/toolbar/item/expandable/group/tool/Tool";
import Expander from "@src/toolbar/item/expandable/group/tool/Expander";
import Overflow from "@src/toolbar/item/Overflow";
import Expandable from "@src/toolbar/item/expandable/Expandable";
import Icon from "@src/toolbar/item/Icon";
import Toolbar from "@src/toolbar/Toolbar";
import Scrollable from "@src/toolbar/Scrollable";
import { Direction } from "@src/utilities/Direction";
import Button from "@src/toolbar/button/Button";
import App from "@src/toolbar/button/App";
import Back from "@src/toolbar/button/Back";
import ExpandableButton from "@src/toolbar/button/Expandable";
import IconButton from "@src/toolbar/button/Icon";

export interface State {
  onBackCount: number;
  isPanelVisible: boolean;
  direction: Direction;
}

export const cols2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gridAutoRows: "1fr",
  gridGap: "20px",
  alignItems: "center",
  justifyItems: "center",
};

export default class Tools extends React.Component<{}, State> {
  public readonly state: Readonly<State> = {
    onBackCount: 0,
    isPanelVisible: false,
    direction: Direction.Right,
  };

  private toggleIsPanelVisible = () => {
    this.setState((prevState) => ({
      ...prevState,
      isPanelVisible: !prevState.isPanelVisible,
    }));
  }

  private toggleDirection = () => {
    this.setState((prevState) => {
      let direction = prevState.direction;
      switch (direction) {
        case Direction.Left: {
          direction = Direction.Top;
          break;
        }
        case Direction.Top: {
          direction = Direction.Right;
          break;
        }
        case Direction.Right: {
          direction = Direction.Bottom;
          break;
        }
        case Direction.Bottom: {
          direction = Direction.Left;
          break;
        }
      }
      return {
        ...prevState,
        direction,
      };
    });
  }

  private getToolbarIcons1(direction: Direction) {
    return [
      <Expandable
        key={0}
        history={
          <Tray direction={direction}>
            <HistoryIcon>
              <i className="icon icon-3d-cube" />
            </HistoryIcon>
          </Tray>
        }
      >
        <Icon >
          <i className="icon icon-3d" />
        </Icon >
      </Expandable>,
      <Expandable
        key={1}
        panel={!this.state.isPanelVisible ? undefined :
          <Panel>
            Other Tools
          </Panel>
        }
        history={this.state.isPanelVisible ? undefined :
          <Tray direction={direction}>
            <HistoryIcon>
              <i className="icon icon-3d-cube" />
            </HistoryIcon>
            <HistoryIcon>
              <i className="icon icon-2d" />
            </HistoryIcon>
          </Tray>
        }
      >
        <Icon
          onClick={this.toggleIsPanelVisible}
        >
          <i className="icon icon-2d" />
        </Icon>
      </Expandable>,
      <Icon key={2}>
        <i className="icon icon-3d-cube" />
      </Icon>,
    ];
  }

  private getToolbarIcons2(direction: Direction) {
    return [
      <Icon key={3}>
        <i className="icon icon-angle" />
      </Icon>,
      <Icon key={4}>
        <i className="icon icon-apps-generic" />
      </Icon>,
      <Icon key={5}>
        <i className="icon icon-filter" />
      </Icon>,
      <Icon key={6}>
        <i className="icon icon-find" />
      </Icon>,
      <Icon key={7}>
        <i className="icon icon-flag" />
      </Icon>,
      ...this.getToolbarIcons1(direction),
    ];
  }

  public render() {
    let path = "../";
    for (let i = 0; i < this.state.onBackCount; i++) {
      path = "../" + path;
    }

    const icon = <i className="icon icon-3d-cube" />;
    return (
      <div style={{ padding: "10px" }}>
        <h1>Toolbar</h1>
        <div style={cols2}>
          <Toolbar
            expandsTo={Direction.Left}
          >
            {this.getToolbarIcons1(Direction.Left)}
          </Toolbar>
          <Toolbar>
            {this.getToolbarIcons1(Direction.Bottom)}
          </Toolbar>
          <Toolbar
            expandsTo={Direction.Right}
          >
            {this.getToolbarIcons1(Direction.Right)}
          </Toolbar>
        </div>
        <h1>Overflow</h1>
        <Toolbar
          expandsTo={Direction.Right}
        >
          <Overflow
            key="0"
            onClick={this.toggleIsPanelVisible}
            panel={!this.state.isPanelVisible ? undefined :
              <Panel>
                Other Tools
              </Panel>
            }
          />
        </Toolbar>
        <br />
        <div style={cols2}>
          <Scrollable
            expandsTo={Direction.Left}
          >
            {this.getToolbarIcons2(Direction.Left)}
          </Scrollable>
          <Scrollable>
            {this.getToolbarIcons2(Direction.Bottom)}
          </Scrollable>
          <Scrollable
            expandsTo={Direction.Right}
          >
            {this.getToolbarIcons2(Direction.Right)}
          </Scrollable>
          <Scrollable>
            {this.getToolbarIcons1(Direction.Bottom)}
          </Scrollable>
        </div>
        <h1>Tool Buttons</h1>
        <div style={cols2}>
          <Button>
            Anything here :)
          </Button>
          <IconButton
            icon={
              <i className="icon icon-camera" />
            }
          />
          <App>
            <i className="icon icon-home" />
          </App>
          <Back>
            <i className="icon icon-progress-backward-2" />
          </Back>
          <ExpandableButton
            expanded={
              !this.state.isPanelVisible ? undefined :
                <div style={{ backgroundColor: "teal" }}>
                  Hello world
                </div>
            }
            direction={this.state.direction}
            button={
              <IconButton
                onClick={() => {
                  this.toggleIsPanelVisible();
                  if (!this.state.isPanelVisible)
                    return;
                  this.toggleDirection();
                }}
                icon={
                  <i className="icon icon-camera-animation" />
                }
              />
            }
          />
        </div>
        <h1>Tool Group</h1>
        <Panel>
          Panel with custom content
        </Panel>
        <br />
        <Group
          title="Tool Group"
        >
          <Column>
            <Tool icon={icon} label="Tool1" />
            <Expander icon={icon} label="Expander" />
          </Column>
          <Column>
            <Tool icon={icon} label="Tool3" />
            <Tool icon={icon} label="Tool4" />
          </Column>
        </Group>
        <br />
        <Nested
          title="Nested"
          onBack={() => this.setState((prevState) => ({
            ...prevState,
            onBackCount: prevState.onBackCount + 1,
          }))}
        >
          {path}
        </Nested>
      </div>
    );
  }
}
