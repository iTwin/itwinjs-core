/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";
import { UiFramework } from "../UiFramework";

/** @internal */
export function useFrameworkVersion(): FrameworkVersion {
  return React.useContext(FrameworkVersionContext);
}

/** @alpha */
export type FrameworkVersion = "1" | "2";

/** @internal */
export const FrameworkVersionContext = React.createContext<FrameworkVersion>("1"); // eslint-disable-line @typescript-eslint/naming-convention

/** @alpha */
export interface FrameworkVersionProps {
  children?: React.ReactNode;
  version: FrameworkVersion;
}

/** @alpha */
export function FrameworkVersion(props: FrameworkVersionProps) { // eslint-disable-line @typescript-eslint/no-redeclare
  const currentVersion = React.useRef("");

  React.useEffect(() => {
    const version = props.version;
    // istanbul ignore else
    if (currentVersion.current !== version) {
      const oldVersion = currentVersion.current;
      currentVersion.current = version;
      UiFramework.onFrameworkVersionChangedEvent.emit({ version, oldVersion });
    }
  }, [props.version]);

  return (
    <FrameworkVersionContext.Provider
      children={props.children} // eslint-disable-line react/no-children-prop
      value={props.version}
    />
  );
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
    case "2": {
      return <>{props.v2}</>;
    }
    case "1":
    default: {
      return <>{props.v1}</>;
    }
  }
}
