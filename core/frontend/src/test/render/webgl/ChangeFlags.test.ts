/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ChangeFlag, MutableChangeFlags } from "../../../ChangeFlags";

describe("ChangeFlags", () => {
  it("should behave as expected", () => {
    const f = new MutableChangeFlags();
    expect(f.hasChanges).toBe(true);
    expect(f.value).toEqual(ChangeFlag.Initial);
    expect(f.areFeatureOverridesDirty).toBe(true);
    expect(f.isSet(ChangeFlag.Initial)).toBe(true);
    expect(f.isSet(ChangeFlag.All)).toBe(true);
    expect(f.areAllSet(ChangeFlag.Initial)).toBe(true);
    expect(f.areAllSet(ChangeFlag.All)).toBe(false);
    expect(f.isSet(ChangeFlag.AlwaysDrawn)).toBe(false);
    expect(f.isSet(ChangeFlag.ViewedCategories)).toBe(true);

    const f1 = new MutableChangeFlags(ChangeFlag.All);
    expect(f1.hasChanges).toBe(true);
    expect(f1.value).toEqual(ChangeFlag.All);
    expect(f1.areFeatureOverridesDirty).toBe(true);
    expect(f1.isSet(ChangeFlag.All)).toBe(true);
    expect(f1.isSet(ChangeFlag.AlwaysDrawn)).toBe(true);
    expect(f1.areAllSet(ChangeFlag.All)).toBe(true);

    f1.clear();
    expect(f1.hasChanges).toBe(false);
    expect(f1.value).toEqual(0);
    expect(f1.areFeatureOverridesDirty).toBe(false);

    f1.setViewedModels();
    expect(f1.hasChanges).toBe(true);
    expect(f1.areFeatureOverridesDirty).toBe(false);
    expect(f1.areAllSet(ChangeFlag.ViewedModels)).toBe(true);

    f1.setDisplayStyle();
    expect(f1.areFeatureOverridesDirty).toBe(true);
  });
});
