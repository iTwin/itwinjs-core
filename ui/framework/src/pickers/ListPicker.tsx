/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import Group from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Group";
import Panel from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Panel";
import Column from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Column";
import CommonProps from "@bentley/ui-ninezone/lib/utilities/Props";
import ExpandableItem from "@bentley/ui-ninezone/lib/toolbar/item/expandable/Expandable";
import WithContainInViewport from "@bentley/ui-ninezone/lib/base/WithContainInViewport";
import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";
import * as classnames from "classnames";

import "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/tool/Tool.scss";
import "./ListPicker.scss";

import { UiFramework } from "../UiFramework";

// tslint:disable-next-line:variable-name
const ContainedGroup = WithContainInViewport(Group);

export enum ListItemType {
  Item = 0,
  Seperator = 1,
  Container = 2,
}

export interface ListItem {
  key: any;
  name: string;
  enabled: boolean;
  type: ListItemType;
  children?: ListItem[];
}

export interface ListPickerProps {
  title: string;
  items: ListItem[];
  iconClass?: string;
  setEnabled: (item: ListItem, enabled: boolean) => any;
  onExpanded?: (expand: boolean) => void;
}

export interface ListPickerState {
  expanded: boolean;
}

let lastOpenedPicker: ListPickerBase | undefined;

export interface ListPickerItemProps extends CommonProps {
  key: any;
  isActive?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  label?: string;
}

export class ListPickerItem extends React.Component<ListPickerItemProps> {
  /** Renders ListPickerItem */
  public render() {
    const itemClassName = classnames(
      "ListPicker-item",
      this.props.isActive && "is-active",
      this.props.isFocused && "is-focused",
      this.props.className,
    );

    return (
      <div className={itemClassName} onClick={this.props.onClick}>
        <div className="label">
          {this.props.label}
        </div>
      </div>
    );
  }
}

export interface ExpandableSectionProps extends CommonProps {
  title?: string;
}

export class ExpandableSection extends React.Component<ExpandableSectionProps, any> {
  /** Creates an ExpandableSection */
  constructor(props: ExpandableSectionProps, context: any) {
    super(props, context);
    this.state = { expanded: false };
  }

  /** Renders ExpandableSection */
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-group",
      this.props.className,
    );

    const onClick = () => {
      this.setState(Object.assign({}, this.state, { expanded: !this.state.expanded }));
    };

    const icon = this.state.expanded ? <i className="icon icon-chevron-down" /> : <i className="icon icon-chevron-right" />;

    return (
      <Panel className={className} style={this.props.style} key={this.props.title}>
        <div onClick={onClick} className={this.state.expanded ? "ListPickerInnerContainer-header-expanded" : "ListPickerInnerContainer-header"}>
          <div className="ListPickerInnerContainer-header-content">
            <div className="ListPickerInnerContainer-expander">{icon}</div>
            <div className="ListPickerInnerContainer-title">{this.props.title}</div>
          </div>
        </div>
        {this.state.expanded ?
          <Column>
            {this.props.children}
          </Column> : <div />
        }
      </Panel>
    );
  }
}

/**
 * List picker base class.
 * Used to provide an expandable list of items to enable/disable items.
 */
export class ListPickerBase extends React.Component<ListPickerProps, ListPickerState> {
  /** Creates a ListPickerBase */
  constructor(props: any) {
    super(props);
    this.state = {
      expanded: false,
    };
  }

  private _toggleIsExpanded = () => {
    const expand = !this.state.expanded;

    // Minimize any other list picker that has been opened
    // This is to mimic Bimium's behavior where pickers only close when other pickers are opened
    if (expand) {
      if (lastOpenedPicker && lastOpenedPicker !== this && lastOpenedPicker._toggleIsExpanded())
        lastOpenedPicker!.minimize();

      lastOpenedPicker = this;
    }

    this.setState((_prevState, _props) => {
      return {
        ..._prevState,
        expanded: !_prevState.expanded,
      };
    });

    if (this.props.onExpanded)
      this.props.onExpanded(expand);
  }

  /** Minimizes the expandable component. */
  public minimize = () => {
    this.setState((_prevState, _props) => {
      return {
        ..._prevState,
        expanded: false,
      };
    });
  }

  /** Checks if ExpandableItem is expanded. */
  public isExpanded = () => {
    return this.state.expanded;
  }

  /** Renders ListPickerBase */
  public render() {
    return (
      <ExpandableItem
        {...this.props}
        panel={this.getExpandedContent()}>
        <ToolbarIcon onClick={this._toggleIsExpanded}
          icon={
            <i className={"icon " + (this.props.iconClass ? this.props.iconClass : "icon-list")} />
          }
        />
      </ExpandableItem>
    );
  }

  /** Returns the list with the items */
  public getExpandedContent() {
    if (!this.state.expanded)
      return undefined;

    let listItemToElement: (item: ListItem, itemIndex: number) => any;
    listItemToElement = (item: ListItem, itemIndex: number) => {
      switch (item.type) {
        case ListItemType.Item:
          return (
            <ListPickerItem
              {...this.props}
              key={itemIndex.toString()}
              ref={itemIndex.toString()}
              label={item.name}
              isActive={item.enabled}
              onClick={() => { this.props.setEnabled(item, !item.enabled); }}
            />
          );
        case ListItemType.Seperator:
          return (
            <div key={itemIndex.toString()} className="ListPicker-seperator" />
          );
        case ListItemType.Container:
          if (item.children!.length !== 0) {
            return (
              <ExpandableSection
                key={itemIndex.toString()}
                title={item.name}
                className="ListPickerInnerContainer">
                <Column>
                  {item.children!.map(listItemToElement)}
                </Column>
              </ExpandableSection>
            );
          } else {
            return (<div key={itemIndex.toString()} />);
          }
      }
    };

    return (
      <ContainedGroup
        title={this.props.title}
        className="ListPickerContainer"
        noVerticalContainment={true}
        columns={
          <Column className="ListPicker-column">
            {this.props.items.map(listItemToElement)}
          </Column>}
      />
    );
  }
}

export interface ListPickerPropsExtended extends ListPickerProps {
  enableAllFunc?: () => void;
  disableAllFunc?: () => void;
  invertFunc?: () => void;
}

/**
 * List Picker that lets the user pick from a list of items to enable/disable
 * It also provides options to enable all, disable all and invert selection
 */
export default class ListPicker extends React.Component<ListPickerPropsExtended, any> {
  public static get Key_All() { return -3; }
  public static get Key_None() { return -2; }
  public static get Key_Invert() { return -1; }
  public static get Key_Seperator() { return -4; }

  /** Creates a ListPicker */
  constructor(props: ListPickerPropsExtended) {
    super(props);
    this.state = {
      items: this.createItems(props.items),
    };
  }

  // Creates an array of items containing the separator and special requests (all, none, invert)
  private createItems(items: ListItem[]): ListItem[] {
    const newItems: ListItem[] = [];

    // Create special buttons (All/None/Invert)
    if (this.props.enableAllFunc) {
      let allEnabled = true;
      items.map((item: ListItem) => { allEnabled = allEnabled && item.enabled; });
      newItems.push({ key: ListPicker.Key_All, name: UiFramework.i18n.translate("UiFramework:pickerButtons.all"), enabled: allEnabled, type: ListItemType.Item });
    }
    if (this.props.disableAllFunc) {
      let allDisabled = false;
      items.map((item: ListItem) => { allDisabled = allDisabled || item.enabled; });
      newItems.push({ key: ListPicker.Key_None, name: UiFramework.i18n.translate("UiFramework:pickerButtons.none"), enabled: !allDisabled, type: ListItemType.Item });
    }
    if (this.props.invertFunc) {
      newItems.push({ key: ListPicker.Key_Invert, name: UiFramework.i18n.translate("UiFramework:pickerButtons.invert"), enabled: false, type: ListItemType.Item });
    }
    if (this.props.enableAllFunc || this.props.disableAllFunc || this.props.invertFunc) {
      newItems.push({ key: ListPicker.Key_Seperator, name: UiFramework.i18n.translate("UiFramework:pickerButtons.seperator"), enabled: false, type: ListItemType.Seperator });
    }

    // Push items
    items.map((item) => { newItems.push(item); });
    return newItems;
  }

  /**
   * Checks if item is a special item.
   * @param item Item to check
   */
  public isSpecialItem(item: ListItem) {
    return item.key === ListPicker.Key_All || item.key === ListPicker.Key_Invert || item.key === ListPicker.Key_None || item.type !== ListItemType.Item || item.key === ListPicker.Key_Seperator;
  }

  /** Renders ListPicker */
  public render() {
    const self = this;
    // Handle enabling/disabling the items
    // This will call the this.props.setEnabled function to provide the parent with a chance to process it
    const setEnabled = (item: ListItem, enabled: boolean) => {
      if (self.isSpecialItem(item)) {
        switch (item.key) {
          case ListPicker.Key_All: {
            if (self.props.enableAllFunc)
              self.props.enableAllFunc();
            return;
          }
          case ListPicker.Key_None: {
            if (self.props.disableAllFunc)
              self.props.disableAllFunc();
            return;
          }
          case ListPicker.Key_Invert: {
            if (self.props.invertFunc)
              self.props.invertFunc();
            return;
          }
        }
      }

      // Call on parent to do processing of the item
      self.props.setEnabled(item, enabled);
    };

    return (
      <ListPickerBase
        {...this.props}
        title={this.props.title}
        setEnabled={setEnabled}
        onExpanded={this.props.onExpanded}
        items={this.createItems(this.props.items)}
        iconClass={this.props.iconClass}
      />
    );
  }
}
