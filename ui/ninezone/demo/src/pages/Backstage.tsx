/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { BlueButton } from "@bentley/bwc/lib/buttons/BlueButton";
import Backstage from "@src/backstage/Backstage";
import Item from "@src/backstage/Item";
import Separator from "@src/backstage/Separator";

export interface State {
  isOpen: boolean;
  activeItem: number;
}

export default class BackstagePage extends React.Component<{}, State> {
  public readonly state: Readonly<State> = {
    isOpen: false,
    activeItem: 0,
  };

  private getItems() {
    return (
      <>
        <Item
          icon="icon-align-center" // <AlignCenter
          label="Item1"
          isActive={this.state.activeItem === 1}
          onClick={() => this._handleSetActiveItem(1)}
        />
        <Item
          icon="icon-align-align-top"
          label="Item2"
          isActive={this.state.activeItem === 2}
          onClick={() => this._handleSetActiveItem(2)}
          isDisabled
        />
        <Item
          label="Item3"
          isActive={this.state.activeItem === 3}
          onClick={() => this._handleSetActiveItem(3)}
        />
        <Separator />
        <Item
          icon="icon icon-align-align-right"
          label="Item4"
          isActive={this.state.activeItem === 4}
          onClick={() => this._handleSetActiveItem(4)}
        />
        <Item
          icon="icon-align-align-left"
          label="Item5"
          isActive={this.state.activeItem === 5}
          onClick={() => this._handleSetActiveItem(5)}
        />
      </>
    );
  }

  public render() {
    return (
      <>
        <BlueButton
          onClick={this._handleOpenBackstageButtonClick}
        >
          Open
        </BlueButton>
        <Backstage
          isOpen={this.state.isOpen}
          items={this.getItems()}
          onClose={this._handleCloseBackstageItemClick}
        />
      </>
    );
  }

  private _handleOpenBackstageButtonClick = () => {
    this.setIsOpen(true);
  }

  private _handleCloseBackstageItemClick = () => {
    this.setIsOpen(false);
  }

  private _handleSetActiveItem = (activeItem: number) => {
    this.setState((prevState) => {
      return {
        ...prevState,
        activeItem,
      };
    });
  }

  private setIsOpen(isOpen: boolean) {
    this.setState((prevState) => {
      return {
        ...prevState,
        isOpen,
      };
    });
  }
}
