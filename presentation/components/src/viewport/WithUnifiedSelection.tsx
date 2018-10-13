/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import * as React from "react";
import { Id64Set, Id64, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection, SelectEventType } from "@bentley/imodeljs-frontend";
import { SelectionInfo, DefaultContentDisplayTypes, KeySet } from "@bentley/presentation-common";
import { SelectionHandler, Presentation, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { ViewportProps } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import IUnifiedSelectionComponent from "../common/IUnifiedSelectionComponent";
import ContentDataProvider from "../common/ContentDataProvider";

/**
 * Props that are injected to the HOC component.
 */
export interface Props {
  /** Id of the ruleset to use when determining viewport selection. */
  rulesetId: string;

  /** @hidden */
  selectionHandler?: ViewportSelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * viewport component.
 */
// tslint:disable-next-line: variable-name naming-convention
export default function withUnifiedSelection<P extends ViewportProps>(ViewportComponent: React.ComponentType<P>): React.ComponentType<P & Props> {

  type CombinedProps = P & Props;

  return class WithUnifiedSelection extends React.Component<CombinedProps> implements IUnifiedSelectionComponent {

    private _selectionHandler?: ViewportSelectionHandler;

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(ViewportComponent)})`; }

    /** Get selection handler used by this property grid */
    public get selectionHandler(): SelectionHandler | undefined {
      return this._selectionHandler ? this._selectionHandler.selectionHandler : undefined;
    }

    public get imodel() { return this.props.imodel; }

    public get rulesetId() { return this.props.rulesetId; }

    public componentDidMount() {
      const imodel = this.props.imodel;
      const rulesetId = this.props.rulesetId;
      this._selectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new ViewportSelectionHandler(imodel, rulesetId);
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

    public render() {
      const {
        rulesetId, selectionHandler, // do not bleed our props
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props as any;
      return (
        <ViewportComponent {...props} />
      );
    }

  };
}

/**
 * @hidden
 */
export class ViewportSelectionHandler implements IDisposable {

  private _imodel: IModelConnection;
  private _rulesetId: string;
  private _selectionHandler: SelectionHandler;
  private _imodelSelectionListenerDisposeFunc: () => void;
  private _selectedElementsProvider: SelectedElementsProvider;
  private _isApplyingUnifiedSelection = false;

  public constructor(imodel: IModelConnection, rulesetId: string) {
    this._imodel = imodel;
    this._rulesetId = rulesetId;

    // handles changing and listening to unified selection
    this._selectionHandler = new SelectionHandler(Presentation.selection,
      `Viewport_${counter++}`, imodel, rulesetId, this.onUnifiedSelectionChanged);

    // `imodel.selectionSet` handles changing and listening to viewport selection
    this._imodelSelectionListenerDisposeFunc = imodel.selectionSet.onChanged.addListener(this.onViewportSelectionChanged);

    // handles querying for elements which should be selected in the viewport
    this._selectedElementsProvider = new SelectedElementsProvider(imodel, rulesetId);
  }

  public dispose() {
    this._selectionHandler.dispose();
    this._imodelSelectionListenerDisposeFunc();
  }

  public get selectionHandler() { return this._selectionHandler; }

  public get imodel() { return this._imodel; }
  public set imodel(value: IModelConnection) {
    this._imodel = value;
    this._selectionHandler.imodel = value;
    this._selectedElementsProvider.connection = value;
    this._imodelSelectionListenerDisposeFunc();
    this._imodelSelectionListenerDisposeFunc = this._imodel.selectionSet.onChanged.addListener(this.onViewportSelectionChanged);
  }

  public get rulesetId() { return this._rulesetId; }
  public set rulesetId(value: string) {
    this._rulesetId = value;
    this._selectionHandler.rulesetId = value;
    this._selectedElementsProvider.rulesetId = value;
  }

  // tslint:disable-next-line:naming-convention
  private onUnifiedSelectionChanged = async (args: SelectionChangeEventArgs, provider: ISelectionProvider): Promise<void> => {
    // this component only cares about its own imodel
    if (args.imodel !== this._imodel)
      return;

    // viewports are only interested in top-level selection changes
    // wip: may want to handle different selection levels?
    if (0 !== args.level)
      return;

    const selection = provider.getSelection(args.imodel, 0);
    const info: SelectionInfo = {
      providerName: args.source,
      level: args.level,
    };
    const ids = await this._selectedElementsProvider.getElementIds(selection, info);
    try {
      this._isApplyingUnifiedSelection = true;
      args.imodel.selectionSet.replace(ids);
    } finally {
      this._isApplyingUnifiedSelection = false;
    }
  }

  // tslint:disable-next-line:naming-convention
  private onViewportSelectionChanged = async (imodel: IModelConnection, eventType: SelectEventType, ids?: Id64Set): Promise<void> => {
    // don't handle the event if we got here due to us changing the selection
    if (this._isApplyingUnifiedSelection)
      return;

    // this component only cares about its own imodel
    if (imodel !== this._imodel)
      return;

    // determine the level of selection changes
    // wip: may want to allow selecting at different levels?
    const selectionLevel = 0;

    // we know what to do immediately on `clear` events
    if (eventType === SelectEventType.Clear) {
      this._selectionHandler.clearSelection(selectionLevel);
      return;
    }

    // we only have element ids, but the library requires instance keys (with
    // class names), so have to query
    const elementProps = ids ? await imodel.elements.getProps(ids) : [];

    // report the change
    switch (eventType) {
      case SelectEventType.Add:
        this._selectionHandler.addToSelection(elementProps, selectionLevel);
        break;
      case SelectEventType.Replace:
        this._selectionHandler.replaceSelection(elementProps, selectionLevel);
        break;
      case SelectEventType.Remove:
        this._selectionHandler.removeFromSelection(elementProps, selectionLevel);
        break;
    }
  }
}

class SelectedElementsProvider extends ContentDataProvider {
  public constructor(imodel: IModelConnection, rulesetId: string) {
    super(imodel, rulesetId, DefaultContentDisplayTypes.VIEWPORT);
  }
  public async getElementIds(keys: Readonly<KeySet>, info: SelectionInfo): Promise<Id64[]> {
    this.keys = keys;
    this.selectionInfo = info;

    const content = await this.getContent();
    if (!content)
      return [];

    const ids = new Array<Id64>();
    content.contentSet.forEach((r) => r.primaryKeys.forEach((pk) => ids.push(pk.id)));
    return ids;
  }
}

let counter = 1;
