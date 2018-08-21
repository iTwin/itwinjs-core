/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import Presentation from "@bentley/presentation-backend/lib/Presentation";

export const resetBackend = () => {
  const props = Presentation.manager.props;
  Presentation.terminate();
  Presentation.initialize(props);
};
