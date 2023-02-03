/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

export type ApplicationMode = "app" | "portal";

export interface ApplicationLayoutArgs {
  mode: ApplicationMode;
  onChanged: (mode: ApplicationMode) => void;
}

export const ApplicationLayoutContext = React.createContext<ApplicationLayoutArgs | undefined>(undefined);

export function ApplicationLayoutProvider(props: React.PropsWithChildren<{}>) {
  const [mode, setMode] = React.useState<ApplicationMode>("app");
  const onChanged = React.useCallback<ApplicationLayoutArgs["onChanged"]>((newMode) => {
    setMode(newMode);
  }, []);
  const value = React.useMemo(() => ({
    mode,
    onChanged,
  }), [mode, onChanged]);
  return (
    <ApplicationLayoutContext.Provider value={value}>
      {props.children}
    </ApplicationLayoutContext.Provider>
  );
}
