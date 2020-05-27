/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import {
  createNineZoneState, NineZoneProvider as RealNineZoneProvider, NineZoneProviderProps,
} from "../ui-ninezone";
import { Rectangle } from "@bentley/ui-core";

// tslint:disable: completed-docs

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function NineZoneProvider(props: PartialBy<NineZoneProviderProps, "measure" | "state" | "dispatch">) {
  return (
    <RealNineZoneProvider
      state={createNineZoneState()}
      dispatch={sinon.stub()}
      measure={() => new Rectangle()}
      {...props}
    />
  );
}
