/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64Props } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import SelectionHandler from "./SelectionHandler";

/**
 * Props for [[Viewport]] component.
 */
export interface Props {
  /** iModel to display */
  imodel: IModelConnection;

  /** ID of default view definition which should be displayed */
  viewDefinitionId: Id64Props;

  /**
   * ID of a presentation ruleset used to determine what should
   * get highlighted in the viewport when unified selection changes
   */
  rulesetId: string;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * Viewport component which participates in unified selection.
 */
export default class Viewport extends React.Component<Props> {

  private _selectionHandler?: SelectionHandler;

  private static getSelectionHandlerFromProps(props: Props): SelectionHandler {
    const handler = props.selectionHandler
      ? props.selectionHandler : new SelectionHandler(props.imodel, props.rulesetId);
    return handler;
  }

  public componentDidMount() {
    this._selectionHandler = Viewport.getSelectionHandlerFromProps(this.props);
  }

  public componentWillUnmount() {
    if (this._selectionHandler) {
      this._selectionHandler.dispose();
      this._selectionHandler = undefined;
    }
  }

  public componentDidUpdate() {
    if (this._selectionHandler) {
      this._selectionHandler.imodel = this.props.imodel;
      this._selectionHandler.rulesetId = this.props.rulesetId;
    }
  }

  public get selectionHandler(): SelectionHandler {
    if (!this._selectionHandler)
      throw new Error("Component is not mounted");
    return this._selectionHandler;
  }

  public render() {
    return (<ViewportComponent
      imodel={this.props.imodel}
      viewDefinitionId={this.props.viewDefinitionId}
    />);
  }
}
