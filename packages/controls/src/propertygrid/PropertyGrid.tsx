/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionHandler, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/ecpresentation-frontend";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid as BasePropertyGrid } from "@bentley/ui-components";
import DataProvider from "./DataProvider";

/**
 * Props for the [[PropertyGrid]] control.
 */
export interface Props {
  /** Orientation of properties display. */
  orientation: Orientation;

  /** iModel to pull data from */
  imodel: IModelConnection;

  /** Presentation ruleset to use for creating the content for the control */
  rulesetId: string;

  /** Optional ID for the control. The ID is also used as a selection handler name. */
  id?: string;

  /** Optional custom data provider implementation. */
  dataProvider?: DataProvider;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * Presentation rules -driven property grid control which also participates in
 * unified selection.
 */
export default class PropertyGrid extends React.Component<Props> {

  private _dataProvider: DataProvider;
  private _selectionHandler: SelectionHandler;

  public constructor(props: Props, context?: any) {
    super(props, context);
    const key = props.id ? props.id : `PropertyGrid_${new Date().getTime()}`;
    this._selectionHandler = props.selectionHandler
      ? props.selectionHandler : new SelectionHandler(ECPresentation.selection, key, props.imodel, props.rulesetId);
    this._selectionHandler.onSelect = this.onSelectionChanged;
    this._dataProvider = props.dataProvider
      ? props.dataProvider : new DataProvider(props.imodel, props.rulesetId);
  }

  public componentWillUnmount() {
    this._selectionHandler.dispose();
  }

  public componentWillReceiveProps(nextProps: Props) {
    this._selectionHandler.imodel = nextProps.imodel;
    this._selectionHandler.rulesetId = nextProps.rulesetId;

    this._dataProvider.connection = nextProps.imodel;
    this._dataProvider.rulesetId = nextProps.rulesetId;
  }

  // tslint:disable-next-line:naming-convention
  private onSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider): void => {
    for (let i = evt.level; i >= 0; i--) {
      const selection = selectionProvider.getSelection(this.props.imodel, i);
      const hasSelection = !selection.isEmpty;
      if (hasSelection) {
        this._dataProvider.keys = selection;
        return;
      }
    }
    this._dataProvider.keys = new KeySet();
  }

  /** Get selection handler used by the tree */
  public get selectionHandler(): SelectionHandler { return this._selectionHandler; }

  /** Get data provider of this tree */
  public get dataProvider(): DataProvider { return this._dataProvider; }

  public render() {
    return (
      <BasePropertyGrid
        orientation={this.props.orientation}
        dataProvider={this._dataProvider}
      />
    );
  }
}
