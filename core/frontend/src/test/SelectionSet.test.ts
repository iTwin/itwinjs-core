/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { HiliteSet, SelectionSet, SelectionSetEvent, SelectionSetEventType } from "../SelectionSet";
import { ViewManager } from "../ViewManager";

describe("SelectionSet", () => {
  const viewManagerMock = {
    onSelectionSetChanged: vi.fn(),
  };
  const imodelMock = {};

  function createSelectionSet() {
    const ss = new SelectionSet(imodelMock as IModelConnection);
    const onChangedSpy = vi.fn();
    ss.onChanged.addListener(onChangedSpy);
    return { ss, onChangedSpy };
  }

  beforeEach(() => {
    vi.spyOn(IModelApp, "viewManager", "get").mockReturnValue(viewManagerMock as unknown as ViewManager);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns valid clean state", () => {
    const { ss } = createSelectionSet();
    expect(ss.size).to.eq(0);
    expect(ss.isActive).to.be.false;
    expect(ss.active).to.deep.eq({ elements: new Set(), models: new Set(), subcategories: new Set() });
    expect(ss.elements.size).to.eq(0);
    expect(ss.models.size).to.eq(0);
    expect(ss.subcategories.size).to.eq(0);
  });

  describe("add", () => {
    it("adds ids to selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();
      const result = ss.add({
        elements: "0x1",
        models: ["0x2"],
        subcategories: new Set(["0x3"]),
      });
      expect(result).to.be.true;

      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg("0x1"),
        additions: {
          elements: expect.toBeId64Arg("0x1"),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });

      expect(ss.size).to.eq(3);
      expect(ss.isActive).to.be.true;
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });
      expect(ss.elements).toBeId64Arg(["0x1"]);
      expect(ss.models).toBeId64Arg(["0x2"]);
      expect(ss.subcategories).toBeId64Arg(["0x3"]);
    });

    it("adds element ids to selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // add an element using SelectableIds structure
      const resultSelectableIds = ss.add({ elements: ["0x123"] });
      expect(resultSelectableIds).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg(["0x123"]),
        additions: {
          elements: expect.toBeId64Arg(["0x123"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1", "0x123"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });

      // add an element using Id64Arg
      const resultId64Arg = ss.add("0x456");
      expect(resultId64Arg).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg("0x456"),
        additions: {
          elements: expect.toBeId64Arg("0x456"),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1", "0x123", "0x456"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });

      // ensure deprecated element checks still work
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(ss.has("0x123")).to.be.true;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(ss.isSelected("0x456")).to.be.true;
    });

    it("adds model ids to selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // add a model using SelectableIds structure
      const result = ss.add({ models: ["0x123"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg([]),
        additions: {
          models: expect.toBeId64Arg(["0x123"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x2", "0x123"]),
        subcategories: new Set(["0x3"]),
      });
    });

    it("adds subcategory ids to selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // add a subcategory using SelectableIds structure
      const result = ss.add({ subcategories: ["0x123"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg([]),
        additions: {
          subcategories: expect.toBeId64Arg(["0x123"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3", "0x123"]),
      });
    });

    it("doesn't raise change events if selected ids don't change", async () => {
      const { ss, onChangedSpy } = createSelectionSet();
      ss.add({
        elements: "0x1",
        models: ["0x2"],
        subcategories: new Set(["0x3"]),
      });
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      vi.clearAllMocks();

      const result = ss.add({
        elements: ["0x1"],
        models: ["0x2"],
        subcategories: ["0x3"],
      });
      expect(result).to.be.false;
      expect(viewManagerMock.onSelectionSetChanged).not.toBeCalled();
      expect(onChangedSpy).not.toBeCalled();
    });
  });

  describe("remove", () => {
    it("removes ids from selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({
        elements: ["0x1", "0x2"],
        models: ["0x3", "0x4"],
        subcategories: ["0x5", "0x6"],
      });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // test
      const result = ss.remove({
        elements: "0x1",
        models: ["0x3"],
        subcategories: new Set(["0x5"]),
      });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg("0x1"),
        removals: {
          elements: expect.toBeId64Arg("0x1"),
          models: expect.toBeId64Arg(["0x3"]),
          subcategories: expect.toBeId64Arg(["0x5"]),
        },
      });
      expect(ss.size).to.eq(3);
      expect(ss.isActive).to.be.true;
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x2"]),
        models: new Set(["0x4"]),
        subcategories: new Set(["0x6"]),
      });
    });

    it("removes element ids from selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({
        elements: ["0x1", "0x2"],
        models: ["0x3", "0x4"],
        subcategories: ["0x5", "0x6"],
      });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // remove an element using SelectableIds structure
      const resultSelectableIds = ss.remove({ elements: ["0x1"] });
      expect(resultSelectableIds).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg(["0x1"]),
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x2"]),
        models: new Set(["0x3", "0x4"]),
        subcategories: new Set(["0x5", "0x6"]),
      });

      // remove an element using Id64Arg
      const resultId64Arg = ss.remove("0x2");
      expect(resultId64Arg).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg("0x2"),
        removals: {
          elements: expect.toBeId64Arg("0x2"),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set([]),
        models: new Set(["0x3", "0x4"]),
        subcategories: new Set(["0x5", "0x6"]),
      });
    });

    it("removes model ids from selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({
        elements: ["0x1", "0x2"],
        models: ["0x3", "0x4"],
        subcategories: ["0x5", "0x6"],
      });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // remove a model using SelectableIds structure
      const result = ss.remove({ models: ["0x3"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg([]),
        removals: {
          models: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1", "0x2"]),
        models: new Set(["0x4"]),
        subcategories: new Set(["0x5", "0x6"]),
      });
    });

    it("removes subcategory ids from selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({
        elements: ["0x1", "0x2"],
        models: ["0x3", "0x4"],
        subcategories: ["0x5", "0x6"],
      });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // remove a subcategory using SelectableIds structure
      const result = ss.remove({ subcategories: ["0x5"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg([]),
        removals: {
          subcategories: expect.toBeId64Arg(["0x5"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1", "0x2"]),
        models: new Set(["0x3", "0x4"]),
        subcategories: new Set(["0x6"]),
      });
    });

    it("doesn't raise change events if selected ids don't change", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({
        elements: ["0x1", "0x2"],
        models: ["0x3", "0x4"],
        subcategories: ["0x5", "0x6"],
      });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      const result = ss.remove({
        elements: ["0x3"],
        models: [],
        subcategories: ["0x7"],
      });
      expect(result).to.be.false;
      expect(viewManagerMock.onSelectionSetChanged).not.toBeCalled();
      expect(onChangedSpy).not.toBeCalled();
    });
  });

  describe("replace", () => {
    it("replaces ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // test
      const result = ss.replace({
        elements: "0x4",
        models: ["0x5"],
        subcategories: new Set(["0x6"]),
      });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg("0x4"),
        removed: expect.toBeId64Arg(["0x1"]),
        additions: {
          elements: expect.toBeId64Arg("0x4"),
          models: expect.toBeId64Arg(["0x5"]),
          subcategories: expect.toBeId64Arg(["0x6"]),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.size).to.eq(3);
      expect(ss.isActive).to.be.true;
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x4"]),
        models: new Set(["0x5"]),
        subcategories: new Set(["0x6"]),
      });
    });

    it("replaces element ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // replace an element using SelectableIds structure
      const resultSelectableIds = ss.replace({ elements: ["0x4", "0x5"], models: [...ss.models], subcategories: [...ss.subcategories] });
      expect(resultSelectableIds).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg(["0x4", "0x5"]),
        removed: expect.toBeId64Arg(["0x1"]),
        additions: {
          elements: expect.toBeId64Arg(["0x4", "0x5"]),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x4", "0x5"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });

      // replace an element using Id64Arg
      const resultId64Arg = ss.replace("0x6");
      expect(resultId64Arg).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg("0x6"),
        removed: expect.toBeId64Arg(["0x4", "0x5"]),
        additions: {
          elements: expect.toBeId64Arg("0x6"),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x4", "0x5"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x6"]),
        models: new Set(),
        subcategories: new Set(),
      });
    });

    it("replaces model ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // replace a model using SelectableIds structure
      const result = ss.replace({ elements: [...ss.elements], models: ["0x4", "0x5"], subcategories: [...ss.subcategories] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg([]),
        removed: expect.toBeId64Arg([]),
        additions: {
          models: expect.toBeId64Arg(["0x4", "0x5"]),
        },
        removals: {
          models: expect.toBeId64Arg(["0x2"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x4", "0x5"]),
        subcategories: new Set(["0x3"]),
      });
    });

    it("replaces subcategory ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // replace a subcategory using SelectableIds structure
      const result = ss.replace({ elements: [...ss.elements], models: [...ss.models], subcategories: ["0x4", "0x5"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg([]),
        removed: expect.toBeId64Arg([]),
        additions: {
          subcategories: expect.toBeId64Arg(["0x4", "0x5"]),
        },
        removals: {
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x4", "0x5"]),
      });
    });

    it("replaces with empty set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // replace selection with empty SelectableIds structure
      const result = ss.replace({});
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg([]),
        removed: expect.toBeId64Arg(["0x1"]),
        additions: {},
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(),
        models: new Set(),
        subcategories: new Set(),
      });
    });

    it("doesn't raise change events if selected ids don't change", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      const result = ss.replace({
        elements: ["0x1"],
        models: ["0x2"],
        subcategories: ["0x3"],
      });
      expect(result).to.be.false;
      expect(viewManagerMock.onSelectionSetChanged).not.toBeCalled();
      expect(onChangedSpy).not.toBeCalled();
    });
  });

  describe("invert", () => {
    it("inverts ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // test
      const result = ss.invert({
        elements: ["0x1", "0x4"],
        models: ["0x2", "0x5"],
        subcategories: new Set(["0x3", "0x6"]),
      });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg(["0x4"]),
        removed: expect.toBeId64Arg(["0x1"]),
        additions: {
          elements: expect.toBeId64Arg(["0x4"]),
          models: expect.toBeId64Arg(["0x5"]),
          subcategories: expect.toBeId64Arg(["0x6"]),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.size).to.eq(3);
      expect(ss.isActive).to.be.true;
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x4"]),
        models: new Set(["0x5"]),
        subcategories: new Set(["0x6"]),
      });
    });

    it("inverts element ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // invert an element using SelectableIds structure
      const resultSelectableIds = ss.invert({ elements: ["0x1", "0x4"] });
      expect(resultSelectableIds).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg(["0x4"]),
        removed: expect.toBeId64Arg(["0x1"]),
        additions: {
          elements: expect.toBeId64Arg(["0x4"]),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x4"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });

      // invert an element using Id64Arg
      const resultId64Arg = ss.invert(["0x4", "0x5"]);
      expect(resultId64Arg).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).toHaveBeenCalledTimes(2);
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg(["0x5"]),
        removed: expect.toBeId64Arg(["0x4"]),
        additions: {
          elements: expect.toBeId64Arg(["0x5"]),
        },
        removals: {
          elements: expect.toBeId64Arg(["0x4"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x5"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x3"]),
      });
    });

    it("inverts model ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // invert a model using SelectableIds structure
      const result = ss.invert({ models: ["0x2", "0x4"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg([]),
        removed: expect.toBeId64Arg([]),
        additions: {
          models: expect.toBeId64Arg(["0x4"]),
        },
        removals: {
          models: expect.toBeId64Arg(["0x2"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x4"]),
        subcategories: new Set(["0x3"]),
      });
    });

    it("inverts subcategory ids in selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // invert a subcategory using SelectableIds structure
      const result = ss.invert({ subcategories: ["0x3", "0x4"] });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Replace,
        set: ss,
        added: expect.toBeId64Arg([]),
        removed: expect.toBeId64Arg([]),
        additions: {
          subcategories: expect.toBeId64Arg(["0x4"]),
        },
        removals: {
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1"]),
        models: new Set(["0x2"]),
        subcategories: new Set(["0x4"]),
      });
    });

    it("invert by only adding new ids", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // invert selection with empty SelectableIds structure
      const result = ss.invert({
        elements: ["0x4"],
        models: ["0x5"],
        subcategories: ["0x6"],
      });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Add,
        set: ss,
        added: expect.toBeId64Arg(["0x4"]),
        additions: {
          elements: expect.toBeId64Arg(["0x4"]),
          models: expect.toBeId64Arg(["0x5"]),
          subcategories: expect.toBeId64Arg(["0x6"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(["0x1", "0x4"]),
        models: new Set(["0x2", "0x5"]),
        subcategories: new Set(["0x3", "0x6"]),
      });
    });

    it("invert by only removing ids", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // invert selection with SelectableIds structure matching only ids existing in active selection
      const result = ss.invert({
        elements: ["0x1"],
        models: ["0x2"],
        subcategories: ["0x3"],
      });
      expect(result).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Remove,
        set: ss,
        removed: expect.toBeId64Arg(["0x1"]),
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.active).to.deep.eq({
        elements: new Set(),
        models: new Set(),
        subcategories: new Set(),
      });
    });

    it("doesn't raise change events if selected ids don't change", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      const result = ss.invert({});
      expect(result).to.be.false;
      expect(viewManagerMock.onSelectionSetChanged).not.toBeCalled();
      expect(onChangedSpy).not.toBeCalled();
    });
  });

  describe("emptyAll", () => {
    it("clears selection set", async () => {
      const { ss, onChangedSpy } = createSelectionSet();

      // set up initial state
      ss.add({ elements: ["0x1"], models: ["0x2"], subcategories: ["0x3"] });
      expect(ss.isActive).to.be.true;
      vi.clearAllMocks();

      // test
      ss.emptyAll();
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
      expect(onChangedSpy).toHaveBeenCalledOnce();
      expect(onChangedSpy).lastCalledWith({
        type: SelectionSetEventType.Clear,
        set: ss,
        removed: expect.toBeId64Arg(["0x1"]),
        removals: {
          elements: expect.toBeId64Arg(["0x1"]),
          models: expect.toBeId64Arg(["0x2"]),
          subcategories: expect.toBeId64Arg(["0x3"]),
        },
      });
      expect(ss.size).to.eq(0);
      expect(ss.isActive).to.be.false;
      expect(ss.active).to.deep.eq({
        elements: new Set(),
        models: new Set(),
        subcategories: new Set(),
      });
    });

    it("doesn't raise change events if selected ids don't change", async () => {
      const { ss, onChangedSpy } = createSelectionSet();
      expect(ss.isActive).to.be.false;
      ss.emptyAll();
      expect(viewManagerMock.onSelectionSetChanged).not.toBeCalled();
      expect(onChangedSpy).not.toBeCalled();
    });
  });
});

describe("HiliteSet", () => {
  const viewManagerMock = {
    onSelectionSetChanged: vi.fn(),
  };
  const imodelMock = {
    selectionSet: {
      onChanged: new BeEvent<(ev: SelectionSetEvent) => void>(),
      active: { elements: new Set(), models: new Set(), subcategories: new Set() },
    },
  };

  function resetIModelMock() {
    imodelMock.selectionSet = {
      onChanged: new BeEvent(),
      active: { elements: new Set(), models: new Set(), subcategories: new Set() },
    };
  }
  function createHiliteSet(syncWithSelectionSet: boolean) {
    const hilite = new HiliteSet(imodelMock as IModelConnection, syncWithSelectionSet);
    const onModelSubCategoryModeChangedSpy = vi.fn();
    hilite.onModelSubCategoryModeChanged.addListener(onModelSubCategoryModeChangedSpy);
    return { hilite, onModelSubCategoryModeChangedSpy };
  }

  beforeEach(() => {
    vi.spyOn(IModelApp, "viewManager", "get").mockReturnValue(viewManagerMock as unknown as ViewManager);
  });

  afterEach(() => {
    resetIModelMock();
    vi.resetAllMocks();
  });

  it("returns valid clean state", async () => {
    const { hilite } = createHiliteSet(false);
    expect(hilite.isEmpty).to.be.true;
    expect(hilite.elements.isEmpty).to.be.true;
    expect(hilite.models.isEmpty).to.be.true;
    expect(hilite.subcategories.isEmpty).to.be.true;
  });

  it("raises `onModelSubCategoryModeChanged` event when the mode changes", () => {
    const { hilite, onModelSubCategoryModeChangedSpy } = createHiliteSet(false);
    expect(hilite.modelSubCategoryMode).to.eq("union");
    expect(onModelSubCategoryModeChangedSpy).not.toBeCalled();

    hilite.modelSubCategoryMode = "intersection";
    expect(hilite.modelSubCategoryMode).to.eq("intersection");
    expect(onModelSubCategoryModeChangedSpy).toBeCalledTimes(1);

    hilite.modelSubCategoryMode = "union";
    expect(hilite.modelSubCategoryMode).to.eq("union");
    expect(onModelSubCategoryModeChangedSpy).toBeCalledTimes(2);

    hilite.modelSubCategoryMode = "union";
    expect(hilite.modelSubCategoryMode).to.eq("union");
    expect(onModelSubCategoryModeChangedSpy).toBeCalledTimes(2);
  });

  describe("changing hilite", () => {
    it("adds ids to hilite set", () => {
      const { hilite } = createHiliteSet(false);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("removes ids from hilite set", () => {
      const { hilite } = createHiliteSet(false);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      viewManagerMock.onSelectionSetChanged.mockClear();

      hilite.remove({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(hilite.elements.isEmpty).to.be.true;
      expect(hilite.models.isEmpty).to.be.true;
      expect(hilite.subcategories.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("replaces ids in hilite set", () => {
      const { hilite } = createHiliteSet(false);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      viewManagerMock.onSelectionSetChanged.mockClear();

      hilite.replace({ elements: "0x4", models: "0x5", subcategories: "0x6" });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x4"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x5"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x6"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("clears hilite set", () => {
      const { hilite } = createHiliteSet(false);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      viewManagerMock.onSelectionSetChanged.mockClear();

      hilite.clear();
      expect(hilite.elements.isEmpty).to.be.true;
      expect(hilite.models.isEmpty).to.be.true;
      expect(hilite.subcategories.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("sets elements hilite", () => {
      const { hilite } = createHiliteSet(false);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      hilite.setHilite("0x1", true);
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(1);

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      hilite.setHilite(["0x1"], false);
      expect(hilite.elements.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(2);
    });

    it("changes elements hilite directly", () => {
      const { hilite } = createHiliteSet(false);
      hilite.elements.addId("0x1");
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(1);

      hilite.elements.deleteIds(["0x1"]);
      expect(hilite.elements.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(2);
    });

    it("changes models hilite directly", () => {
      const { hilite } = createHiliteSet(false);
      hilite.models.addId("0x1");
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x1"]);
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(1);

      hilite.models.deleteIds(["0x1"]);
      expect(hilite.models.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(2);
    });

    it("changes subcategories hilite directly", () => {
      const { hilite } = createHiliteSet(false);
      hilite.subcategories.addId("0x1");
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x1"]);
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(1);

      hilite.subcategories.deleteIds(["0x1"]);
      expect(hilite.subcategories.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toBeCalledTimes(2);
    });
  });

  describe("syncing with selection set", () => {
    it("subscribes to and unsubscribes from selection set changed event", () => {
      const { hilite } = createHiliteSet(false);
      expect(imodelMock.selectionSet.onChanged.numberOfListeners).to.eq(0);
      hilite.wantSyncWithSelectionSet = true;
      expect(imodelMock.selectionSet.onChanged.numberOfListeners).to.eq(1);
      hilite.wantSyncWithSelectionSet = false;
      expect(imodelMock.selectionSet.onChanged.numberOfListeners).to.eq(0);
    });

    it("doesn't sync with selection set when `wantSyncWithSelectionSet` is set to `false`", () => {
      const { hilite } = createHiliteSet(false);
      expect(hilite.wantSyncWithSelectionSet).to.be.false;
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Clear,
        removed: [],
        removals: { elements: "0x1", models: "0x2", subcategories: "0x3" },
      });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3"]);

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Add,
        added: [],
        additions: { elements: "0x4", models: "0x5", subcategories: "0x6" },
      });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3"]);
    });

    it("initializes hilite set from selection set when `wantSyncWithSelectionSet` is set to `true`", () => {
      const { hilite } = createHiliteSet(false);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      viewManagerMock.onSelectionSetChanged.mockClear();

      imodelMock.selectionSet.active = {
        elements: new Set(["0x4"]),
        models: new Set(["0x5"]),
        subcategories: new Set(["0x6"]),
      };
      hilite.wantSyncWithSelectionSet = true;
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1", "0x4"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2", "0x5"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3", "0x6"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("adds ids from selection set addition event", () => {
      const { hilite } = createHiliteSet(true);
      viewManagerMock.onSelectionSetChanged.mockClear();

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Add,
        added: [],
        additions: {
          elements: ["0x1"],
          models: ["0x2"],
          subcategories: ["0x3"],
        },
      });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x1"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("removes ids from selection set removal event", () => {
      const { hilite } = createHiliteSet(true);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(hilite.elements.isEmpty).to.be.false;
      expect(hilite.models.isEmpty).to.be.false;
      expect(hilite.subcategories.isEmpty).to.be.false;
      viewManagerMock.onSelectionSetChanged.mockClear();

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Remove,
        removed: [],
        removals: {
          elements: ["0x1"],
          models: ["0x2"],
          subcategories: ["0x3"],
        },
      });
      expect(hilite.elements.isEmpty).to.be.true;
      expect(hilite.models.isEmpty).to.be.true;
      expect(hilite.subcategories.isEmpty).to.be.true;
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("adds and removes ids from selection set replace event", () => {
      const { hilite } = createHiliteSet(true);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(hilite.elements.isEmpty).to.be.false;
      expect(hilite.models.isEmpty).to.be.false;
      expect(hilite.subcategories.isEmpty).to.be.false;
      viewManagerMock.onSelectionSetChanged.mockClear();

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Replace,
        added: [],
        removed: [],
        additions: {
          elements: ["0x4"],
          subcategories: ["0x5"],
        },
        removals: {
          elements: ["0x1"],
          subcategories: ["0x3"],
        },
      });
      expect(hilite.elements.toId64Array()).toBeId64Arg(["0x4"]);
      expect(hilite.models.toId64Array()).toBeId64Arg(["0x2"]);
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x5"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });

    it("removes ids from selection set clear event", () => {
      const { hilite } = createHiliteSet(true);
      hilite.add({ elements: "0x1", models: "0x2", subcategories: "0x3" });
      expect(hilite.elements.isEmpty).to.be.false;
      expect(hilite.models.isEmpty).to.be.false;
      expect(hilite.subcategories.isEmpty).to.be.false;
      viewManagerMock.onSelectionSetChanged.mockClear();

      imodelMock.selectionSet.onChanged.raiseEvent({
        set: imodelMock.selectionSet as SelectionSet,
        type: SelectionSetEventType.Clear,
        removed: [],
        removals: {
          elements: ["0x1"],
          models: ["0x2"],
        },
      });
      expect(hilite.elements.isEmpty).to.be.true;
      expect(hilite.models.isEmpty).to.be.true;
      expect(hilite.subcategories.toId64Array()).toBeId64Arg(["0x3"]);
      expect(viewManagerMock.onSelectionSetChanged).toHaveBeenCalledOnce();
    });
  });
});
