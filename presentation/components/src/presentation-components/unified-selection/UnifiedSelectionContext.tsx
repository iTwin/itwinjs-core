/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module UnifiedSelection
 */

import * as React from "react";
import { assert } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Keys, KeySet } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

/**
 * Interface for accessing and modifying Unified Selection whithin React components.
 * @public
 */
export interface UnifiedSelectionContext {
  /** iModel associated with the selection. */
  imodel: IModelConnection;

  /** Default selection level. */
  selectionLevel: number;

  /** Returns current selection. */
  getSelection(level?: number): Readonly<KeySet>;

  /** Adds EC instances to current selection. */
  addToSelection(keys: Keys, level?: number): void;

  /** Removes EC instances from current selection. */
  removeFromSelection(keys: Keys, level?: number): void;

  /** Removes all EC instances from current selection and selects only the specified EC instances. */
  replaceSelection(keys: Keys, level?: number): void;

  /** Removes all EC instances from current selection. */
  clearSelection(level?: number): void;
}

/**
 * Props for Unified Selection context provider.
 * @public
 */
export interface UnifiedSelectionContextProviderProps {
  /** iModel associated with the selection. */
  imodel: IModelConnection;

  /**
   * Specifies the selection level to watch for selection changes. This also becomes the default selection level for
   * [[UnifiedSelectionContext]]. Default value is 0.
   */
  selectionLevel?: number;

  children?: React.ReactNode;
}

/**
 * Unified Selection context provider. It adapts framework-agnostic
 * [Unified Selection]($docs/learning/presentation/Unified-Selection/index.md) API to be better suited for React
 * applications. The context is accessible via [[useUnifiedSelectionContext]].
 * @public
 */
export const UnifiedSelectionContextProvider: React.FC<UnifiedSelectionContextProviderProps> = (props) => {
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
};

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
  return (level) => Presentation.selection.getSelection(imodel, level ?? selectionLevel);
}

const unifiedSelectionContext = React.createContext<UnifiedSelectionContext | undefined>(undefined);

/**
 * Returns Unified Selection context provided by [[UnifiedSelectionContextProvider]].
 * @public
 */
export function useUnifiedSelectionContext(): UnifiedSelectionContext | undefined {
  return React.useContext(unifiedSelectionContext);
}
