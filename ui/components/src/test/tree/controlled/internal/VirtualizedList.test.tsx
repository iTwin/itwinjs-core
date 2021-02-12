/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { VirtualizedList, VirtualizedListAttributes } from "../../../../ui-components/tree/controlled/internal/VirtualizedList";

describe("VirtualizedLst", () => {
  describe("resetAfterIndex", () => {
    it("does not throw if called early", () => {
      render(React.createElement(() => {
        const virtualizedListRef = React.useRef<VirtualizedListAttributes>(null);

        React.useEffect(() => {
          virtualizedListRef.current!.resetAfterIndex(0);
        });

        return (
          <VirtualizedList ref={virtualizedListRef} onTreeSizeChanged={() => {}} itemSize={() => 10} itemCount={1}>
            {() => <></>}
          </VirtualizedList>
        );
      }));
    });
  });
});
