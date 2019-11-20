/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { usePresentationNodeLoader } from "../../../tree/controlled/TreeHooks";

// tslint:disable: react-hooks-nesting
describe("usePresentationNodeLoader", () => {
  interface HookProps {
    imodel: IModelConnection;
    rulesetId: string;
    pageSize: number;
  }

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const initialProps = {
    imodel: imodelMock.object,
    rulesetId: "test",
    pageSize: 5,
  };

  it("creates node loader", () => {
    const { result } = renderHook(
      (props: HookProps) => usePresentationNodeLoader(props.imodel, props.rulesetId, props.pageSize),
      { initialProps },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: HookProps) => usePresentationNodeLoader(props.imodel, props.rulesetId, props.pageSize),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when rulesetId changes", () => {
    const { result, rerender } = renderHook(
      (props: HookProps) => usePresentationNodeLoader(props.imodel, props.rulesetId, props.pageSize),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, rulesetId: "changed" });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pageSize changes", () => {
    const { result, rerender } = renderHook(
      (props: HookProps) => usePresentationNodeLoader(props.imodel, props.rulesetId, props.pageSize),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, pageSize: 20 });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

});
