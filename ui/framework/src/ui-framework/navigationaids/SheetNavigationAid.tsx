/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import { IModelConnection, IModelApp, ScreenViewport, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { Spinner, SpinnerSize, CommonProps } from "@bentley/ui-core";
import { ViewportComponentEvents, ViewIdChangedEventArgs } from "@bentley/ui-components";

import { UiFramework } from "../UiFramework";
import { ViewUtilities } from "../utils/ViewUtilities";
import { NavigationAidControl } from "./NavigationAidControl";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { FrontstageManager, ModalFrontstageInfo } from "../frontstage/FrontstageManager";
import { SheetsModalFrontstage, CardContainer, CardSelectedEventArgs } from "./SheetsModalFrontstage";

import "./SheetNavigationAid.scss";

/** A Sheet Navigation Aid control.
 * @alpha
 */
export class SheetNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <SheetNavigationAid iModelConnection={options.imodel} />;
  }
  public getSize(): string | undefined { return "96px"; }
}

/** Data displayed about sheet
 * @alpha
 */
export interface SheetData {
  name: string;
  viewId: string;
}

/** Properties for the [[SheetNavigationAid]] component
 * @alpha
 */
export interface SheetNavigationProps extends CommonProps {
  iModelConnection: IModelConnection;
}

/** @internal */
interface SheetNavigationState {
  index: number;
  sheetData: SheetData[];
}

/** A Sheet Navigation Aid.
 * @alpha
 */
export class SheetNavigationAid extends React.Component<SheetNavigationProps, SheetNavigationState> {
  private _isMounted = false;

  /** @internal */
  public readonly state: Readonly<SheetNavigationState> = {
    index: 0,
    sheetData: [],
  };

  private _viewport: ScreenViewport | undefined;

  constructor(props: SheetNavigationProps) {
    super(props);

    this._viewport = IModelApp.viewManager.selectedView;
  }

  /** Adds listeners when components mounts */
  public async componentDidMount() {
    this._isMounted = true;

    CardContainer.onCardSelectedEvent.addListener(this._handleCardSelected);
    ViewportComponentEvents.onViewIdChangedEvent.addListener(this._handleViewIdChanged);

    IModelApp.viewManager.onSelectedViewportChanged.addListener(this._handleSelectedViewportChanged);

    const stateData = await this._setupSheets();

    if (this._isMounted)
      this.setState(stateData);
  }

  /** Removes listeners when component will unmount */
  public componentWillUnmount() {
    this._isMounted = false;

    CardContainer.onCardSelectedEvent.removeListener(this._handleCardSelected);
    ViewportComponentEvents.onViewIdChangedEvent.removeListener(this._handleViewIdChanged);

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

  /** @internal */
  public render(): React.ReactNode {
    const name = (this.state.sheetData.length > 0) ? this.state.sheetData[this.state.index].name : "";
    const sheet = UiFramework.translate("general.sheet");
    const ofStr = UiFramework.translate("general.of");

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
      content = <Spinner size={SpinnerSize.Small} />;
    }

    return (
      <div className={classnames("uifw-sheet-navigation", this.props.className)} style={this.props.style}>
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
    this.setState({ index: this.state.index <= 0 ? this.state.sheetData.length - 1 : this.state.index - 1 }, async () => this._updateView());
  }

  /** Updates view to next highest index in sheetData */
  private _handleOnClickRightArrow = () => {
    this.setState({ index: (this.state.index + 1) % this.state.sheetData.length }, async () => this._updateView());
  }

  /** Handles a Viewport change & synchs the index */
  private _handleSelectedViewportChanged = (args: SelectedViewportChangedArgs) => {
    if (args.current) {
      this._handleViewportChanged(args.current);
    }
  }

  private _handleViewIdChanged = (args: ViewIdChangedEventArgs) => {
    if (this._viewport === args.viewport)
      this._handleViewportChanged(args.viewport as ScreenViewport);
  }

  /** Handles a Viewport change & synchs the index */
  private _handleViewportChanged = (viewport: ScreenViewport) => {
    const className = ViewUtilities.getBisBaseClass(viewport.view.classFullName);

    if (ViewUtilities.isSheet(className)) {
      this._viewport = viewport;

      const viewId = this._viewport.view.id.toString();

      const index = this.state.sheetData.findIndex((sheetData: SheetData) => {
        return (viewId === sheetData.viewId);
      });

      if (index >= 0)
        this.setState({ index });
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
