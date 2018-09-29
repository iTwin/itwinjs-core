/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import { ModalFrontstageInfo, FrontstageManager } from "../FrontstageManager";
import { SearchBox } from "@bentley/ui-core";
import "./SheetsModalFrontstage.scss";
import { UiFramework } from "../../UiFramework";

interface CardInfo {
  label: string;
  iconClass: string;
  isActive?: boolean;
}

/** Modal frontstage displaying sheet information in cards. */
export class SheetsModalFrontstage implements ModalFrontstageInfo {
  public title: string = "Modal Frontstage Title";
  private _cards: CardInfo[] = [
    { label: "Gist Sheet 1-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 2-A1 Size", iconClass: "icon-document", isActive: true },
    { label: "Gist Sheet 3-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 4-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 5-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 6-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 7-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 8-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 9-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 10-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 11-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 12-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 13-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 14-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 15-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 16-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 17-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 18-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 19-A1 Size", iconClass: "icon-document" },
    { label: "Gist Sheet 20-A1 Size", iconClass: "icon-document" },
  ];

  private _searchValue: string = "";

  public get content(): React.ReactNode {
    return (
      <TestCardContainer cards={this._cards} searchValue={this._searchValue} />
    );
  }

  public get appBarRight(): React.ReactNode {
    return (
      <SearchBox placeholder={UiFramework.i18n.translate("UiCore:general.search")} onValueChanged={this._handleSearchValueChanged} valueChangedDelay={250} />
    );
  }

  private _handleSearchValueChanged = (value: string): void => {
    this._searchValue = value;
    FrontstageManager.updateModalFrontstage();
  }
}

interface TestCardContainerProps {
  cards: CardInfo[];
  searchValue: string;
}

class TestCardContainer extends React.Component<TestCardContainerProps> {
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
                  <TestCard key={card.label} label={card.label} iconClass={card.iconClass} isActive={card.isActive} onClick={() => this.handleCardSelected(card)} />
                );
              }

              return null;
            })
          }
        </div>
      </div>
    );
  }

  private contains(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    if (!valueA || !valueB)
      return false;

    if (valueB.length > valueA.length)
      return false;

    if (caseSensitive)
      return valueA.indexOf(valueB, 0) !== -1;

    return valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), 0) !== -1;
  }

  private handleCardSelected(card: CardInfo) {
    // tslint:disable-next-line:no-console
    console.log("Card selected: " + card.label);

    FrontstageManager.closeModalFrontstage();
  }
}

interface TestCardProps {
  label: string;
  iconClass: string;
  isActive?: boolean;
  onClick?: () => void;
}

class TestCard extends React.Component<TestCardProps> {
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
