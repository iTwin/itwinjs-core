/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import * as React from "react";
import { Id64String, IDisposable, GuidString, Guid } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionInfo, DefaultContentDisplayTypes, KeySet, Ruleset, RegisteredRuleset, ContentFlags } from "@bentley/presentation-common";
import { SelectionHandler, Presentation, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { ViewportProps } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import { IUnifiedSelectionComponent } from "../common/IUnifiedSelectionComponent";
import { ContentDataProvider } from "../common/ContentDataProvider";

// tslint:disable-next-line: no-var-requires
const DEFAULT_RULESET: Ruleset = require("./HiliteRules.json");

/**
 * Props that are injected to the HOC component.
 */
export interface Props {
  /** Ruleset or its ID to use when determining viewport selection. */
  ruleset: Ruleset | string;

  /** @hidden */
  selectionHandler?: ViewportSelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * viewport component.
 */
// tslint:disable-next-line: variable-name naming-convention
export function viewWithUnifiedSelection<P extends ViewportProps>(ViewportComponent: React.ComponentType<P>) {

  type CombinedProps = P & Props;

  return class WithUnifiedSelection extends React.PureComponent<CombinedProps> implements IUnifiedSelectionComponent {

    public static defaultProps = {
      ruleset: DEFAULT_RULESET,
    };

    /** @hidden */
    public viewportSelectionHandler?: ViewportSelectionHandler;

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(ViewportComponent)})`; }

    /** Get selection handler used by this viewport */
    public get selectionHandler(): SelectionHandler | undefined {
      return this.viewportSelectionHandler ? this.viewportSelectionHandler.selectionHandler : undefined;
    }

    public get imodel() { return this.props.imodel; }

    public get rulesetId() { return getRulesetId(this.props.ruleset); }

    public componentDidMount() {
      this.viewportSelectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new ViewportSelectionHandler(this.props.imodel, this.props.ruleset);
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
        this.viewportSelectionHandler.ruleset = this.props.ruleset;
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
  private _ruleset: Ruleset | string;
  private _rulesetRegistration?: RegisteredRuleset;
  private _selectionHandler: SelectionHandler;
  private _selectedElementsProvider: SelectedElementsProvider;
  private _lastPendingSelectionChange?: { info: SelectionInfo, selection: Readonly<KeySet> };
  private _isInSelectedElementsRequest = false;
  private _asyncsInProgress = new Set<GuidString>();

  public constructor(imodel: IModelConnection, ruleset: Ruleset | string) {
    this._imodel = imodel;
    this._ruleset = ruleset;
    const rulesetId = getRulesetId(ruleset);

    // tslint:disable-next-line: no-floating-promises
    this.registerRuleset(ruleset);

    // handles changing and listening to unified selection
    this._selectionHandler = new SelectionHandler(Presentation.selection,
      `Viewport_${counter++}`, imodel, rulesetId, this.onUnifiedSelectionChanged);
    this._selectionHandler.manager.setSyncWithIModelToolSelection(imodel, true);

    // handles querying for elements which should be selected in the viewport
    this._selectedElementsProvider = new SelectedElementsProvider(imodel, rulesetId);
  }

  public dispose() {
    this._selectionHandler.dispose();
    this._selectionHandler.manager.setSyncWithIModelToolSelection(this._imodel, false);
    if (this._rulesetRegistration)
      this._rulesetRegistration.dispose();
    this._ruleset = "";
  }

  private async registerRuleset(ruleset: Ruleset | string) {
    if (typeof ruleset !== "object")
      return;

    const reg = await Presentation.presentation.rulesets().add(ruleset);
    if (this._ruleset !== ruleset)
      reg.dispose();
    else
      this._rulesetRegistration = reg;
  }

  public get selectionHandler() { return this._selectionHandler; }

  public get imodel() { return this._imodel; }
  public set imodel(value: IModelConnection) {
    if (this._imodel === value)
      return;

    this._selectionHandler.manager.setSyncWithIModelToolSelection(this._imodel, false);
    this._selectionHandler.manager.setSyncWithIModelToolSelection(value, true);
    this._imodel = value;
    this._selectionHandler.imodel = value;
    this._selectedElementsProvider.imodel = value;
  }

  public get rulesetId() { return getRulesetId(this._ruleset); }
  public set ruleset(value: Ruleset | string) {
    if (this._rulesetRegistration)
      this._rulesetRegistration.dispose();
    this.registerRuleset(value); // tslint:disable-line: no-floating-promises

    const rulesetId = getRulesetId(value);
    this._ruleset = value;
    this._selectionHandler.rulesetId = rulesetId;
    this._selectedElementsProvider.rulesetId = rulesetId;
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
    const ids = await this._selectedElementsProvider.getElementIds(new KeySet(selection), selectionInfo);
    try {
      imodel.hilited.elements.clear(); // don't call clear on HilitedSet to avoid event firing
      imodel.hilited.setHilite(ids, true);
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

class SelectedElementsProvider extends ContentDataProvider {
  public constructor(imodel: IModelConnection, rulesetId: string) {
    super(imodel, rulesetId, DefaultContentDisplayTypes.VIEWPORT);
  }
  protected shouldConfigureContentDescriptor() { return false; }
  protected getDescriptorOverrides() {
    return {
      ...super.getDescriptorOverrides(),
      contentFlags: ContentFlags.KeysOnly,
    };
  }
  public async getElementIds(keys: KeySet, info: SelectionInfo): Promise<Id64String[]> {
    this.keys = keys;
    this.selectionInfo = info;

    const content = await this.getContent();
    if (!content)
      return [];

    const ids = new Array<Id64String>();
    content.contentSet.forEach((r) => r.primaryKeys.forEach((pk) => ids.push(pk.id)));
    return ids;
  }
}

const getRulesetId = (ruleset: Ruleset | string): string => {
  if (typeof ruleset === "string")
    return ruleset;
  return ruleset.id;
};

let counter = 1;
