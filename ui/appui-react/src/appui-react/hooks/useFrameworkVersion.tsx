/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";
import { useSelector } from "react-redux";
import { FrameworkRootState } from "../redux/StateManager";
import { FrameworkVersionId, UiFramework } from "../UiFramework";

/** @public */
export function useFrameworkVersion(): FrameworkVersionId {
  return React.useContext(FrameworkVersionContext);
}

/** @public */
export const FrameworkVersionContext = React.createContext<FrameworkVersionId>("2"); // eslint-disable-line @typescript-eslint/naming-convention

/** @public */
export interface FrameworkVersionProps {
  children?: React.ReactNode;
}

/** The FrameworkVersion component provides uiVersion context to react component. The
 * component uses the property frameworkState.configurableUiState.frameworkVersion from the redux store
 * to determine the ui version. This version will default to "2" and should only be set to "1" for older
 * iModelApp applications.
 * @public
 */
export function FrameworkVersion(props: FrameworkVersionProps) { // eslint-disable-line @typescript-eslint/no-redeclare
  const uiVersion = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return frameworkState ? frameworkState.configurableUiState.frameworkVersion as FrameworkVersionId : "2";
  });
  return <FrameworkVersionContext.Provider
    children={props.children} // eslint-disable-line react/no-children-prop
    value={uiVersion}
  />;
}

/** @internal */
export interface FrameworkVersionSwitchProps {
  v1?: React.ReactNode;
  v2?: React.ReactNode;
}

/** @internal */
export function FrameworkVersionSwitch(props: FrameworkVersionSwitchProps) {
  const version = useFrameworkVersion();
  switch (version) {
    case "1": {
      return <>{props.v1}</>;
    }
    case "2":
    default: {
      return <>{props.v2}</>;
    }
  }
}
