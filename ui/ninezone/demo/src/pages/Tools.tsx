/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Panel } from "@src/toolbar/item/expandable/group/Panel";
import { Group } from "@src/toolbar/item/expandable/group/Group";
import { GroupColumn } from "@src/toolbar/item/expandable/group/Column";
import { NestedGroup } from "@src/toolbar/item/expandable/group/Nested";
import { GroupTool } from "@src/toolbar/item/expandable/group/tool/Tool";
import { GroupToolExpander } from "@src/toolbar/item/expandable/group/tool/Expander";
import { Overflow } from "@src/toolbar/item/Overflow";
import { ExpandableItem } from "@src/toolbar/item/expandable/Expandable";
import { Item } from "@src/toolbar/item/Item";
import { Toolbar } from "@src/toolbar/Toolbar";
import { Direction } from "@src/utilities/Direction";
import { ToolbarButton } from "@src/widget/tools/button/Button";
import { AppButton } from "@src/widget/tools/button/App";
import { BackButton } from "@src/widget/tools/button/Back";
import { ExpandableButton } from "@src/widget/tools/button/Expandable";
import { ToolbarIcon } from "@src/widget/tools/button/Icon";
import { Popup, Position as PopupDirection } from "@bentley/ui-core";

interface State {
  direction: PopupDirection;
  expandableButton: HTMLDivElement | null;
  isPanelVisible: boolean;
  onBackCount: number;
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
    direction: PopupDirection.Right,
    expandableButton: null,
    isPanelVisible: false,
    onBackCount: 0,
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
            items={this.getItems1()}
          />
          <Toolbar
            items={this.getItems1()}
          />
          <Toolbar
            expandsTo={Direction.Right}
            items={this.getItems1()}
          />
        </div>
        <h1>Overflow</h1>
        <Toolbar
          expandsTo={Direction.Right}
          items={
            <Overflow
              onClick={this._handleToggleIsPanelVisible}
              panel={
                this.state.isPanelVisible &&
                <Panel>
                  Other Tools
                  </Panel>
              }
            />
          }
        />
        <br />
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
          <div ref={this._handleExpandableButtonRef}>
            <ExpandableButton>
              <ToolbarIcon
                onClick={this._handleExpandableButtonClick}
                icon={
                  <i className="icon icon-placeholder" />
                }
              />
            </ExpandableButton>
          </div>
          <Popup
            isOpen={this.state.isPanelVisible}
            position={this.state.direction}
            target={this.state.expandableButton}
          >
            <div style={{ backgroundColor: "teal" }}>
              Hello world
            </div>
          </Popup>
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
      </div>
    );
  }

  private _handleExpandableButtonRef = (expandableButton: HTMLDivElement | null) => {
    this.setState({ expandableButton });
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
        panel={
          this.state.isPanelVisible &&
          <Panel>
            Other Tools
          </Panel>
        }
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
        case PopupDirection.Left: {
          direction = PopupDirection.Top;
          break;
        }
        case PopupDirection.Top: {
          direction = PopupDirection.Right;
          break;
        }
        case PopupDirection.Right: {
          direction = PopupDirection.Bottom;
          break;
        }
        case PopupDirection.Bottom: {
          direction = PopupDirection.Left;
          break;
        }
      }
      return {
        ...prevState,
        direction: prevState.isPanelVisible ? prevState.direction : direction,
        isPanelVisible: !prevState.isPanelVisible,
      };
    });
  }
}
