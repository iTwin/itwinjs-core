/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";

import { FrontstageManager, ModalFrontstageInfo } from "../FrontstageManager";
import { ConfigurableCreateInfo } from "../ConfigurableUIControl";
import { NavigationAidControl } from "../NavigationAidControl";
import { SheetsModalFrontstage } from "./SheetsModalFrontstage";

import "./SheetNavigationAid.scss";
import { UiFramework } from "../../UiFramework";

// -----------------------------------------------------------------------------
// Sheet Navigation Aid Control
// -----------------------------------------------------------------------------

/** A Sheet Navigation Aid control.
 */
export class SheetNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <SheetNavigationAid />;
  }
}

export interface DummyData {
  name: string;
}

export interface SheetNavigationState {
  index: number;
  length: number;
  dummyData: DummyData[];
}

/** A Sheet Navigation Aid.
 */
export class SheetNavigationAid extends React.Component<{}, SheetNavigationState> {

  public readonly state: Readonly<SheetNavigationState>;

  constructor(props: any) {
    super(props);
    const dummyData: DummyData[] = [
      { name: "Sheet 1" },
      { name: "Sheet 2" },
      { name: "Sheet 3" },
      { name: "Sheet 4" },
      { name: "Sheet 5" },
      { name: "Sheet 6" },
      { name: "Sheet 7" },
    ];
    this.state = {
      index: 0,
      length: dummyData.length,
      dummyData,
    };

  }

  public render(): React.ReactNode {
    let sheet = "";
    let ofStr = "";
    try {
      sheet = UiFramework.i18n.translate("UiFramework:general.sheet");
      ofStr = UiFramework.i18n.translate("UiFramework:general.of");
    } catch (e) {
      sheet = "Sheet";
      ofStr = "of";
    }
    return (
      <div className={"sheet-navigation"}>
        <div className={"gradient"}></div>
        <div className={"sheet-title"}>{sheet}</div>
        <div className={"sheet-name"} onClick={() => this._handleOnClickSheetName()}>{this.state.dummyData[this.state.index].name}</div>
        <div className={"sheet-container"}>
          <div className={"sheet-caret icon icon-caret-left"} onClick={() => this._handleOnClickLeftArrow()} />
          <div>{this.state.index + 1} {ofStr} {this.state.length}</div>
          <div className={"sheet-caret icon icon-caret-right"} onClick={() => this._handleOnClickRightArrow()} />
        </div>
      </div>
    );
  }

  private _handleOnClickLeftArrow = () => {
    this.setState((_prevState) => (
      { index: this.state.index <= 0 ? this.state.length - 1 : this.state.index - 1 }
    ));
  }

  private _handleOnClickRightArrow = () => {
    this.setState((_prevState) => (
      { index: (this.state.index + 1) % this.state.length }
    ));
  }
  private modalFrontstage(): ModalFrontstageInfo {
    return new SheetsModalFrontstage();
  }
  private _handleOnClickSheetName = () => {
    FrontstageManager.openModalFrontstage(this.modalFrontstage());
  }
}
