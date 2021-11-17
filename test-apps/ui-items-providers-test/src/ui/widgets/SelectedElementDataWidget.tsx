/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useActiveFrontstageDef } from "@itwin/appui-react";
import { WidgetState } from "@itwin/appui-abstract";
import { Centered } from "@itwin/core-react";
import { ISelectionProvider, Presentation, SelectionChangeEventArgs } from "@itwin/presentation-frontend";
import * as React from "react";

export function useWidgetDef(id: string) {
  const frontstageDef = useActiveFrontstageDef();
  return frontstageDef?.findWidgetDef(id);
}

/** Hook used to return ids from selected element */
export function useIdOfSelectedElements(className?: string) {
  const [locatedIds, setLocatedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    return Presentation.selection.selectionChange.addListener(async (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      if (selection.isEmpty) {
        setLocatedIds([]);
      } else {
        if (selection.instanceKeys.size !== 0) {
          const selectIds: string[] = [];
          selection.instanceKeys.forEach((currentIds: Set<string>, key: string) => {
            if (!className || className && key === className)
              selectIds.push(...currentIds);
          });
          setLocatedIds(selectIds);
        }
      }
    });
  }, [className]);

  return locatedIds;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SelectedElementDataWidgetComponent() {
  const idList = useIdOfSelectedElements();
  const widgetDef = useWidgetDef("ui-item-provider-test:elementDataListWidget");

  React.useEffect(() => {
    // using setImmediate to give time for frontstage to load before calling setWidgetState
    if (idList.length === 0) {
      setImmediate(() => widgetDef?.setWidgetState(WidgetState.Hidden));
    } else {
      setImmediate(() => widgetDef?.setWidgetState(WidgetState.Open));
    }
  }, [idList, widgetDef]);

  if (0 === idList.length) {
    return (
      <Centered>
        <p className="center-text">Select element/elements</p>
      </Centered>
    );
  }
  return (
    <Centered>
      <p className="center-text">{idList.length} element(s) selected</p>
    </Centered>
  );
}
