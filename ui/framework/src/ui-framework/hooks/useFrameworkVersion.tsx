/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";

/** @internal */
export function useFrameworkVersion(): FrameworkVersion {
  return React.useContext(FrameworkVersionContext);
}

/** @alpha */
export type FrameworkVersion = "1" | "2";

/** @internal */
export const FrameworkVersionContext = React.createContext<FrameworkVersion>("1"); // tslint:disable-line: variable-name

/** @alpha */
export interface FrameworkVersionProps {
  children?: React.ReactNode;
  version: FrameworkVersion;
}

/** @alpha */
export function FrameworkVersion(props: FrameworkVersionProps) {
  return (
    <FrameworkVersionContext.Provider
      children={props.children}
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
    case "1": {
      return <>{props.v1}</>;
    }
    case "2": {
      return <>{props.v2}</>;
    }
    default: {
      return <>{props.v1}</>;
    }
  }
}
