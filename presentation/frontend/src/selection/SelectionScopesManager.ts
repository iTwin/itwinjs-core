/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { EntityProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, SelectionScope, RpcRequestsHandler } from "@bentley/presentation-common";

/** Properties for creating [[SelectionScopesManager]] */
export interface SelectionScopesManagerProps {
  /** RPC handler to use for requesting selection scopes */
  rpcRequestsHandler: RpcRequestsHandler;

  /** Provider of active locale to use for localizing scopes */
  localeProvider?: () => string | undefined;
}

/**
 * A manager that knows available [selection scopes]($docs/learning/unified-selection/Terminology#selection-scope)
 * and can compute selection based on [[ElementProps]] and [[SelectionScope]]
 */
export class SelectionScopesManager {

  private _rpcRequestsHandler: RpcRequestsHandler;
  private _getLocale: () => string | undefined;

  public constructor(props: SelectionScopesManagerProps) {
    this._rpcRequestsHandler = props.rpcRequestsHandler;
    this._getLocale = props.localeProvider ? props.localeProvider : (() => undefined);
  }

  public get activeLocale() { return this._getLocale(); }

  /**
   * Get available selection scopes.
   * @param imodel The iModel to get selection scopes for
   * @param locale Optional locale to use when localizing scopes' label and description
   */
  public async getSelectionScopes(imodel: IModelConnection, locale?: string): Promise<SelectionScope[]> {
    if (!locale)
      locale = this._getLocale();
    return this._rpcRequestsHandler.getSelectionScopes({ imodel: imodel.iModelToken, locale });
  }

  /**
   * Computes keys that need to be added to selection based on provided selection scope.
   * @param keys Identifiers of elements to compute selection for
   * @param scope Selection scope to apply
   */
  public async computeSelection(imodel: IModelConnection, keys: EntityProps | EntityProps[], scope: SelectionScope | string): Promise<KeySet> {
    const scopeId = (typeof scope === "string") ? scope : scope.id;
    if (!Array.isArray(keys))
      keys = [keys];

    return this._rpcRequestsHandler.computeSelection({ imodel: imodel.iModelToken }, keys, scopeId);
  }
}
