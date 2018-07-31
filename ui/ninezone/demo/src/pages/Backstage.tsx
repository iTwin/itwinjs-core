/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import Backstage from "@src/backstage/Backstage";
import Item from "@src/backstage/Item";
import Separator from "@src/backstage/Separator";
import Button from "@src/buttons/Button";
import * as AlignCenter from "!!svg-react-loader!@bentley/svg-icons/icons/align-center.svg";

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
          icon={
            <AlignCenter />
          }
          label="Item1"
          isActive={this.state.activeItem === 1}
          onClick={() => this.handleSetActiveItem(1)}
        />
        <Item
          icon={
            <i className="icon icon-align-justify" />
          }
          label="Item2"
          isActive={this.state.activeItem === 2}
          onClick={() => this.handleSetActiveItem(2)}
        />
        <Item
          label="Item3"
          isActive={this.state.activeItem === 3}
          onClick={() => this.handleSetActiveItem(3)}
        />
        <Separator />
        <Item
          icon={
            <i className="icon icon-align-right" />
          }
          label="Item4"
          isActive={this.state.activeItem === 4}
          onClick={() => this.handleSetActiveItem(4)}
        />
        <Item
          icon={
            <i className="icon icon-align-left" />
          }
          label="Item5"
          isActive={this.state.activeItem === 5}
          onClick={() => this.handleSetActiveItem(5)}
        />
      </>
    );
  }

  public render() {
    return (
      <>
        <Button onClick={this.handleOpenBackstageButtonClick}>
          Open
        </Button>
        <Backstage
          isOpen={this.state.isOpen}
          items={this.getItems()}
          onOverlayClicked={this.handleCloseBackstageItemClick}
        />
      </>
    );
  }

  private handleOpenBackstageButtonClick = () => {
    this.setIsOpen(true);
  }

  private handleCloseBackstageItemClick = () => {
    this.setIsOpen(false);
  }

  private handleSetActiveItem = (activeItem: number) => {
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
