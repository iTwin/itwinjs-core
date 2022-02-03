/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import produce, { castDraft } from "immer";
import * as React from "react";
import { EventEmitter } from "../base/Event";
import type { TabState } from "../base/NineZoneState";

/** @internal */
export interface WidgetContentManagerProps {
  children?: React.ReactNode;
}

/** @internal */
export const WidgetContentManager = React.memo<WidgetContentManagerProps>(function WidgetContentManager(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const [containers, setContainers] = React.useState<WidgetContentContainers>({});
  const saveTransientStateRef = React.useRef(new EventEmitter<(tabId: TabState["id"]) => void>());
  const restoreTransientStateRef = React.useRef(new EventEmitter<(tabId: TabState["id"]) => void>());
  const setContainer = React.useCallback<WidgetContentManagerContextArgs["setContainer"]>((tabId, container) => {
    container === null && saveTransientStateRef.current.emit(tabId);
    setContainers((prev) => produce(prev, (draft) => {
      draft[tabId] = castDraft(container);
    }));
  }, []);
  const widgetContentManagerContextValue = React.useMemo<WidgetContentManagerContextArgs>(() => ({
    setContainer,
    onSaveTransientState: saveTransientStateRef.current,
    onRestoreTransientState: restoreTransientStateRef.current,
  }), [setContainer]);
  return (
    <WidgetContentContainersContext.Provider value={containers}>
      <WidgetContentManagerContext.Provider value={widgetContentManagerContextValue}>
        {props.children}
      </WidgetContentManagerContext.Provider>
    </WidgetContentContainersContext.Provider >
  );
});

type WidgetContentContainers = { readonly [id in TabState["id"]]: Element | null | undefined };

/** @internal */
export const WidgetContentContainersContext = React.createContext<WidgetContentContainers>(null!); // eslint-disable-line @typescript-eslint/naming-convention
WidgetContentContainersContext.displayName = "nz:WidgetContentContainersContext";

/** @internal */
export interface WidgetContentManagerContextArgs {
  setContainer(tabId: TabState["id"], container: Element | null): void;
  onSaveTransientState: EventEmitter<(tabId: TabState["id"]) => void>;
  onRestoreTransientState: EventEmitter<(tabId: TabState["id"]) => void>;
}

/** @internal */
export const WidgetContentManagerContext = React.createContext<WidgetContentManagerContextArgs>(null!); // eslint-disable-line @typescript-eslint/naming-convention
WidgetContentManagerContext.displayName = "nz:WidgetContentManagerContext";
