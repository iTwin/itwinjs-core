/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import * as React from "react";
import { KeySet, Subtract } from "@bentley/presentation-common";
import { Presentation, SelectionHandler, SelectionChangeEventArgs } from "@bentley/presentation-frontend";
import { PropertyGridProps } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import IUnifiedSelectionComponent from "../common/IUnifiedSelectionComponent";
import PresentationPropertyDataProvider from "./DataProvider";

/**
 * Props that are injected to the HOC component.
 */
export interface Props {
  /** The data provider used by the property grid. */
  dataProvider: PresentationPropertyDataProvider;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * property grid component.
 *
 * **Note:** it is required for the property grid to use [[PresentationPropertyDataProvider]]
 */
// tslint:disable-next-line: variable-name naming-convention
export default function withUnifiedSelection<P extends PropertyGridProps>(PropertyGridComponent: React.ComponentType<P>): React.ComponentType<Subtract<P, Props> & Props> {

  type CombinedProps = Subtract<P, Props> & Props;

  return class WithUnifiedSelection extends React.Component<CombinedProps> implements IUnifiedSelectionComponent {

    private _selectionHandler?: SelectionHandler;

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(PropertyGridComponent)})`; }

    /** Get selection handler used by this property grid */
    public get selectionHandler(): SelectionHandler | undefined { return this._selectionHandler; }

    /** Get ID of the ruleset used by this unified selection property grid */
    public get rulesetId() { return this.props.dataProvider.rulesetId; }

    /** Get imodel used by this property grid to query property data */
    public get imodel() { return this.props.dataProvider.connection; }

    public componentDidMount() {
      const name = `PropertyGrid_${counter++}`;
      const imodel = this.props.dataProvider.connection;
      const rulesetId = this.props.dataProvider.rulesetId;
      this._selectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new SelectionHandler(Presentation.selection, name, imodel, rulesetId);
      this._selectionHandler!.onSelect = this.onSelectionChanged;
      this.setDataProviderSelection();
    }

    public componentWillUnmount() {
      if (this._selectionHandler)
        this._selectionHandler.dispose();
    }

    public componentDidUpdate() {
      if (this._selectionHandler) {
        this._selectionHandler.imodel = this.props.dataProvider.connection;
        this._selectionHandler.rulesetId = this.props.dataProvider.rulesetId;
      }
    }

    private setDataProviderSelection(selectionLevel?: number): void {
      if (undefined === selectionLevel) {
        const availableLevels = this._selectionHandler!.getSelectionLevels();
        if (0 === availableLevels.length)
          return;
        selectionLevel = availableLevels[availableLevels.length - 1];
      }

      for (let i = selectionLevel; i >= 0; i--) {
        const selection = this._selectionHandler!.getSelection(i);
        const hasSelection = !selection.isEmpty;
        if (hasSelection) {
          this.props.dataProvider.keys = selection;
          return;
        }
      }
      this.props.dataProvider.keys = new KeySet();
    }

    // tslint:disable-next-line:naming-convention
    private onSelectionChanged = (evt: SelectionChangeEventArgs): void => {
      this.setDataProviderSelection(evt.level);
    }

    public render() {
      const {
        selectionHandler, // do not bleed our props
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props as any;
      return (
        <PropertyGridComponent {...props} />
      );
    }
  };
}

let counter = 1;
