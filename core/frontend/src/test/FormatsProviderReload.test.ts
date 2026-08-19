/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

const incompatibleBearingFormat: FormatDefinition = {
  type: "Bearing",
  precision: 2,
  revolutionUnit: "Units.REVOLUTION",
  formatTraits: ["showUnitLabel"],
  uomSeparator: "",
  composite: {
    includeZero: true,
    spacer: "",
    units: [{ name: "Units.ARC_DEG", label: "°" }],
  },
};

const compatibleBearingFormat: FormatDefinition = {
  ...incompatibleBearingFormat,
  revolutionUnit: "Units.HORIZONTAL_DIR_REVOLUTION",
  composite: {
    ...incompatibleBearingFormat.composite,
    units: [{ name: "Units.HORIZONTAL_DIR_ARC_DEG", label: "°" }],
  },
};

function createIncompatibleBearingProvider(name: string): FormatsProvider {
  return createFormatsProvider(async (formatName) => formatName === name ? incompatibleBearingFormat : undefined);
}

function rejectCrossPhenomenonConversions(quantityFormatter: QuantityFormatter): () => void {
  const unitsProvider = quantityFormatter.unitsProvider;
  const originalGetConversion = unitsProvider.getConversion.bind(unitsProvider);
  unitsProvider.getConversion = async (fromUnit, toUnit) => {
    if (fromUnit.phenomenon !== toUnit.phenomenon)
      throw new Error("Source and target units do not belong to same phenomenon");
    return originalGetConversion(fromUnit, toUnit);
  };
  return () => unitsProvider.getConversion = originalGetConversion;
}

describe("Formats provider reload invariants", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("keeps latest-wins ownership correct under reentrant provider events", async () => {
    const name = "TestKoQ.REENTRANT_PROVIDER";
    const providerFormatA = { ...simpleFormat, precision: 3 };
    const providerFormatB = { ...simpleFormat, precision: 4 };
    const quantityFormatter = IModelApp.quantityFormatter;
    await quantityFormatter.addFormattingSpecsToRegistry({ name, persistenceUnitName: "Units.M", formatProps: simpleFormat, system: "metric" });
    const providerA = createFormatsProvider(async (formatName) => formatName === name ? providerFormatA : undefined);
    const providerB = createFormatsProvider(async (formatName) => formatName === name ? providerFormatB : undefined);
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
      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(providerFormatB);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })?.formatterSpec.format.precision).toBe(4);
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
    const systemChanged = vi.fn();
    const removeSystemChangedListener = quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(systemChanged);

    try {
      const firstReplacement = IModelApp.setFormatsProvider(provider, { unitSystem: "metric" });
      await firstLookupStarted.promise;
      const secondReplacement = IModelApp.setFormatsProvider(provider);
      releaseFirstLookup.resolve();

      await expect(firstReplacement).rejects.toThrow(/superseded/i);
      await expect(secondReplacement).resolves.toBeUndefined();
      expect(quantityFormatter.activeUnitSystem).toBe("imperial");
      expect(systemChanged).not.toHaveBeenCalled();
    } finally {
      releaseFirstLookup.resolve();
      removeSystemChangedListener();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("does not drop a provider replacement queued ahead of an unrelated reload", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const originalUnitSystem = quantityFormatter.activeUnitSystem;
    const nextUnitSystem = originalUnitSystem === "metric" ? "imperial" : "metric";
    const name = "TestKoQ.PROVIDER_QUEUED_AHEAD_OF_SYSTEM";
    const providerFormat = { ...simpleFormat, precision: 5 };
    await quantityFormatter.addFormattingSpecsToRegistry({ name, persistenceUnitName: "Units.M", formatProps: simpleFormat, system: "metric" });

    const loadStarted = deferred<void>();
    const releaseLoad = deferred<void>();
    const originalBuild = (quantityFormatter as any)._buildFormatAndParsingMapsForSystem.bind(quantityFormatter);
    let shouldBlock = true;
    (quantityFormatter as any)._buildFormatAndParsingMapsForSystem = async function (...args: any[]) {
      if (shouldBlock) {
        shouldBlock = false;
        loadStarted.resolve();
        await releaseLoad.promise;
      }
      return originalBuild(...args);
    };

    const provider = createFormatsProvider(async (formatName) => formatName === name ? providerFormat : undefined);
    try {
      const unrelatedReload = quantityFormatter.setUnitsProvider(quantityFormatter.unitsProvider);
      await loadStarted.promise;
      const providerReload = IModelApp.setFormatsProvider(provider);
      const systemReload = quantityFormatter.setActiveUnitSystem(nextUnitSystem);
      releaseLoad.resolve();

      await unrelatedReload;
      await providerReload;
      await systemReload;
      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(providerFormat);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })?.formatterSpec.format.precision).toBe(5);
    } finally {
      releaseLoad.resolve();
      (quantityFormatter as any)._buildFormatAndParsingMapsForSystem = originalBuild;
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("keeps the applied provider and cache coherent after a fatal replacement failure", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const name = "TestKoQ.PROVIDER_REPLACEMENT_ATOMICITY";
    const providerAFormat = { ...simpleFormat, precision: 3 };
    const providerA = createFormatsProvider(async (formatName) => formatName === name ? providerAFormat : undefined);
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
      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(providerAFormat);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })?.formatterSpec.format.precision).toBe(3);

      await expect(IModelApp.setFormatsProvider(providerB)).rejects.toThrow("provider B failed");
      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(providerAFormat);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })?.formatterSpec.format.precision).toBe(3);
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

  it("does not register a provider listener after initialization is called on a disposed formatter", async () => {
    const quantityFormatter = new QuantityFormatter();
    const providerEvents = IModelApp.formatsProvider.onFormatsChanged;
    const listenerCountBeforeInitialization = providerEvents.numberOfListeners;
    quantityFormatter[Symbol.dispose]();

    await quantityFormatter.onInitialized();
    expect(providerEvents.numberOfListeners).toBe(listenerCountBeforeInitialization);
  });

  it("drains a reload queued before formatting finalization fails", async () => {
    const quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
    let failFinalization = true;
    let pendingSystemChange: Promise<void> | undefined;
    const removeReadyWork = quantityFormatter.onBeforeFormattingReady.addListener(() => {
      if (failFinalization) {
        failFinalization = false;
        pendingSystemChange = quantityFormatter.setActiveUnitSystem("imperial");
        throw new Error("simulated finalization failure");
      }
    });

    try {
      await expect(quantityFormatter.runAndWaitForReload(() => {
        void quantityFormatter.setActiveUnitSystem("metric");
      })).resolves.toBeUndefined();
      await pendingSystemChange;
      expect(quantityFormatter.activeUnitSystem).toBe("imperial");
      expect(quantityFormatter.isReady).toBe(true);
    } finally {
      removeReadyWork();
      quantityFormatter[Symbol.dispose]();
    }
  });

  describe("FormatsProviderManager", async () => {

    it("Should raise formatsChanged event when updating formatsProvider", () => {
      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      const testProvider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = testProvider;

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ formatsChanged: "all" });
    });

    it("should raise formatsChanged event when calling resetFormatsProvider", () => {
      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      IModelApp.resetFormatsProvider();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ formatsChanged: "all" });
    });

    it("should set the optional unit system in the same formats provider reload", async () => {
      const appQuantityFormatter = IModelApp.quantityFormatter;
      const originalUnitSystem = appQuantityFormatter.activeUnitSystem;
      await appQuantityFormatter.setActiveUnitSystem("imperial");
      const provider = {
        onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
        async getFormat(): Promise<undefined> { return undefined; },
      };
      const formatsChangedSpy = vi.fn();
      const readySpy = vi.fn();
      const removeFormatsChangedListener = IModelApp.formatsProvider.onFormatsChanged.addListener(formatsChangedSpy);
      const removeReadyListener = appQuantityFormatter.onFormattingReady.addListener(readySpy);

      try {
        await IModelApp.setFormatsProvider(provider, { unitSystem: "metric" });
        expect(appQuantityFormatter.activeUnitSystem).toBe("metric");
        expect(formatsChangedSpy).toHaveBeenCalledTimes(1);
        expect(formatsChangedSpy).toHaveBeenCalledWith({ formatsChanged: "all", impliedUnitSystem: "metric" });
        expect(readySpy).toHaveBeenCalledTimes(1);

        formatsChangedSpy.mockClear();
        readySpy.mockClear();
        await IModelApp.setFormatsProvider(provider);
        expect(appQuantityFormatter.activeUnitSystem).toBe("metric");
        expect(formatsChangedSpy).toHaveBeenCalledTimes(1);
        expect(formatsChangedSpy).toHaveBeenCalledWith({ formatsChanged: "all" });
        expect(readySpy).toHaveBeenCalledTimes(1);
      } finally {
        removeFormatsChangedListener();
        removeReadyListener();
        await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
      }
    });

    it("resolves when incompatible provider entries are omitted from the registry", async () => {
      const appQuantityFormatter = IModelApp.quantityFormatter;
      const name = "TestKoQ.INCOMPATIBLE_BEARING";
      const registeredFormat = compatibleBearingFormat;
      const provider = createIncompatibleBearingProvider(name);
      const restoreConversion = rejectCrossPhenomenonConversions(appQuantityFormatter);

      await appQuantityFormatter.addFormattingSpecsToRegistry({
        name,
        persistenceUnitName: "Units.HORIZONTAL_DIR_RAD",
        formatProps: registeredFormat,
        system: "metric",
      });
      expect(appQuantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.HORIZONTAL_DIR_RAD", system: "metric" })).toBeDefined();

      try {
        await expect(IModelApp.setFormatsProvider(provider)).resolves.toBeUndefined();
        expect(appQuantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.HORIZONTAL_DIR_RAD", system: "metric" })).toBeUndefined();
      } finally {
        restoreConversion();
        await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider());
      }
    });

    it("should wait for provider-triggered reloads queued during formatting readiness", async () => {
      const appQuantityFormatter = IModelApp.quantityFormatter;
      const originalUnitSystem = appQuantityFormatter.activeUnitSystem;
      const nextUnitSystem = originalUnitSystem === "metric" ? "imperial" : "metric";
      const provider = new QuantityTypeFormatsProvider();
      const readySpy = vi.fn();
      const removeReadyListener = appQuantityFormatter.onFormattingReady.addListener(readySpy);

      try {
        await IModelApp.setFormatsProvider(provider, { unitSystem: nextUnitSystem });
        expect(readySpy).toHaveBeenCalledTimes(2);
      } finally {
        removeReadyListener();
        await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
        provider[Symbol.dispose]();
      }
    });

    it("should raise formatsChanged event when underlying formatsProvider raises formatsChanged event", async () => {

      const testProvider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = testProvider;

      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);
      testProvider.onFormatsChanged.raiseEvent({ formatsChanged: ["foobar"]});


      IModelApp.resetFormatsProvider();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: ["foobar"] });
      expect(spy.mock.calls[1][0]).toEqual({ formatsChanged: "all" });

    });

    it("getFormat should honor the requested unit system", async () => {
      const provider = new QuantityTypeFormatsProvider();
      const metricFormat = await provider.getFormat("DefaultToolsUnits.LENGTH", "metric");
      const imperialFormat = await provider.getFormat("DefaultToolsUnits.LENGTH", "imperial");
      expect(metricFormat).toBeDefined();
      expect(imperialFormat).toBeDefined();
      // Before the fix, the requested system was ignored and both returned the active-system format.
      expect(metricFormat).not.toEqual(imperialFormat);
    });

    it("should not leak listeners when formatsProvider is replaced multiple times", () => {
      const provider1 = new QuantityTypeFormatsProvider();
      const provider2 = new QuantityTypeFormatsProvider();

      IModelApp.formatsProvider = provider1;
      IModelApp.formatsProvider = provider2;

      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      // Raising on provider1 should NOT fire — the old listener was removed
      provider1.onFormatsChanged.raiseEvent({ formatsChanged: ["old"] });
      expect(spy).toHaveBeenCalledTimes(0);

      // Raising on provider2 SHOULD fire — it's the current provider
      provider2.onFormatsChanged.raiseEvent({ formatsChanged: ["new"] });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: ["new"] });
    });
  });

  it("latest runAndWaitForReload request supersedes the previous request", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    let releaseFirstLoad!: () => void;
    const firstLoad = new Promise<void>((resolve) => { releaseFirstLoad = resolve; });
    let firstLoadStarted!: () => void;
    const firstLoadStartedPromise = new Promise<void>((resolve) => { firstLoadStarted = resolve; });
    const originalLoad = (qf as any)._buildFormatAndParsingMapsForSystem.bind(qf);
    let loadCount = 0;
    (qf as any)._buildFormatAndParsingMapsForSystem = async function (...args: any[]) {
      if (++loadCount === 1) {
        firstLoadStarted();
        await firstLoad;
      }
      return originalLoad(...args);
    };

    let firstSet!: Promise<void>;
    let secondSet!: Promise<void>;
    try {
      const firstRequest = qf.runAndWaitForReload(() => {
        firstSet = qf.setActiveUnitSystem("metric");
      });
      await firstLoadStartedPromise;

      const secondRequest = qf.runAndWaitForReload(() => {
        secondSet = qf.setActiveUnitSystem("imperial");
      });

      await expect(firstRequest).rejects.toThrow("superseded");
      releaseFirstLoad();
      await expect(secondRequest).resolves.toBeUndefined();
      await firstSet;
      await secondSet;
      expect(qf.activeUnitSystem).toBe("imperial");
    } finally {
      releaseFirstLoad();
      (qf as any)._buildFormatAndParsingMapsForSystem = originalLoad;
      qf[Symbol.dispose]();
    }
  });

  it("rejects a waiting reload when disposed and suppresses completion events", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    let releaseLoad!: () => void;
    const load = new Promise<void>((resolve) => { releaseLoad = resolve; });
    let loadStarted!: () => void;
    const loadStartedPromise = new Promise<void>((resolve) => { loadStarted = resolve; });
    const originalLoad = (qf as any)._buildFormatAndParsingMapsForSystem.bind(qf);
    (qf as any)._buildFormatAndParsingMapsForSystem = async function (...args: any[]) {
      loadStarted();
      await load;
      return originalLoad(...args);
    };

    const readySpy = vi.fn();
    const removeReadyListener = qf.onFormattingReady.addListener(readySpy);
    let setActiveSystem!: Promise<void>;
    try {
      const reload = qf.runAndWaitForReload(() => {
        setActiveSystem = qf.setActiveUnitSystem("metric");
      });
      await loadStartedPromise;

      qf[Symbol.dispose]();
      await expect(reload).rejects.toThrow("disposed");
      releaseLoad();
      await setActiveSystem;
      expect(qf.isReady).toBe(false);
      expect(readySpy).not.toHaveBeenCalled();
    } finally {
      releaseLoad();
      removeReadyListener();
      (qf as any)._buildFormatAndParsingMapsForSystem = originalLoad;
      qf[Symbol.dispose]();
    }
  });

  describe("_rebuildRegistryFromProvider", () => {
    const localFormatters: QuantityFormatter[] = [];
    afterEach(() => {
      for (const quantityFormatter of localFormatters)
        quantityFormatter[Symbol.dispose]();
      localFormatters.length = 0;
      IModelApp.resetFormatsProvider();
    });

    const simpleDecimalFormat = {
      type: "Decimal" as const,
      precision: 4,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      composite: { includeZero: true, units: [{ name: "Units.M", label: "m" }] },
    };

    it("rebuilds registry when formatsProvider raises formatsChanged with 'all'", async () => {
      const qf = new QuantityFormatter();
      localFormatters.push(qf);
      await qf.onInitialized();

      // Add a custom entry to the registry
      await qf.addFormattingSpecsToRegistry({
        name: "TestKoQ.CUSTOM",
        persistenceUnitName: "Units.M",
        formatProps: simpleDecimalFormat,
        system: "metric",
      });
      const entryBefore = qf.getSpecsByNameAndUnit({ name: "TestKoQ.CUSTOM", persistenceUnitName: "Units.M", system: "metric" });
      expect(entryBefore).toBeDefined();

      // Trigger a formatsChanged "all" event — the provider returns undefined for our custom name,
      // so the entry should be removed from the registry
      const provider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = provider;

      // Wait for reload to finish
      await new Promise<void>((resolve) => {
        qf.onFormattingReady.addListener(resolve);
      });

      // Our custom KoQ is not in QuantityTypeFormatsProvider, so _rebuildRegistryFromProvider
      // should have removed it (anySystemHadFormat === false → delete from registry)
      const entryAfter = qf.getSpecsByNameAndUnit({ name: "TestKoQ.CUSTOM", persistenceUnitName: "Units.M", system: "metric" });
      expect(entryAfter).toBeUndefined();
    });

    it("rebuilds only named formats when formatsChanged is a string array", async () => {
      const qf = new QuantityFormatter();
      localFormatters.push(qf);
      await qf.onInitialized();

      // The default initialization creates entries for DefaultToolsUnits.LENGTH, etc.
      const lengthBefore = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
      expect(lengthBefore).toBeDefined();

      const angleBefore = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.ANGLE", persistenceUnitName: "Units.RAD", system: "metric" });
      expect(angleBefore).toBeDefined();

      // Create a provider and trigger a formatsChanged with only "DefaultToolsUnits.LENGTH"
      const provider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = provider;

      // Wait for "all" reload
      await new Promise<void>((resolve) => {
        qf.onFormattingReady.addListener(resolve);
      });

      // Now fire a targeted change event for just LENGTH
      provider.onFormatsChanged.raiseEvent({ formatsChanged: ["DefaultToolsUnits.LENGTH"] });

      await new Promise<void>((resolve) => {
        qf.onFormattingReady.addListener(resolve);
      });

      // Both should still exist (the provider returns formats for both)
      const lengthAfter = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
      const angleAfter = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.ANGLE", persistenceUnitName: "Units.RAD", system: "metric" });
      expect(lengthAfter).toBeDefined();
      expect(angleAfter).toBeDefined();
    });

    it("allows onBeforeFormattingReady to replace an incompatible provider format", async () => {
      const name = "TestKoQ.HORIZONTAL_BEARING";
      const manuallyRegisteredFormat = compatibleBearingFormat;
      const provider = createIncompatibleBearingProvider(name);
      const qf = new QuantityFormatter();
      let removeReadyListener: (() => void) | undefined;
      let restoreConversion: (() => void) | undefined;

      try {
        IModelApp.formatsProvider = provider;
        await qf.onInitialized();

        // Schema-backed units providers throw when a format and persistence unit belong to different phenomena.
        restoreConversion = rejectCrossPhenomenonConversions(qf);

        await qf.addFormattingSpecsToRegistry({
          name,
          persistenceUnitName: "Units.HORIZONTAL_DIR_RAD",
          formatProps: manuallyRegisteredFormat,
          system: "metric",
        });
        expect(qf.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.HORIZONTAL_DIR_RAD", system: "metric" })).toBeDefined();

        let replacementRegistered = false;
        qf.onBeforeFormattingReady.addListener((collector) => {
          if (!qf.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.HORIZONTAL_DIR_RAD", system: "metric" })) {
            replacementRegistered = true;
            collector.addPendingWork(qf.addFormattingSpecsToRegistry({
              name,
              persistenceUnitName: "Units.HORIZONTAL_DIR_RAD",
              formatProps: manuallyRegisteredFormat,
              system: "metric",
            }));
          }
        });

        const readySpy = vi.fn();
        removeReadyListener = qf.onFormattingReady.addListener(readySpy);
        provider.onFormatsChanged.raiseEvent({ formatsChanged: [name] });

        await vi.waitFor(() => expect(readySpy).toHaveBeenCalledTimes(1), { timeout: 1000 });
        expect(replacementRegistered).toBe(true);
        const entryAfter = qf.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.HORIZONTAL_DIR_RAD", system: "metric" });
        expect(entryAfter).toBeDefined();
        expect(entryAfter?.formatterSpec.format.revolutionUnit?.name).toBe("Units.HORIZONTAL_DIR_REVOLUTION");
        expect(entryAfter?.parserSpec.format.revolutionUnit?.name).toBe("Units.HORIZONTAL_DIR_REVOLUTION");
      } finally {
        removeReadyListener?.();
        restoreConversion?.();
        qf[Symbol.dispose]();
        IModelApp.resetFormatsProvider();
      }
    });
  });
});
