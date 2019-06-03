/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import * as React from "react";
import { IDisposable, GuidString, Guid, using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionInfo, KeySet, Ruleset } from "@bentley/presentation-common";
import { SelectionHandler, Presentation, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { ViewportProps } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import { IUnifiedSelectionComponent } from "../common/IUnifiedSelectionComponent";
import { HILITE_RULESET } from "@bentley/presentation-frontend/lib/selection/HiliteSetProvider"; // tslint:disable-line: no-direct-imports

/**
 * Props that are injected to the ViewWithUnifiedSelection HOC component.
 * @public
 */
export interface ViewWithUnifiedSelectionProps {
  /**
   * Ruleset or its ID to use when determining viewport selection.
   * @alpha
   * @deprecated This prop has been deprecated. The component expects a very
   * specific ruleset to be used and thus supplying a custom one is not an option
   * anymore. The prop is not used if supplied.
   */
  ruleset?: Ruleset | string;

  /** @internal */
  selectionHandler?: ViewportSelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * viewport component.
 *
 * @public
 */
// tslint:disable-next-line: variable-name naming-convention
export function viewWithUnifiedSelection<P extends ViewportProps>(ViewportComponent: React.ComponentType<P>): React.ComponentType<P & ViewWithUnifiedSelectionProps> {

  type CombinedProps = P & ViewWithUnifiedSelectionProps;

  return class WithUnifiedSelection extends React.PureComponent<CombinedProps> implements IUnifiedSelectionComponent {

    /** @internal */
    public viewportSelectionHandler?: ViewportSelectionHandler;

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(ViewportComponent)})`; }

    /** Get selection handler used by this viewport */
    public get selectionHandler(): SelectionHandler | undefined {
      return this.viewportSelectionHandler ? this.viewportSelectionHandler.selectionHandler : undefined;
    }

    public get imodel() { return this.props.imodel; }

    public get rulesetId() { return HILITE_RULESET.id; }

    public componentDidMount() {
      this.viewportSelectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new ViewportSelectionHandler(this.props.imodel);
    }

    public componentWillUnmount() {
      if (this.viewportSelectionHandler) {
        this.viewportSelectionHandler.dispose();
        this.viewportSelectionHandler = undefined;
      }
    }

    public componentDidUpdate() {
      if (this.viewportSelectionHandler) {
        this.viewportSelectionHandler.imodel = this.props.imodel;
      }
    }

    public render() {
      const {
        ruleset, selectionHandler, // do not bleed our props
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props as any;
      return (
        <ViewportComponent {...props} />
      );
    }

  };
}

/**
 * A handler that syncs selection between unified selection
 * manager (`Presentation.selection`) and a viewport (`imodel.hilited`).
 * It has nothing to do with the viewport component itself - the
 * viewport updates its highlighted elements when `imodel.hilited`
 * changes.
 *
 * @internal
 */
export class ViewportSelectionHandler implements IDisposable {

  private _imodel: IModelConnection;
  private _selectionHandler: SelectionHandler;
  private _lastPendingSelectionChange?: { info: SelectionInfo, selection: Readonly<KeySet> };
  private _isInSelectedElementsRequest = false;
  private _asyncsInProgress = new Set<GuidString>();

  public constructor(imodel: IModelConnection) {
    this._imodel = imodel;

    // handles changing and listening to unified selection
    this._selectionHandler = new SelectionHandler(Presentation.selection,
      `Viewport_${counter++}`, imodel, undefined, this.onUnifiedSelectionChanged);
    this._selectionHandler.manager.setSyncWithIModelToolSelection(imodel, true);

    // stop imodel from syncing tool selection with hilited list - we want
    // to override that behavior
    imodel.hilited.wantSyncWithSelectionSet = false;
  }

  public dispose() {
    this._selectionHandler.manager.setSyncWithIModelToolSelection(this._imodel, false);
    this._selectionHandler.dispose();
  }

  public get selectionHandler() { return this._selectionHandler; }

  public get imodel() { return this._imodel; }
  public set imodel(value: IModelConnection) {
    if (this._imodel === value)
      return;

    this._selectionHandler.manager.setSyncWithIModelToolSelection(this._imodel, false);
    this._selectionHandler.manager.setSyncWithIModelToolSelection(value, true);
    this._imodel = value;
    this._imodel.hilited.wantSyncWithSelectionSet = false;
    this._selectionHandler.imodel = value;
  }

  /** note: used only it tests */
  public get pendingAsyncs() { return this._asyncsInProgress; }

  private async applyUnifiedSelection(imodel: IModelConnection, selectionInfo: SelectionInfo, selection: Readonly<KeySet>) {
    if (this._isInSelectedElementsRequest) {
      this._lastPendingSelectionChange = { info: selectionInfo, selection };
      return;
    }

    const asyncId = Guid.createValue();
    this._asyncsInProgress.add(asyncId);
    this._isInSelectedElementsRequest = true;
    try {
      const ids = await Presentation.selection.getHiliteSet(this._imodel);
      using(Presentation.selection.suspendIModelToolSelectionSync(this._imodel), (_) => {
        imodel.hilited.clear();
        if (ids.models && ids.models.length) {
          imodel.hilited.models.addIds(ids.models);
          imodel.selectionSet.emptyAll();
        }
        if (ids.subCategories && ids.subCategories.length) {
          imodel.hilited.subcategories.addIds(ids.subCategories);
          imodel.selectionSet.emptyAll();
        }
        if (ids.elements && ids.elements.length) {
          imodel.hilited.elements.addIds(ids.elements);
          imodel.selectionSet.replace(ids.elements);
        }
      });
    } finally {
      this._isInSelectedElementsRequest = false;
      this._asyncsInProgress.delete(asyncId);
    }

    if (this._lastPendingSelectionChange) {
      const change = this._lastPendingSelectionChange;
      this._lastPendingSelectionChange = undefined;
      await this.applyUnifiedSelection(imodel, change.info, change.selection);
    }
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
    await this.applyUnifiedSelection(args.imodel, info, selection);
  }
}

let counter = 1;
