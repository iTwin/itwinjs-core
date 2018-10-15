/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import { UiFramework } from "../../UiFramework";
import { NavigationAidControl } from "../NavigationAidControl";
import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { FrontstageManager, ModalFrontstageInfo } from "../FrontstageManager";
import { SheetsModalFrontstage, CardContainer, CardSelectedEventArgs } from "./SheetsModalFrontstage";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend/lib/frontend";

import "./SheetNavigationAid.scss";

/** A Sheet Navigation Aid control. */
export class SheetNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <SheetNavigationAid iModelConnection={options.imodel} />;
  }
}

/** Data displayed about sheet */
export interface SheetData {
  name: string;
  viewId: string;
}

/** @hidden */
export interface SheetNavigationProps {
  iModelConnection: IModelConnection;
}

/** @hidden */
export interface SheetNavigationState {
  index: number;
  sheetData: SheetData[];
  activeSheet: SheetData;
}

/** A Sheet Navigation Aid. */
export class SheetNavigationAid extends React.Component<SheetNavigationProps, SheetNavigationState> {

  public readonly state: Readonly<SheetNavigationState>;
  private _sheetData: SheetData[] = [];
  private _viewport: any;

  constructor(props: any) {
    super(props);
    if (IModelApp && IModelApp.viewManager)
      this._viewport = IModelApp.viewManager.selectedView;
    this.state = {
      index: 0,
      sheetData: [],
      activeSheet: { name: "", viewId: "" },
    };
    this._setupSheets();
  }

  /** Adds listeners when components mounts */
  public componentDidMount() {
    CardContainer.onCardSelectedEvent.addListener(this._handleCardSelected, this);
  }

  /** Removes listeners when component will unmount */
  public componentWillUnmount() {
    CardContainer.onCardSelectedEvent.removeListener(this._handleCardSelected, this);
  }

  /** Querys for sheet info and sets as sheetData */
  private _setupSheets = async () => {
    if (!this.props.iModelConnection.views.getViewList)
      return;

    const sheets = await this.props.iModelConnection.views.getViewList({ from: "BisCore.SheetViewDefinition" });
    sheets.forEach((element: any) => {
      this._sheetData.push({ name: element.name, viewId: element.id });
    });

    this.setState({
      sheetData: this._sheetData,
    });
  }

  /** @hidden */
  public render(): React.ReactNode {
    const name = (this.state.sheetData.length > 0) ? this.state.sheetData[this.state.index].name : "";
    const sheet = UiFramework.i18n.translate("UiFramework:general.sheet");
    const ofStr = UiFramework.i18n.translate("UiFramework:general.of");

    return (
      <div className={"sheet-navigation"}>
        <div className={"gradient"}></div>
        <div className={"sheet-title"}>{sheet}</div>
        <div className={"sheet-name"} onClick={() => this._handleOnClickSheetName()}>{name}</div>
        <div className={"sheet-container"}>
          <div className={"sheet-caret icon icon-caret-left"} onClick={() => this._handleOnClickLeftArrow()} />
          <div>{this.state.index + 1} {ofStr} {this.state.sheetData.length}</div>
          <div className={"sheet-caret icon icon-caret-right"} onClick={() => this._handleOnClickRightArrow()} />
        </div>
      </div>
    );
  }

  /** Sets index of newly selected card */
  private _handleCardSelected = (event: CardSelectedEventArgs) => {
    if (event)
      this.setState({
        index: event.index,
      });
  }

  /** Updates view to the next lowest index in sheetData */
  private _handleOnClickLeftArrow = () => {
    this.setState((_prevState) => (
      { index: this.state.index <= 0 ? this.state.sheetData.length - 1 : this.state.index - 1 }
    ));
    this._updateView();
  }

  /** Updates view to next highest index in sheetData */
  private _handleOnClickRightArrow = async () => {
    this.setState((_prevState) => (
      { index: (this.state.index + 1) % this.state.sheetData.length }
    ));
    this._updateView();
  }

  /** Updates view to currently set sheet */
  private _updateView = async () => {
    const viewState = await this.props.iModelConnection.views.load(this.state.sheetData[this.state.index].viewId);
    if (this._viewport)
      this._viewport.changeView(viewState);
  }

  /** Creates a new SheetsModalFrontstage */
  private modalFrontstage(): ModalFrontstageInfo {
    return new SheetsModalFrontstage(this.state.sheetData, this.props.iModelConnection);
  }

  /** Opens a new SheetsModelFrontstage on sheetName click */
  private _handleOnClickSheetName = () => {
    FrontstageManager.openModalFrontstage(this.modalFrontstage());
  }
}
