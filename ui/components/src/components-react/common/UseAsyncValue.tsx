/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import * as React from "react";
import { from } from "rxjs/internal/observable/from";
import { takeUntil } from "rxjs/internal/operators/takeUntil";
import { Subject } from "rxjs/internal/Subject";
import { isPromiseLike, useEffectSkipFirst } from "@itwin/core-react";

/**
 * Custom hook for working with possibly async values.
 * @public
 */
export const useAsyncValue = <T extends any>(value: T | PromiseLike<T>): T | undefined => {
  const cancelled = React.useMemo(() => new Subject<void>(), []);
  // cancel any pending promises on unmount
  React.useEffect(() => () => cancelled.next(), [cancelled]);

  const [result, setResult] = React.useState(() => {
    if (isPromiseLike(value)) {
      from(value).pipe(takeUntil(cancelled)).subscribe({ next: (resolvedValue) => setResult(resolvedValue) });
      return undefined;
    }
    return value;
  });

  useEffectSkipFirst(() => {
    const updateValue = (newValue: T) => {
      cancelled.next();
      setResult(newValue);
    };

    if (isPromiseLike(value)) {
      const subscription = from(value).pipe(takeUntil(cancelled)).subscribe({ next: (resolvedValue) => updateValue(resolvedValue) });
      return () => subscription.unsubscribe();
    }

    updateValue(value);
    return undefined;
  }, [value, cancelled]);

  return result;
};
