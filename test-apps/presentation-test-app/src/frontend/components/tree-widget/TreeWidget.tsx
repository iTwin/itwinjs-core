/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Tree } from "./Tree";

interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const TreeWidget: React.FC<Props> = (props: Props) => {
  return <Tree imodel={props.imodel} rulesetId={props.rulesetId} />;
};
