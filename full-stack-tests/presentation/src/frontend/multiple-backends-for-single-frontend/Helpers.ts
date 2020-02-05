/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Presentation } from "@bentley/presentation-backend";

export const resetBackend = () => {
  const props = Presentation.initProps;
  Presentation.terminate();
  Presentation.initialize(props);
};
