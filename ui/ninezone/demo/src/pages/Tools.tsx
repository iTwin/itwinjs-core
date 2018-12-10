/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { HistoryPlaceholder } from "@src/toolbar/item/expandable/history/Placeholder";
import { HistoryTray } from "@src/toolbar/item/expandable/history/Tray";
import { HistoryIcon } from "@src/toolbar/item/expandable/history/Icon";
import { PanelPlaceholder } from "@src/toolbar/item/expandable/group/Placeholder";
import { Panel } from "@src/toolbar/item/expandable/group/Panel";
import { Group } from "@src/toolbar/item/expandable/group/Group";
import { GroupColumn } from "@src/toolbar/item/expandable/group/Column";
import { NestedGroup } from "@src/toolbar/item/expandable/group/Nested";
import { GroupTool } from "@src/toolbar/item/expandable/group/tool/Tool";
import { GroupToolExpander } from "@src/toolbar/item/expandable/group/tool/Expander";
import { Overflow } from "@src/toolbar/item/Overflow";
import { ExpandableItem } from "@src/toolbar/item/expandable/Expandable";
import { Item } from "@src/toolbar/item/Icon";
import { Toolbar } from "@src/toolbar/Toolbar";
import { Scrollable } from "@src/toolbar/Scrollable";
import { Direction } from "@src/utilities/Direction";
import { ToolbarButton } from "@src/widget/tools/button/Button";
import { AppButton } from "@src/widget/tools/button/App";
import { BackButton } from "@src/widget/tools/button/Back";
import { ExpandableButton } from "@src/widget/tools/button/Expandable";
import { ToolbarIcon } from "@src/widget/tools/button/Icon";

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

export default class Tools extends React.PureComponent<{}, State> {
  public readonly state: Readonly<State> = {
    onBackCount: 0,
    isPanelVisible: false,
    direction: Direction.Right,
  };

  public render() {
    let path = "../";
    for (let i = 0; i < this.state.onBackCount; i++) {
      path = "../" + path;
    }

    const icon = <i className="icon icon-placeholder" />;
    return (
      <div style={{ padding: "10px" }}>
        <h1>Toolbar</h1>
        <div style={cols2}>
          <Toolbar
            expandsTo={Direction.Left}
            histories={this.getHistories(Direction.Left)}
            items={this.getItems1()}
            panels={this.getPanels()}
          />
          <Toolbar
            histories={this.getHistories(Direction.Bottom)}
            items={this.getItems1()}
            panels={this.getPanels()}
          />
          <Toolbar
            expandsTo={Direction.Right}
            histories={this.getHistories(Direction.Right)}
            items={this.getItems1()}
            panels={this.getPanels()}
          />
        </div>
        <h1>Overflow</h1>
        <Toolbar
          expandsTo={Direction.Right}
          items={
            <Overflow
              onClick={this._handleToggleIsPanelVisible}
            />
          }
          panels={
            !this.state.isPanelVisible ? undefined :
              <Panel>
                Other Tools
              </Panel>
          }
        />
        <br />
        <div style={cols2}>
          <Scrollable
            expandsTo={Direction.Left}
            histories={this.getHistories(Direction.Left)}
            items={this.getItems2()}
            panels={this.getPanels()}
          />
          <Scrollable
            histories={this.getHistories(Direction.Bottom)}
            items={this.getItems2()}
            panels={this.getPanels()}
          />
          <Scrollable
            expandsTo={Direction.Right}
            histories={this.getHistories(Direction.Right)}
            items={this.getItems2()}
            panels={this.getPanels()}
          />
        </div>
        <h1>Tool Buttons</h1>
        <div style={cols2}>
          <ToolbarButton>
            Anything here :)
          </ToolbarButton>
          <ToolbarIcon
            icon={
              <i className="icon icon-placeholder" />
            }
          />
          <AppButton
            icon={
              <i className="icon icon-home" />
            }
          />
          <BackButton
            icon={
              <i className="icon icon-progress-backward-2" />
            }
          />
          <ExpandableButton
            expanded={
              !this.state.isPanelVisible ? undefined :
                <div style={{ backgroundColor: "teal" }}>
                  Hello world
                </div>
            }
            direction={this.state.direction}
            button={
              <ToolbarIcon
                onClick={this._handleExpandableButtonClick}
                icon={
                  <i className="icon icon-placeholder" />
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
          columns={
            <>
              <GroupColumn>
                <GroupTool icon={icon} label="Tool1" />
                <GroupToolExpander icon={icon} label="Expander" />
              </GroupColumn>
              <GroupColumn>
                <GroupTool icon={icon} label="Tool3" />
                <GroupTool icon={icon} label="Tool4" />
              </GroupColumn>
            </>
          }
        />
        <br />
        <NestedGroup
          title="Nested"
          columns={path}
          onBack={this._handleBackClick}
        />
      </div >
    );
  }

  private getItems1() {
    return [
      <ExpandableItem
        key={0}
      >
        <Item
          icon={
            <i className="icon icon-placeholder" />
          }
        />
      </ExpandableItem>,
      <ExpandableItem
        key={1}
        isActive
      >
        <Item
          icon={
            <i className="icon icon-placeholder" />
          }
          isActive
          onClick={this._handleToggleIsPanelVisible}
        />
      </ExpandableItem>,
      <ExpandableItem
        key={2}
        isDisabled
      >
        <Item
          icon={
            <i className="icon icon-placeholder" />
          }
          isDisabled
        />
      </ExpandableItem>,
      <ExpandableItem
        key={3}
        isDisabled
        isActive
      >
        <Item
          icon={
            <i className="icon icon-placeholder" />
          }
          isDisabled
          isActive
        />
      </ExpandableItem>,
      <Item
        key={4}
        icon={
          <i className="icon icon-placeholder" />
        }
        isActive />,
      <Item
        key={5}
        icon={
          <i className="icon icon-placeholder" />
        } />,
    ];
  }

  private getPanels() {
    return (
      <>
        <PanelPlaceholder />
        {!this.state.isPanelVisible ? <PanelPlaceholder /> :
          <PanelPlaceholder>
            <Panel>
              Other Tools
            </Panel>
          </PanelPlaceholder>}
      </>
    );
  }

  private getHistories(direction: Direction) {
    const historyItem = (
      <HistoryIcon>
        <i className="icon icon-placeholder" />
      </HistoryIcon>
    );
    const historyItems = (
      <>
        {historyItem}
        <HistoryIcon
          isActive
        >
          <i className="icon icon-placeholder" />
        </HistoryIcon>
        <HistoryIcon
          isActive
          isDisabled
        >
          <i className="icon icon-placeholder" />
        </HistoryIcon>
      </>
    );
    return (
      <>
        <HistoryPlaceholder />
        <HistoryPlaceholder>
          <HistoryTray
            direction={direction}
            items={historyItem}
          />
        </HistoryPlaceholder>
        {this.state.isPanelVisible ? <HistoryPlaceholder /> :
          <HistoryPlaceholder>
            <HistoryTray
              direction={direction}
              items={historyItems}
            />
          </HistoryPlaceholder>}
        <HistoryPlaceholder>
          <HistoryTray
            direction={direction}
            isExtended
            items={historyItems}
          />
        </HistoryPlaceholder>
        <HistoryPlaceholder />
        <HistoryPlaceholder />
      </>
    );
  }

  private getItems2() {
    return [
      ...this.getItems1(),
      <Item
        key={10}
        icon={
          <i className="icon icon-placeholder" />
        }
      />,
      <Item
        key={11}
        icon={
          <i className="icon icon-placeholder" />
        }
      />,
      <Item
        key={12}
        icon={
          <i className="icon icon-placeholder" />
        }
      />,
    ];
  }

  private _handleToggleIsPanelVisible = () => {
    this.setState((prevState) => ({
      ...prevState,
      isPanelVisible: !prevState.isPanelVisible,
    }));
  }

  private _handleBackClick = () => {
    this.setState((prevState) => ({
      ...prevState,
      onBackCount: prevState.onBackCount + 1,
    }));
  }

  private _handleExpandableButtonClick = () => {
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
        direction: this.state.isPanelVisible ? prevState.direction : direction,
        isPanelVisible: !prevState.isPanelVisible,
      };
    });
  }
}
