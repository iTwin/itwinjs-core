/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import { ModalFrontstageInfo, FrontstageManager } from "../FrontstageManager";
import { SearchBox, UiEvent } from "@bentley/ui-core";
import "./SheetsModalFrontstage.scss";
import { UiFramework } from "../../UiFramework";
import { SheetData } from "./SheetNavigationAid";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend";

/** Data about a sheet card */
export interface CardInfo {
  index: number;
  label: string;
  iconClass: string;
  isActive?: boolean;
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
  private _searchValue: string = "";

  /**
   * Creates a SheetsModalFrontstage
   * @param sheets Collection of sheets available in SheetNavigationAid
   * @param connection IModelConnection to query for sheet ViewState
   */
  constructor(sheets: SheetData[], connection: IModelConnection) {
    this._connection = connection;
    this._storeSheetsAsCards(sheets);
  }

  /**
   * Gathers card info from available sheets
   * @param sheets SheetData from available sheets
   */
  private _storeSheetsAsCards(sheets: SheetData[]) {
    let index = 0;
    sheets.forEach((sheet) => {
      this._cards.push({ index: index++, label: sheet.name, iconClass: "icon-document", viewId: sheet.viewId });
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

/** Props for CardContainer */
interface CardContainerProps {
  cards: CardInfo[];
  searchValue: string;
  connection: IModelConnection;
}

/** Displays cards in SheetModalFrontstage */
export class CardContainer extends React.Component<CardContainerProps> {
  private static _cardSelectedEvent: CardSelectedEvent = new CardSelectedEvent();
  public static get onCardSelectedEvent(): CardSelectedEvent { return CardContainer._cardSelectedEvent; }

  /** @hidden */
  public render() {
    return (
      <div className="sheets-scrollview">
        <div className="sheets-flex-container">
          {
            this.props.cards.map((card: CardInfo, _index: number) => {
              let includeCard = true;

              if (this.props.searchValue) {
                includeCard = this.contains(card.label, this.props.searchValue, false);
              }

              if (includeCard) {
                return (
                  <SheetCard key={card.label} label={card.label} iconClass={card.iconClass} isActive={card.isActive} onClick={() => this._handleCardSelected(card)} />
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
   * @param caseSensitive Flag for if the search should be case sensitive
   * @return True if valueB can be found in valueA, false otherwise
   */
  private contains(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    if (!valueA || !valueB)
      return false;

    if (valueB.length > valueA.length)
      return false;

    if (caseSensitive)
      return valueA.indexOf(valueB, 0) !== -1;

    return valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), 0) !== -1;
  }

  /**
   * Updates view with ViewState for selected card.
   * @param card Data about the sheet card selected.
   */
  private async _handleCardSelected(card: CardInfo) {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return;
    const viewState = await this.props.connection.views.load(card.viewId);
    vp.changeView(viewState);

    card.isActive = true;
    FrontstageManager.closeModalFrontstage();
    CardContainer.onCardSelectedEvent.emit({ id: card.viewId, index: card.index });
  }
}

/** Props for SheetCard */
interface SheetCardProps {
  label: string;
  iconClass: string;
  isActive?: boolean;
  onClick?: () => void;
}

/** Displays information about an individual sheet */
export class SheetCard extends React.Component<SheetCardProps> {
  /** @hidden */
  public render() {
    const { label, iconClass, isActive, onClick } = this.props;

    const className = classnames(
      "sheet-card",
      isActive && "is-active",
    );

    const iconClassName = "icon " + iconClass;

    return (
      <div className={className} onClick={onClick}>
        {label}
        <div className="sheet-image-container">
          <div className={iconClassName} />
        </div>
      </div >
    );
  }
}
