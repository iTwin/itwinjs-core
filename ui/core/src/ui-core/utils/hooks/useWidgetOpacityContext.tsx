/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** @internal */
export interface WidgetOpacityContextProps {
  readonly onElementRef: (elementRef: React.RefObject<Element>) => void;
  readonly proximityScale: number;
}

/**
 * Context used by Widgets and child components to process opacity changes based on mouse proximity.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const WidgetOpacityContext = React.createContext<WidgetOpacityContextProps>({
  onElementRef: /* istanbul ignore next */ (_elementRef: React.RefObject<Element>) => void {},
  proximityScale: 1.0,
});

/** @internal */
export function useWidgetOpacityContext() {
  return React.useContext(WidgetOpacityContext);
}
