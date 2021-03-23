/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import * as React from "react";
import { LocalSettingsStorage, UiSettingsStorage } from "@bentley/ui-core";

/** @beta */
export function useUiSettingsStorageContext(): UiSettingsStorage {
  return React.useContext(UiSettingsContext);
}

/** @internal */
export const UiSettingsContext = React.createContext<UiSettingsStorage>(new LocalSettingsStorage()); // eslint-disable-line @typescript-eslint/naming-convention
UiSettingsContext.displayName = "uifw:UiSettingsContext";

/** Properties for the [[UiSettingsProvider]] component.
 * @beta
 */
export interface UiSettingsProviderProps {
  children?: React.ReactNode;
  settingsStorage: UiSettingsStorage;
}

/** Allows to provide a custom [[UiSettings]] implementation to persist UI settings.
 * @beta
 */
export function UiSettingsProvider(props: UiSettingsProviderProps) {
  return (
    <UiSettingsContext.Provider
      children={props.children} // eslint-disable-line react/no-children-prop
      value={props.settingsStorage}
    />
  );
}
