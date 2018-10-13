/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Presentation from "@bentley/presentation-backend/lib/Presentation";

export const resetBackend = () => {
  const props = Presentation.initProps;
  Presentation.terminate();
  Presentation.initialize(props);
};
