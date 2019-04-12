/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

import * as React from "react";
import { GlobalContextMenu, GlobalContextMenuProps, ContextMenuDivider, ContextMenuItem } from "@bentley/ui-core";
import { ShowHideItem, ShowHideID } from "./ShowHideItem";
import { UiComponents } from "../../UiComponents";
import { ShowHideDialog } from "./ShowHideDialog";

/** Properties for the [[ShowHideMenu]] component
 * @public
 */
export interface ShowHideMenuProps<T extends ShowHideID> extends GlobalContextMenuProps {
  /** key-label pair list for id's to be shown/hidden, and an accompanying label. */
  items: Array<ShowHideItem<T>>;
  /** X position to place menu */
  x: number;
  /** Y position to place menu */
  y: number;
  /** Whether dialog is opened or closed */
  opened: boolean;
  /** Hidden list to start with */
  initialHidden?: T[];
  /** Called when close button is clicked */
  onClose?: () => void;
  /** Called when item is shown/hidden */
  onShowHideChange?: (cols: T[]) => boolean | undefined;
}

/** @internal */
interface ShowHideMenuState<T extends ShowHideID> {
  hiddenColumns: T[];
  dialogOpened: boolean;
}

/**
 * [ContextMenu]($ui-core) Component used to toggle show/hide items, given through items prop, through a list of checkboxes.
 * Component includes a "list" button that displays a dialog with the same checkboxes.
 * @public
 */
export class ShowHideMenu<T extends ShowHideID> extends React.Component<ShowHideMenuProps<T>, ShowHideMenuState<T>> {
  /** @internal */
  public readonly state: ShowHideMenuState<T>;

  /** @internal */
  constructor(props: ShowHideMenuProps<T>) {
    super(props);
    this.state = {
      hiddenColumns: props.initialHidden || [],
      dialogOpened: false,
    };
  }

  /** @internal */
  public componentDidUpdate(oldProps: ShowHideMenuProps<T>) {
    if (this.props.initialHidden && oldProps.initialHidden !== this.props.initialHidden) {
      this.setState({ hiddenColumns: this.props.initialHidden });
    }
  }

  private _toggleItem = (item: ShowHideItem<T>) => {
    if (this.state.hiddenColumns.indexOf(item.id) !== -1)
      this._show(item);
    else
      this._hide(item);
    if (this.props.onClose)
      this.props.onClose();
  }

  private _hide = (item: ShowHideItem<T>) => {
    this.setState({ hiddenColumns: [...this.state.hiddenColumns, item.id] }, () => {
      if (this.props.onShowHideChange)
        this.props.onShowHideChange(this.state.hiddenColumns);
    });
  }

  private _show = (item: ShowHideItem<T>) => {
    const hiddenColumns = this.state.hiddenColumns.filter((value) => {
      return value !== item.id;
    });

    this.setState({ hiddenColumns }, () => {
      if (this.props.onShowHideChange)
        this.props.onShowHideChange(this.state.hiddenColumns);
    });
  }

  private _showAll = () => {
    this.setState({ hiddenColumns: [] }, () => {
      // istanbul ignore next
      if (this.props.onShowHideChange)
        this.props.onShowHideChange(this.state.hiddenColumns);
    });
    if (this.props.onClose)
      this.props.onClose();
  }
  private _showDialog = () => {
    if (this.props.onClose)
      this.props.onClose();
    this.setState({
      dialogOpened: true,
    });
  }

  private _closeDialog = () => {
    this.setState({
      dialogOpened: false,
    });
  }

  private _defaultContextMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
  }

  /** @internal */
  public render(): React.ReactNode {
    const { items, x, y, opened, initialHidden, onClose, onShowHideChange, ...props } = this.props;
    return (
      <GlobalContextMenu
        x={x}
        y={y}
        opened={opened}
        onEsc={onClose}
        onOutsideClick={onClose}
        edgeLimit={false}
        autoflip={true}
        {...props}>
        {this.props.items.map((item, index) => {
          const visible = this.state.hiddenColumns.indexOf(item.id) === -1;
          const sel = () => this._toggleItem(item);
          const label = item.label || UiComponents.i18n.translate("UiComponents:showhide:noLabel");
          const id = "show-hide-menu-input-" + index;
          return (
            <ContextMenuItem key={index}
              onSelect={sel}
              icon={<input type="checkbox" data-testid={id} id={id} checked={visible} onChange={() => undefined} />} >
              {label}
            </ContextMenuItem>
          );
        })}
        <ContextMenuDivider />
        <ContextMenuItem onSelect={this._showAll}><span data-testid="show-hide-showall">{UiComponents.i18n.translate("UiComponents:showhide:showAll")}</span></ContextMenuItem>
        <ContextMenuItem onSelect={this._showDialog}><span data-testid="show-hide-list">{UiComponents.i18n.translate("UiComponents:showhide:list")}</span></ContextMenuItem>
        <ShowHideDialog
          items={items}
          title={UiComponents.i18n.translate("UiComponents:showhide:title")}
          opened={this.state.dialogOpened}
          onClose={this._closeDialog}
          initialHidden={this.state.hiddenColumns}
          onContextMenu={this._defaultContextMenu}
          onShowHideChange={onShowHideChange} />
      </GlobalContextMenu>
    );
  }
}
