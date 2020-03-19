/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { TabState } from "../base/NineZoneState";
import { EventEmitter } from "../base/Event";

/** @internal */
export interface WidgetContentManagerProps {
  children?: React.ReactNode;
}

/** @internal */
export const WidgetContentManager = React.memo<WidgetContentManagerProps>(function WidgetContentManager(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const [containers, setContainers] = React.useState<WidgetContentContainers>({});
  const saveTransientStateRef = React.useRef(new EventEmitter<(tabId: TabState["id"]) => void>());
  const restoreTransientStateRef = React.useRef(new EventEmitter<(tabId: TabState["id"]) => void>());
  const getWidgetContentContainerRef = React.useCallback<WidgetContentManagerContextArgs["getWidgetContentContainerRef"]>((tabId) => {
    return (container: Element | null) => {
      container === null && saveTransientStateRef.current.emit(tabId);
      setContainers((prev) => {
        const newContainers = {
          ...prev,
        };
        newContainers[tabId] = container;
        return newContainers;
      });
    };
  }, []);
  const widgetContentManagerContextValue = React.useMemo<WidgetContentManagerContextArgs>(() => ({
    getWidgetContentContainerRef,
    onSaveTransientState: saveTransientStateRef.current,
    onRestoreTransientState: restoreTransientStateRef.current,
  }), [getWidgetContentContainerRef]);
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
export const WidgetContentContainersContext = React.createContext<WidgetContentContainers>(null!); // tslint:disable-line: variable-name
WidgetContentContainersContext.displayName = "nz:WidgetContentContainersContext";

/** @internal */
export interface WidgetContentManagerContextArgs {
  getWidgetContentContainerRef: (tabId: TabState["id"]) => React.Ref<Element>;
  onSaveTransientState: EventEmitter<(tabId: TabState["id"]) => void>;
  onRestoreTransientState: EventEmitter<(tabId: TabState["id"]) => void>;
}

/** @internal */
export const WidgetContentManagerContext = React.createContext<WidgetContentManagerContextArgs>(null!); // tslint:disable-line: variable-name
WidgetContentManagerContext.displayName = "nz:WidgetContentManagerContext";
