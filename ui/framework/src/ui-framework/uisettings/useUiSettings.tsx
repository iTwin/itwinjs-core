/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

import * as React from "react";
import { UiSettings, LocalUiSettings } from "@bentley/ui-core";

/** @internal */
export function useUiSettingsContext(): UiSettings {
  return React.useContext(UiSettingsContext);
}

/** @internal */
export const UiSettingsContext = React.createContext<UiSettings>(new LocalUiSettings()); // tslint:disable-line: variable-name
UiSettingsContext.displayName = "uifw:UiSettingsContext";

/** Properties for the [[UiSettingsProvider]] component.
 * @alpha
 */
export interface UiSettingsProviderProps {
  children?: React.ReactNode;
  uiSettings: UiSettings;
}

/** Allows to provide a custom [[UiSettings]] implementation to persist UI settings.
 * @alpha
 */
export function UiSettingsProvider(props: UiSettingsProviderProps) {
  return (
    <UiSettingsContext.Provider
      children={props.children}
      value={props.uiSettings}
    />
  );
}
