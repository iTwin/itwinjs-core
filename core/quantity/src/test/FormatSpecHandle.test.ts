/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeUnorderedUiEvent } from "@itwin/core-bentley";
import { describe, expect, it, vi } from "vitest";
import { FormatSpecHandle } from "../FormatSpecHandle";
import type { FormatterSpec } from "../Formatter/FormatterSpec";
import type { FormattingSpecArgs, FormattingSpecEntry, FormattingSpecProvider } from "../Formatter/Interfaces";

function createMockProvider(entry?: FormattingSpecEntry): FormattingSpecProvider & { ready: BeUnorderedUiEvent<void> } {
  const ready = new BeUnorderedUiEvent<void>();
  return {
    ready,
    onFormattingReady: ready,
    getSpecsByNameAndUnit: vi.fn().mockReturnValue(entry),
    formatQuantity: vi.fn().mockImplementation((value: number, _spec: FormatterSpec) => `formatted:${value}`),
  };
}

function createMockEntry(): FormattingSpecEntry {
  return {
    formatterSpec: { persistenceUnit: { name: "Units.M" } } as unknown as FormatterSpec,
    parserSpec: {} as any,
  };
}

/* eslint-disable @typescript-eslint/unbound-method */
describe("FormatSpecHandle", () => {
  it("populates specs on construction when entry is available", () => {
    const entry = createMockEntry();
    const provider = createMockProvider(entry);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M" });

    expect(handle.formatterSpec).toBe(entry.formatterSpec);
    expect(handle.parserSpec).toBe(entry.parserSpec);
    expect(handle.koqName).toBe("TestKoQ");
    expect(handle.persistenceUnit).toBe("Units.M");
    expect(handle.system).toBeUndefined();
    handle[Symbol.dispose]();
  });

  it("specs are undefined when entry is not available", () => {
    const provider = createMockProvider(undefined);
    const handle = new FormatSpecHandle({ provider, name: "Missing", persistenceUnitName: "Units.M" });

    expect(handle.formatterSpec).toBeUndefined();
    expect(handle.parserSpec).toBeUndefined();
    handle[Symbol.dispose]();
  });

  it("format() returns formatted string when spec is available", () => {
    const entry = createMockEntry();
    const provider = createMockProvider(entry);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M" });

    expect(handle.format(42)).toBe("formatted:42");
    expect(provider.formatQuantity).toHaveBeenCalledWith(42, entry.formatterSpec);
    handle[Symbol.dispose]();
  });

  it("format() returns toString fallback when spec is not available", () => {
    const provider = createMockProvider(undefined);
    const handle = new FormatSpecHandle({ provider, name: "Missing", persistenceUnitName: "Units.M" });

    expect(handle.format(42)).toBe("42");
    handle[Symbol.dispose]();
  });

  it("refreshes specs when onFormattingReady fires", () => {
    const provider = createMockProvider(undefined);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M" });
    expect(handle.formatterSpec).toBeUndefined();

    // Now make the provider return an entry and fire ready
    const entry = createMockEntry();
    vi.mocked(provider.getSpecsByNameAndUnit).mockReturnValue(entry);
    provider.ready.emit();

    expect(handle.formatterSpec).toBe(entry.formatterSpec);
    handle[Symbol.dispose]();
  });

  it("passes system to getSpecsByNameAndUnit when pinned", () => {
    const entry = createMockEntry();
    const provider = createMockProvider(entry);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M", system: "imperial" });

    expect(handle.system).toBe("imperial");
    expect(provider.getSpecsByNameAndUnit).toHaveBeenCalledWith({
      name: "TestKoQ",
      persistenceUnitName: "Units.M",
      system: "imperial",
    } satisfies FormattingSpecArgs);
    handle[Symbol.dispose]();
  });

  it("[Symbol.dispose] clears specs and unsubscribes from events", () => {
    const entry = createMockEntry();
    const provider = createMockProvider(entry);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M" });

    handle[Symbol.dispose]();
    expect(handle.formatterSpec).toBeUndefined();
    expect(handle.parserSpec).toBeUndefined();

    // Fire ready after dispose — should NOT repopulate
    vi.mocked(provider.getSpecsByNameAndUnit).mockClear();
    provider.ready.emit();
    expect(provider.getSpecsByNameAndUnit).not.toHaveBeenCalled();
  });

  it("[Symbol.dispose] is idempotent", () => {
    const provider = createMockProvider(undefined);
    const handle = new FormatSpecHandle({ provider, name: "TestKoQ", persistenceUnitName: "Units.M" });
    handle[Symbol.dispose]();
    handle[Symbol.dispose](); // Should not throw
  });
});
