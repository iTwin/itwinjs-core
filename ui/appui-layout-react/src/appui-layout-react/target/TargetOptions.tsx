/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";

/** @internal */
export interface TargetOptions {
  version: "1" | "2";
}

const defaultValue: TargetOptions = {
  version: "1",
};

/** @internal */
export const TargetOptionsContext = React.createContext<TargetOptions>(defaultValue);
TargetOptionsContext.displayName = "nz:TargetOptionsContext";

/** @internal */
export function useTargetOptions() {
  return React.useContext(TargetOptionsContext);
}

/** HOC that returns a component which renders only if target version matches a specified `version` parameter.
 * @internal
 */
export function withTargetVersion<P extends {}>(version: TargetOptions["version"], Component: React.ComponentType<P>) {
  const WrappedComponent: React.FunctionComponent<P> = (props) => {
    const options = useTargetOptions();
    if (options.version !== version)
      return null;
    return <Component {...props} />;
  };
  WrappedComponent.displayName = `withTargetVersion:${version}`;
  return WrappedComponent;
}
