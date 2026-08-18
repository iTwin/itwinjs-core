/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider } from "@itwin/core-quantity";
import { IModelApp } from "../IModelApp";
import { QuantityFormatter, QuantityTypeFormatsProvider } from "../quantity-formatting/QuantityFormatter";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function createFormatsProvider(getFormat: FormatsProvider["getFormat"]): FormatsProvider {
  return {
    onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
    getFormat,
  };
}

const simpleFormat: FormatDefinition = {
  type: "Decimal",
  precision: 2,
  formatTraits: ["showUnitLabel"],
  uomSeparator: " ",
  composite: {
    includeZero: true,
    spacer: "",
    units: [{ name: "Units.M", label: "m" }],
  },
};

describe("Formats provider reload invariants", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("keeps latest-wins ownership correct under reentrant provider events", async () => {
    const providerA = createFormatsProvider(async () => undefined);
    const providerB = createFormatsProvider(async () => undefined);
    let secondRequest: Promise<void> | undefined;
    let eventCount = 0;
    const removeListener = IModelApp.formatsProvider.onFormatsChanged.addListener(() => {
      if (eventCount++ === 0)
        secondRequest = IModelApp.setFormatsProvider(providerB);
    });

    try {
      const firstRequest = IModelApp.setFormatsProvider(providerA);
      expect(secondRequest).toBeDefined();
      await Promise.all([
        expect(firstRequest).rejects.toThrow(/superseded/i),
        expect(secondRequest!).resolves.toBeUndefined(),
      ]);
    } finally {
      removeListener();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider());
    }
  });

  it("applies the newest unit-system intent when it overlaps a provider reload", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const originalUnitSystem = quantityFormatter.activeUnitSystem;
    await quantityFormatter.setActiveUnitSystem("usSurvey");
    const name = "TestKoQ.UNIT_SYSTEM_INTENT";
    await quantityFormatter.addFormattingSpecsToRegistry({ name, persistenceUnitName: "Units.M", formatProps: simpleFormat, system: "metric" });
    const loadStarted = deferred<void>();
    const releaseLoad = deferred<void>();
    let getFormatCount = 0;
    const provider = createFormatsProvider(async () => {
      if (getFormatCount++ === 0) {
        loadStarted.resolve();
        await releaseLoad.promise;
      }
      return undefined;
    });

    try {
      const providerReload = IModelApp.setFormatsProvider(provider, { unitSystem: "metric" });
      await loadStarted.promise;
      const unitSystemReload = quantityFormatter.setActiveUnitSystem("imperial");
      releaseLoad.resolve();

      await providerReload;
      await unitSystemReload;
      expect(quantityFormatter.activeUnitSystem).toBe("imperial");
    } finally {
      releaseLoad.resolve();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("does not carry forward an uncommitted implied unit system when the next replacement omits it", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const originalUnitSystem = quantityFormatter.activeUnitSystem;
    await quantityFormatter.setActiveUnitSystem("imperial");
    const name = "TestKoQ.OMITTED_UNIT_SYSTEM";
    await quantityFormatter.addFormattingSpecsToRegistry({ name, persistenceUnitName: "Units.M", formatProps: simpleFormat, system: "metric" });
    const firstLookupStarted = deferred<void>();
    const releaseFirstLookup = deferred<void>();
    let lookupCount = 0;
    const provider = createFormatsProvider(async () => {
      if (lookupCount++ === 0) {
        firstLookupStarted.resolve();
        await releaseFirstLookup.promise;
      }
      return undefined;
    });

    try {
      const firstReplacement = IModelApp.setFormatsProvider(provider, { unitSystem: "metric" });
      await firstLookupStarted.promise;
      const secondReplacement = IModelApp.setFormatsProvider(provider);
      releaseFirstLookup.resolve();

      await Promise.all([
        firstReplacement.catch(() => undefined),
        secondReplacement,
      ]);
      expect(quantityFormatter.activeUnitSystem).toBe("imperial");
    } finally {
      releaseFirstLookup.resolve();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("keeps the applied provider and cache coherent after a fatal replacement failure", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const name = "TestKoQ.PROVIDER_REPLACEMENT_ATOMICITY";
    const providerA = createFormatsProvider(async (formatName) => formatName === name ? simpleFormat : undefined);
    const providerB = createFormatsProvider(async (formatName) => {
      if (formatName === name)
        throw new Error("provider B failed");
      return undefined;
    });

    await quantityFormatter.addFormattingSpecsToRegistry({
      name,
      persistenceUnitName: "Units.M",
      formatProps: simpleFormat,
      system: "metric",
    });

    try {
      await IModelApp.setFormatsProvider(providerA);
      await expect(IModelApp.setFormatsProvider(providerB)).rejects.toThrow("provider B failed");

      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(simpleFormat);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })).toBeDefined();
    } finally {
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider());
    }
  });

  it("does not emit a unit-system change when the implied system is already active", async () => {
    const quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
    const systemChanged = vi.fn();
    const removeSystemChangedListener = quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(systemChanged);
    const ready = new Promise<void>((resolve) => quantityFormatter.onFormattingReady.addOnce(resolve));

    try {
      IModelApp.formatsProvider.onFormatsChanged.raiseEvent({
        formatsChanged: "all",
        impliedUnitSystem: quantityFormatter.activeUnitSystem,
      });
      await ready;
      expect(systemChanged).not.toHaveBeenCalled();
    } finally {
      removeSystemChangedListener();
      quantityFormatter[Symbol.dispose]();
    }
  });

  it("does not register a provider listener after disposal during initialization", async () => {
    const quantityFormatter = new QuantityFormatter();
    const providerEvents = IModelApp.formatsProvider.onFormatsChanged;
    const listenerCountBeforeInitialization = providerEvents.numberOfListeners;

    try {
      const initialization = quantityFormatter.onInitialized();
      quantityFormatter[Symbol.dispose]();
      await initialization;
      expect(providerEvents.numberOfListeners).toBe(listenerCountBeforeInitialization);
    } finally {
      quantityFormatter[Symbol.dispose]();
    }
  });
});
