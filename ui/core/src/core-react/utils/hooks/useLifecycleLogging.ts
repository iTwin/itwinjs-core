/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useRef } from "react";

/**
 * Logs to console information about component lifecycle: mounting, re-rendering and unmounting.
 * @internal
 */
export function useLifecycleLogging(name: string, props: Record<string, any>, context?: Record<string, any>) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[useLifecycleLogging]: '${name}' Component mounted.`);

    return () => {
      // eslint-disable-next-line no-console
      console.log(`[useLifecycleLogging]: '${name}' Component unmounted.`);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const prevProps = useRef(props);
  const prevContext = useRef(context);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    function getDiff(prev: Record<string, any>, current: Record<string, any>): Record<string, any> {
      const diff: Record<string, { from: any, to: any }> = {};
      for (const key of Object.keys(current)) {
        if (prev[key] !== current[key]) {
          diff[key] = {
            from: prev[key],
            to: current[key],
          };
        }
      }

      return diff;
    }

    const propsDiff = getDiff(prevProps.current, props);
    const contextDiff = { from: context === undefined ? context : prevContext.current, to: context };

    if (Object.keys(propsDiff).length > 0 && prevContext.current !== context) {
      // eslint-disable-next-line no-console
      console.log(`[useLifecycleLogging]: '${name}' Props and context changed: `, propsDiff, contextDiff);
    } else if (Object.keys(propsDiff).length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[useLifecycleLogging]: '${name}' Props changed: `, propsDiff);
    } else if (prevContext.current !== context) {
      // eslint-disable-next-line no-console
      console.log(`[useLifecycleLogging]: '${name}' Context changed: `, contextDiff);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[useLifecycleLogging]: '${name}' Component re-rendered.`);
    }

    prevProps.current = props;
    prevContext.current = context;
  });
}
