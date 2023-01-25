/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiStateStorage
 */

import * as React from "react";
import { UiSyncEventArgs } from "@itwin/appui-abstract";
import { LocalStateStorage, UiStateStorage } from "@itwin/core-react";
import { UiFramework } from "../UiFramework";
import { SyncUiEventId } from "../framework/FrameworkEvents";

/** @public */
export function useUiStateStorageHandler(): UiStateStorage {
  return React.useContext(UiStateStorageContext);
}

/** @internal */
export const UiStateStorageContext = React.createContext<UiStateStorage>(new LocalStateStorage()); // eslint-disable-line @typescript-eslint/naming-convention
UiStateStorageContext.displayName = "uifw:UiStateStorageContext";

/** Properties for the [[UiStateStorageHandler]] component.
 * @public
 */
export interface UiSettingsProviderProps {
  children?: React.ReactNode;
}

/** Allows to provide a custom [[UiStateStorage]] implementation to persist UI settings.
 * @public
 */
export function UiStateStorageHandler(props: UiSettingsProviderProps) {
  const [stateStorage, setStateStorage] = React.useState(UiFramework.getUiStateStorage());

  React.useEffect(() => {
    // istanbul ignore next
    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      if (UiFramework.events.hasEventOfInterest(args.eventIds, [SyncUiEventId.UiStateStorageChanged]))
        setStateStorage(UiFramework.getUiStateStorage());
    };

    return UiFramework.events.onSyncUiEvent.addListener(handleSyncUiEvent);
  });

  return (
    <UiStateStorageContext.Provider
      children={props.children} // eslint-disable-line react/no-children-prop
      value={stateStorage}
    />
  );
}
