/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module UnifiedSelection
 */

import memoize from "micro-memoize";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Keys, KeySet } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

/**
 * Interface for accessing and modifying Unified Selection within React components.
 * @beta
 */
export interface UnifiedSelectionContext {
  /** iModel associated with the selection. */
  imodel: IModelConnection;

  /** Default selection level. */
  selectionLevel: number;

  /**
   * Returns current selection. This is a different function each time selection at `selectionLevel` changes. The
   * returned `KeySet` object exposes global data and is mutable. If you need to pass information about the current
   * selection across React components, prefer [[UnifiedSelectionState]] over `KeySet` objects.
   */
  getSelection: UnifiedSelectionState;

  /** Adds keys to current selection. */
  addToSelection(keys: Keys, level?: number): void;

  /** Removes keys from current selection. */
  removeFromSelection(keys: Keys, level?: number): void;

  /** Removes all keys from current selection and selects only the specified keys. */
  replaceSelection(keys: Keys, level?: number): void;

  /** Removes all keys from current selection. */
  clearSelection(level?: number): void;
}

/**
 * Describes how to access the current Unified Selection state. The returned `KeySet` object exposes global data and is
 * mutable.
 * @beta
 */
export type UnifiedSelectionState = (selectionLevel?: number) => Readonly<KeySet>;

/**
 * Props for Unified Selection context provider.
 * @beta
 */
export interface UnifiedSelectionContextProviderProps {
  /** iModel associated with the selection. */
  imodel: IModelConnection;

  /**
   * Specifies the selection level to watch for selection changes. Changes at deeper levels will not trigger context
   * updates. This also becomes the default selection level for [[UnifiedSelectionContext]]. Defaults to `0`.
   */
  selectionLevel?: number;

  /** Child elements. */
  children?: React.ReactNode;
}

/**
 * Unified Selection context provider. It adapts framework-agnostic
 * [Unified Selection]($docs/presentation/Unified-Selection/index.md) API to be better suited for React
 * applications. The provided context is accessible via [[useUnifiedSelectionContext]] hook.
 * @beta
 */
export function UnifiedSelectionContextProvider(props: UnifiedSelectionContextProviderProps): React.ReactElement {
  const selectionLevel = props.selectionLevel ?? 0;

  const contextRef = React.useRef<UnifiedSelectionContext>();
  if (contextRef.current?.imodel !== props.imodel || contextRef.current.selectionLevel !== selectionLevel) {
    contextRef.current = createContext(props.imodel, selectionLevel);
  }

  const [_, setState] = React.useState({});
  React.useEffect(
    () => {
      const currentContext = contextRef.current;
      assert(currentContext !== undefined);
      return Presentation.selection.selectionChange.addListener((args) => {
        if (args.level > currentContext.selectionLevel) {
          return;
        }

        contextRef.current = {
          ...currentContext,
          getSelection: createGetSelection(props.imodel, selectionLevel),
        };

        setState({});
      });
    },
    [props.imodel, selectionLevel],
  );

  return (
    <unifiedSelectionContext.Provider value={contextRef.current}>
      {props.children}
    </unifiedSelectionContext.Provider>
  );
}

function createContext(imodel: IModelConnection, selectionLevel: number): UnifiedSelectionContext {
  return {
    imodel,
    selectionLevel,
    getSelection: createGetSelection(imodel, selectionLevel),
    replaceSelection: (keys, level) => Presentation.selection.replaceSelection(
      "UnifiedSelectionContext",
      imodel,
      keys,
      level ?? selectionLevel,
    ),
    addToSelection: (keys, level) => Presentation.selection.addToSelection(
      "UnifiedSelectionContext",
      imodel,
      keys,
      level ?? selectionLevel,
    ),
    clearSelection: (level) => Presentation.selection.clearSelection(
      "UnifiedSelectionContext",
      imodel,
      level ?? selectionLevel,
    ),
    removeFromSelection: (keys, level) => Presentation.selection.removeFromSelection(
      "UnifiedSelectionContext",
      imodel,
      keys,
      level ?? selectionLevel,
    ),
  };
}

function createGetSelection(imodel: IModelConnection, selectionLevel: number): UnifiedSelectionContext["getSelection"] {
  return memoize(
    (level) => new Proxy(Presentation.selection.getSelection(imodel, level ?? selectionLevel), {}),
    { maxSize: Number.MAX_SAFE_INTEGER },
  );
}

const unifiedSelectionContext = React.createContext<UnifiedSelectionContext | undefined>(undefined);

/**
 * Returns Unified Selection context provided by [[UnifiedSelectionContextProvider]].
 * @beta
 */
export function useUnifiedSelectionContext(): UnifiedSelectionContext | undefined {
  return React.useContext(unifiedSelectionContext);
}
