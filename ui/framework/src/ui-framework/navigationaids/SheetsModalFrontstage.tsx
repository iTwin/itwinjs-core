/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import { ModalFrontstageInfo, FrontstageManager } from "../frontstage/FrontstageManager";
import { SearchBox, UiEvent } from "@bentley/ui-core";
import "./SheetsModalFrontstage.scss";
import { UiFramework } from "../UiFramework";
import { SheetData } from "./SheetNavigationAid";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";

/** Data about a sheet card */
export interface CardInfo {
  index: number;
  label: string;
  iconSpec: string;
  isActive: boolean;
  viewId: any;
}

/** Arguments for CardSelectedEvent */
export interface CardSelectedEventArgs {
  id: any;
  index: number;
}

/** Class for CardSelectedEvent */
export class CardSelectedEvent extends UiEvent<CardSelectedEventArgs> { }

/** Modal frontstage displaying sheet information in cards. */
export class SheetsModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("UiFramework:navigationAid.sheetsModalFrontstage");
  private _cards: CardInfo[] = [];
  private _connection: IModelConnection;
  private _currentIndex: number;
  private _searchValue: string = "";

  /**
   * Creates a SheetsModalFrontstage
   * @param sheets Collection of sheets available in SheetNavigationAid
   * @param connection IModelConnection to query for sheet ViewState
   */
  constructor(sheets: SheetData[], connection: IModelConnection, currentIndex: number) {
    this._connection = connection;
    this._currentIndex = currentIndex;
    this._storeSheetsAsCards(sheets);
  }

  /**
   * Gathers card info from available sheets
   * @param sheets SheetData from available sheets
   */
  private _storeSheetsAsCards(sheets: SheetData[]) {
    sheets.forEach((sheet: SheetData, index: number) => {
      this._cards.push({ index, label: sheet.name, iconSpec: "icon-document", viewId: sheet.viewId, isActive: index === this._currentIndex });
    });
  }

  /** Gets set of cards */
  public get content(): React.ReactNode {
    return <CardContainer cards={this._cards} searchValue={this._searchValue} connection={this._connection} />;
  }

  /** Gets components to be placed in the app bar */
  public get appBarRight(): React.ReactNode {
    return (
      <SearchBox placeholder={UiFramework.i18n.translate("UiCore:general.search")} onValueChanged={this._handleSearchValueChanged} valueChangedDelay={250} />
    );
  }

  /** Updates stage based on search value */
  private _handleSearchValueChanged = (value: string): void => {
    this._searchValue = value;
    FrontstageManager.updateModalFrontstage();
  }
}

/** Properties for [[CardContainer]] */
export interface CardContainerProps {
  cards: CardInfo[];
  searchValue: string;
  connection: IModelConnection;
}

/** Displays cards in SheetModalFrontstage */
export class CardContainer extends React.Component<CardContainerProps> {
  private static _cardSelectedEvent: CardSelectedEvent = new CardSelectedEvent();

  /** Get CardSelectedEvent event */
  public static get onCardSelectedEvent(): CardSelectedEvent { return CardContainer._cardSelectedEvent; }

  /** @hidden */
  public render() {
    return (
      <div className="uifw-sheets-scrollview">
        <div className="uifw-sheets-flex-container">
          {
            this.props.cards.map((card: CardInfo, _index: number) => {
              let includeCard = true;
              const iconClassName = (typeof card.iconSpec === "string") ? card.iconSpec : "icon-placeholder";

              if (this.props.searchValue) {
                includeCard = this.contains(card.label, this.props.searchValue);
              }

              if (includeCard) {
                return (
                  <SheetCard key={card.label} label={card.label} index={card.index} iconSpec={iconClassName} isActive={card.isActive} onClick={async () => this._handleCardSelected(card)} />
                );
              }

              return null;
            })
          }
        </div>
      </div>
    );
  }

  /**
   * Determines if string contains a substring
   * @param valueA The string to search through
   * @param valueB The value to search for
   * @return True if valueB can be found in valueA, false otherwise
   */
  private contains(valueA: string, valueB: string): boolean {
    if (!valueA || !valueB)
      return false;

    if (valueB.length > valueA.length)
      return false;

    return valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), 0) !== -1;
  }

  /**
   * Updates view with ViewState for selected card.
   * @param card Data about the sheet card selected.
   */
  private async _handleCardSelected(card: CardInfo) {
    if (IModelApp.viewManager && IModelApp.viewManager.selectedView) {
      const vp = IModelApp.viewManager.selectedView;
      const viewState = await this.props.connection.views.load(card.viewId);
      vp.changeView(viewState);
    }

    card.isActive = true;
    FrontstageManager.closeModalFrontstage();
    CardContainer.onCardSelectedEvent.emit({ id: card.viewId, index: card.index });
  }
}

/** Properties for [[SheetCard]] */
export interface SheetCardProps {
  label: string;
  index: number;
  iconSpec: string;
  isActive: boolean;
  onClick: () => void;
}

/** State for [[SheetCard]] */
export interface SheetCardState {
  isActive: boolean;
  isPressed: boolean;
}

/** Displays information about an individual sheet */
export class SheetCard extends React.Component<SheetCardProps, SheetCardState> {
  constructor(props: SheetCardProps) {
    super(props);
    this.state = { isActive: this.props.isActive, isPressed: false };
  }

  private _onClick = () => {
    this.setState({ isActive: true }, () => this.props.onClick());
  }

  private _onMouseDown = () => {
    this.setState({ isPressed: true });
  }

  private _onMouseLeave = () => {
    if (this.state.isPressed)
      this.setState({ isPressed: false });
  }

  /** @hidden */
  public render() {
    const { label, index, iconSpec } = this.props;

    const className = classnames(
      "sheet-card",
      this.state.isActive && "is-active",
      this.state.isPressed && "is-pressed",
    );

    const iconClassName = classnames(
      "icon",
      (typeof iconSpec === "string") ? iconSpec : "icon-placeholder",
    );

    return (
      <div className={className} onClick={this._onClick} onMouseDown={this._onMouseDown} onMouseLeave={this._onMouseLeave} >
        {label}
        <div className="sheet-image-container">
          <div className={iconClassName} />
        </div >
        <div className="sheet-index">{index + 1}</div>
      </div >
    );
  }
}
