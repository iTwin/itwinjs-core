/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import { UiFramework } from "../../UiFramework";
import { ViewUtilities } from "../../utils/ViewUtilities";
import { NavigationAidControl } from "../NavigationAidControl";
import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { FrontstageManager, ModalFrontstageInfo } from "../FrontstageManager";
import { SheetsModalFrontstage, CardContainer, CardSelectedEventArgs } from "./SheetsModalFrontstage";
import {
  IModelConnection,
  IModelApp,
  ScreenViewport,
  SelectedViewportChangedArgs,
} from "@bentley/imodeljs-frontend/lib/frontend";
import { SmallLoader } from "@bentley/bwc/lib";

import "./SheetNavigationAid.scss";

/** A Sheet Navigation Aid control. */
export class SheetNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <SheetNavigationAid iModelConnection={options.imodel} />;
  }
  public getSize(): string | undefined { return "96px"; }
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
}

/** A Sheet Navigation Aid. */
export class SheetNavigationAid extends React.Component<SheetNavigationProps, SheetNavigationState> {

  /** @hidden */
  public readonly state: Readonly<SheetNavigationState> = {
    index: 0,
    sheetData: [],
  };

  private _viewport: ScreenViewport | undefined;

  constructor(props: SheetNavigationProps) {
    super(props);

    if (IModelApp && IModelApp.viewManager) {
      this._viewport = IModelApp.viewManager.selectedView;
    }
  }

  /** Adds listeners when components mounts */
  public async componentDidMount() {
    CardContainer.onCardSelectedEvent.addListener(this._handleCardSelected);

    if (IModelApp && IModelApp.viewManager)
      IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);

    const stateData = await this._setupSheets();

    this.setState(stateData);
  }

  /** Removes listeners when component will unmount */
  public componentWillUnmount() {
    CardContainer.onCardSelectedEvent.removeListener(this._handleCardSelected);

    if (IModelApp && IModelApp.viewManager)
      IModelApp.viewManager.onSelectedViewportChanged.removeListener(this._handleSelectedViewportChanged);
  }

  /** Queries for sheet info and sets as sheetData */
  private async _setupSheets(): Promise<SheetNavigationState> {
    const stateData: SheetNavigationState = {
      index: 0,
      sheetData: [],
    };

    if (!this.props.iModelConnection || !this.props.iModelConnection.views.getViewList)
      return stateData;

    let viewId = "";
    if (this._viewport) {
      viewId = this._viewport.view.id.toString();
    }

    const sheets = await this.props.iModelConnection.views.getViewList({ from: "BisCore.SheetViewDefinition" });
    sheets.forEach((viewSpec: IModelConnection.ViewSpec, index: number) => {
      stateData.sheetData.push({ name: viewSpec.name, viewId: viewSpec.id });
      if (viewSpec.id === viewId)
        stateData.index = index;
    });

    return stateData;
  }

  /** @hidden */
  public render(): React.ReactNode {
    const name = (this.state.sheetData.length > 0) ? this.state.sheetData[this.state.index].name : "";
    const sheet = UiFramework.i18n.translate("UiFramework:general.sheet");
    const ofStr = UiFramework.i18n.translate("UiFramework:general.of");

    let content: React.ReactNode;
    if (this.state.sheetData.length > 0) {
      content = (
        <>
          <div className="sheet-title">{sheet}</div>
          <div className="sheet-name" title={name} onClick={this._handleOnClickSheetName}>{name}</div>
          <div className="sheet-container">
            <div className="sheet-caret icon icon-caret-left" onClick={this._handleOnClickLeftArrow} />
            <div>{this.state.index + 1} {ofStr} {this.state.sheetData.length}</div>
            <div className="sheet-caret icon icon-caret-right" onClick={this._handleOnClickRightArrow} />
          </div>
        </>
      );
    } else {
      content = <SmallLoader />;
    }

    return (
      <div className="sheet-navigation">
        <div className="gradient"></div>
        {content}
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
    this.setState({ index: this.state.index <= 0 ? this.state.sheetData.length - 1 : this.state.index - 1 }, () => this._updateView());
  }

  /** Updates view to next highest index in sheetData */
  private _handleOnClickRightArrow = () => {
    this.setState({ index: (this.state.index + 1) % this.state.sheetData.length }, () => this._updateView());
  }

  /** Handles a Viewport change & synchs the index */
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current && args.current.view) {
      const className = ViewUtilities.getBisBaseClass(args.current!.view.classFullName);

      if (ViewUtilities.isSheet(className)) {
        this._viewport = args.current;

        if (this._viewport) {
          const viewId = this._viewport.view.id.toString();

          const index = this.state.sheetData.findIndex((sheetData: SheetData) => {
            return (viewId === sheetData.viewId);
          });

          if (index >= 0)
            this.setState({ index });
        }
      }
    }
  }

  /** Updates view to currently set sheet */
  private async _updateView() {
    const viewState = await this.props.iModelConnection.views.load(this.state.sheetData[this.state.index].viewId);
    if (this._viewport)
      this._viewport.changeView(viewState);
  }

  /** Creates a new SheetsModalFrontstage */
  private modalFrontstage(): ModalFrontstageInfo {
    return new SheetsModalFrontstage(this.state.sheetData, this.props.iModelConnection, this.state.index);
  }

  /** Opens a new SheetsModelFrontstage on sheetName click */
  private _handleOnClickSheetName = () => {
    FrontstageManager.openModalFrontstage(this.modalFrontstage());
  }
}
