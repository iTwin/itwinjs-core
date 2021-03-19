/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import * as React from "react";
import { KeySet } from "@bentley/presentation-common";
import { Presentation, SelectionChangeEventArgs, SelectionHandler } from "@bentley/presentation-frontend";
import { useDisposable } from "@bentley/ui-core";
import { IPresentationPropertyDataProvider } from "./DataProvider";

const DEFAULT_REQUESTED_CONTENT_INSTANCES_LIMIT = 100;

/**
 * Props for the [[usePropertyDataProviderWithUnifiedSelection]] hook
 * @beta
 */
export interface PropertyDataProviderWithUnifiedSelectionProps {
  /** The data provider used by the property grid. */
  dataProvider: IPresentationPropertyDataProvider;

  /**
   * Maximum number of instances to request content for.
   *
   * When the number of selected instances is higher than this value, `dataProvider.keys` is set to an
   * empty [[KeySet]] and the result of the hook has `isOverLimit = true`.
   *
   * Defaults to `100`.
   */
  requestedContentInstancesLimit?: number;

  /** @internal */
  selectionHandler?: SelectionHandler;
}

/**
 * A React hook that adds unified selection functionality to the provided data provider.
 *
 * @beta
 */
export function usePropertyDataProviderWithUnifiedSelection(props: PropertyDataProviderWithUnifiedSelectionProps) {
  const { dataProvider } = props;
  const { imodel, rulesetId } = dataProvider;
  const name = `PropertyGrid`;
  const requestedContentInstancesLimit = props.requestedContentInstancesLimit ?? DEFAULT_REQUESTED_CONTENT_INSTANCES_LIMIT;

  const [isOverLimit, setIsOverLimit] = React.useState(false);

  const updateDataProviderSelection = React.useCallback((handler: SelectionHandler, selectionLevel?: number) => {
    const selection = getSelectedKeys(handler, selectionLevel);
    if (selection) {
      if (selection.size > requestedContentInstancesLimit) {
        setIsOverLimit(true);
        dataProvider.keys = new KeySet();
      } else {
        setIsOverLimit(false);
        dataProvider.keys = selection;
      }
    }
  }, [requestedContentInstancesLimit, dataProvider]);

  const selectionHandler = useDisposable(React.useCallback(() => {
    // istanbul ignore next
    const handler = props.selectionHandler ??
      new SelectionHandler({ manager: Presentation.selection, name, imodel, rulesetId });
    handler.onSelect = (evt: SelectionChangeEventArgs): void => {
      updateDataProviderSelection(handler, evt.level);
    };
    return handler;
  }, [imodel, rulesetId, name, updateDataProviderSelection, props.selectionHandler]));

  React.useEffect(() => updateDataProviderSelection(selectionHandler),
    [updateDataProviderSelection, selectionHandler]);

  return { isOverLimit };
}

function getSelectedKeys(selectionHandler: SelectionHandler, selectionLevel?: number): KeySet | undefined {
  if (undefined === selectionLevel) {
    const availableLevels = selectionHandler.getSelectionLevels();
    if (0 === availableLevels.length)
      return undefined;
    selectionLevel = availableLevels[availableLevels.length - 1];
  }

  for (let i = selectionLevel; i >= 0; i--) {
    const selection = selectionHandler.getSelection(i);
    if (!selection.isEmpty)
      return new KeySet(selection);
  }
  return new KeySet();
}
