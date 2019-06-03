/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Picker */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Group, Panel, GroupColumn, ExpandableItem, withContainIn, Item, containHorizontally, Size } from "@bentley/ui-ninezone";
import * as classnames from "classnames";
import { UiFramework } from "../UiFramework";
import "@bentley/ui-ninezone/lib/ui-ninezone/toolbar/item/expandable/group/tool/Tool.scss";
import "./ListPicker.scss";

// tslint:disable-next-line:variable-name
const ContainedGroup = withContainIn(Group);

/** Enum for the list picker item type
 * @beta
 */
export enum ListItemType {
  Item = 0,
  Separator = 1,
  Container = 2,
}

/** List picker item
 * @beta
 */
export interface ListItem {
  [key: string]: any;
  name?: string;
  enabled: boolean;
  type?: ListItemType;
  children?: ListItem[];
}

/** Properties for the [[ListPickerBase]] component
 * @beta
 */
export interface ListPickerProps {
  title: string;
  items: ListItem[];
  iconSpec?: string | React.ReactNode;
  setEnabled: (item: ListItem, enabled: boolean) => any;
  onExpanded?: (expand: boolean) => void;
  onSizeKnown?: (size: Size) => void;
}

/** State for the [[ListPickerBase]] component
 * @internal
 */
interface ListPickerState {
  expanded: boolean;
}

let lastOpenedPicker: ListPickerBase | undefined;

/** Properties for the [[ListPickerItem]] component
 * @beta
 */
export interface ListPickerItemProps extends CommonProps {
  key: any;
  isActive?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  label?: string;
}

/** List Picker Item React component
 * @beta
 */
export class ListPickerItem extends React.PureComponent<ListPickerItemProps> {
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

/** Properties for the [[ExpandableSection]] component
 * @beta
 */
export interface ExpandableSectionProps extends CommonProps {
  title?: string;
}

/** State for the [[ExpandableSection]] component
 * @internal
 */
interface ExpandableSectionState {
  expanded: boolean;
}

/** Expandable Section React component used by [[ListPickerBase]]
 * @beta
 */
export class ExpandableSection extends React.PureComponent<ExpandableSectionProps, ExpandableSectionState> {
  /** Creates an ExpandableSection */
  constructor(props: ExpandableSectionProps) {
    super(props);
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
          <GroupColumn>
            {this.props.children}
          </GroupColumn> : <div />
        }
      </Panel>
    );
  }
}

/**
 * List picker base class.
 * Used to provide an expandable list of items to enable/disable items.
 * @beta
 */
export class ListPickerBase extends React.PureComponent<ListPickerProps, ListPickerState> {
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
    const icon = this.props.iconSpec ? (typeof this.props.iconSpec === "string" ? <i className={"icon " + (this.props.iconSpec)} /> :
      <i className="icon uifw-item-svg-icon">{this.props.iconSpec}</i>) : <i className="icon icon-list" />;

    return (
      <ExpandableItem
        {...this.props}
        panel={this.getExpandedContent()}>
        <Item
          title={this.props.title}
          onClick={this._toggleIsExpanded}
          icon={icon}
          onSizeKnown={this.props.onSizeKnown}
        />
      </ExpandableItem>
    );
  }

  /** Returns the list with the items */
  public getExpandedContent(): React.ReactNode {
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
        case ListItemType.Separator:
          return (
            <div key={itemIndex.toString()} className="ListPicker-separator" />
          );
        case ListItemType.Container:
          if (item.children!.length !== 0) {
            return (
              <ExpandableSection
                key={itemIndex.toString()}
                title={item.name}
                className="ListPickerInnerContainer">
                <GroupColumn>
                  {item.children!.map(listItemToElement)}
                </GroupColumn>
              </ExpandableSection>
            );
          } else {
            return (<div key={itemIndex.toString()} />);
          }
        default:
          return (<div key={itemIndex.toString()} />);
      }
    };

    return (
      <ContainedGroup
        title={this.props.title}
        className="ListPickerContainer"
        containFn={containHorizontally}
        columns={
          <GroupColumn className="ListPicker-column">
            {this.props.items.map(listItemToElement)}
          </GroupColumn>}
      />
    );
  }
}

/** Properties for the [[ListPicker]] component
 * @beta
 */
export interface ListPickerPropsExtended extends ListPickerProps {
  enableAllFunc?: () => void;
  disableAllFunc?: () => void;
  invertFunc?: () => void;
}

/**
 * List Picker that lets the user pick from a list of items to enable/disable
 * It also provides options to enable all, disable all and invert selection
 * @beta
 */
export class ListPicker extends React.Component<ListPickerPropsExtended> {
  public static get Key_All() { return -3; }
  public static get Key_None() { return -2; }
  public static get Key_Invert() { return -1; }
  public static get Key_Separator() { return -4; }

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
      newItems.push({ key: ListPicker.Key_All, name: UiFramework.translate("pickerButtons.all"), enabled: allEnabled, type: ListItemType.Item });
    }
    if (this.props.disableAllFunc) {
      let allDisabled = false;
      items.map((item: ListItem) => { allDisabled = allDisabled || item.enabled; });
      newItems.push({ key: ListPicker.Key_None, name: UiFramework.translate("pickerButtons.none"), enabled: !allDisabled, type: ListItemType.Item });
    }
    if (this.props.invertFunc) {
      newItems.push({ key: ListPicker.Key_Invert, name: UiFramework.translate("pickerButtons.invert"), enabled: false, type: ListItemType.Item });
    }
    if (this.props.enableAllFunc || this.props.disableAllFunc || this.props.invertFunc) {
      newItems.push({ key: ListPicker.Key_Separator, name: UiFramework.translate("pickerButtons.separator"), enabled: false, type: ListItemType.Separator });
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
    return item.key === ListPicker.Key_All || item.key === ListPicker.Key_Invert || item.key === ListPicker.Key_None || item.type !== ListItemType.Item || item.key === ListPicker.Key_Separator;
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
        iconSpec={this.props.iconSpec}
      />
    );
  }
}
