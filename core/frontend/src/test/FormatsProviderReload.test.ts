/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { FormatDefinition, FormatsChangedArgs, FormatsProvider, FormatsProviderContext, SyncFormatsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { IModelApp } from "../IModelApp";
import { FormatsProviderManager, QuantityFormatter, QuantityType, QuantityTypeFormatsProvider } from "../quantity-formatting/QuantityFormatter";

function deferred<T>() {
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
      expect(quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length)?.format.units?.[0][0].name).toBe("Units.FT");
    } finally {
      releaseLoad.resolve();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("keeps the unit system from an earlier replacement when the next replacement omits it", async () => {
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
      expect(quantityFormatter.activeUnitSystem).toBe("metric");
      expect(systemChanged).toHaveBeenCalledTimes(1);
      expect(systemChanged).toHaveBeenCalledWith({ system: "metric" });
    } finally {
      releaseFirstLookup.resolve();
      removeSystemChangedListener();
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("does not drop a provider replacement or unit-system change queued behind other reloads", async () => {
    const quantityFormatter = IModelApp.quantityFormatter;
    const originalUnitSystem = quantityFormatter.activeUnitSystem;
    const nextUnitSystem = originalUnitSystem === "metric" ? "imperial" : "metric";
    const name = "TestKoQ.PROVIDER_QUEUED_AHEAD_OF_SYSTEM";
    const providerFormat = { ...simpleFormat, precision: 5 };
    await quantityFormatter.addFormattingSpecsToRegistry({ name, persistenceUnitName: "Units.M", formatProps: simpleFormat, system: "metric" });

    const loadStarted = deferred<void>();
    const releaseLoad = deferred<void>();
    // Block the units-provider reload at its start, before the registry is rebuilt.
    const originalInitialize = (quantityFormatter as any).initializeQuantityTypesRegistry.bind(quantityFormatter);
    let shouldBlock = true;
    (quantityFormatter as any).initializeQuantityTypesRegistry = async function (...args: any[]) {
      if (shouldBlock) {
        shouldBlock = false;
        loadStarted.resolve();
        await releaseLoad.promise;
      }
      return originalInitialize(...args);
    };

    const provider = createFormatsProvider(async (formatName) => formatName === name ? providerFormat : undefined);
    try {
      const unrelatedReload = quantityFormatter.setUnitsProvider(quantityFormatter.unitsProvider);
      await loadStarted.promise;
      const providerReload = IModelApp.setFormatsProvider(provider);
      const systemReload = quantityFormatter.setActiveUnitSystem(nextUnitSystem);
      // A units-provider reload queued after the unit-system change replaces it in the queue, but must still load the requested system.
      const secondUnrelatedReload = quantityFormatter.setUnitsProvider(quantityFormatter.unitsProvider);
      releaseLoad.resolve();

      await unrelatedReload;
      await providerReload;
      await systemReload;
      await secondUnrelatedReload;
      await expect(IModelApp.formatsProvider.getFormat(name, "metric")).resolves.toEqual(providerFormat);
      expect(quantityFormatter.getSpecsByNameAndUnit({ name, persistenceUnitName: "Units.M", system: "metric" })?.formatterSpec.format.precision).toBe(5);
      expect(quantityFormatter.activeUnitSystem).toBe(nextUnitSystem);
      expect(quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length)?.format.units?.[0][0].name).toBe(nextUnitSystem === "metric" ? "Units.M" : "Units.FT");
    } finally {
      releaseLoad.resolve();
      (quantityFormatter as any).initializeQuantityTypesRegistry = originalInitialize;
      await IModelApp.setFormatsProvider(new QuantityTypeFormatsProvider(), { unitSystem: originalUnitSystem });
    }
  });

  it("rejects a provider replacement whose reload fails, even when other reloads are queued", async () => {
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

      const originalUnitSystem = quantityFormatter.activeUnitSystem;
      const replacement = IModelApp.setFormatsProvider(providerB);
      // A unit-system change queued behind the failing reload succeeds, but must not turn the failure into success.
      const systemReload = quantityFormatter.setActiveUnitSystem(originalUnitSystem === "metric" ? "imperial" : "metric");
      await expect(replacement).rejects.toThrow("provider B failed");
      await systemReload;
      await quantityFormatter.setActiveUnitSystem(originalUnitSystem);
      expect(quantityFormatter.isReady).toBe(true);
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
        const replacement = IModelApp.setFormatsProvider(provider);
        // The new provider reports its own change before its replacement reload finishes, as FormatSetFormatsProvider.addFormat does.
        provider.onFormatsChanged.raiseEvent({ formatsChanged: ["TestKoQ.ADDED_DURING_REPLACEMENT"] });
        await expect(replacement).resolves.toBeUndefined();
        expect(appQuantityFormatter.activeUnitSystem).toBe("metric");
        expect(appQuantityFormatter.isReady).toBe(true);
        expect(formatsChangedSpy).toHaveBeenCalledTimes(2);
        expect(formatsChangedSpy).toHaveBeenNthCalledWith(1, { formatsChanged: "all" });
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

    it("should forward format lookup context to the underlying provider", async () => {
      const context: FormatsProviderContext = { providerChain: new Set<FormatsProvider>() };
      let receivedName: string | undefined;
      let receivedSystem: UnitSystemKey | undefined;
      let receivedContext: FormatsProviderContext | undefined;
      const provider: FormatsProvider = {
        async getFormat(name, system, lookupContext) {
          receivedName = name;
          receivedSystem = system;
          receivedContext = lookupContext;
          return undefined;
        },
        onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
      };
      const manager = new FormatsProviderManager(provider);

      await expect(manager.getFormat("TestFormat", "metric", context)).resolves.toBeUndefined();
      expect(receivedName).toBe("TestFormat");
      expect(receivedSystem).toBe("metric");
      expect(receivedContext).toBe(context);
    });

    it("should forward synchronous format lookups to the current synchronous provider", () => {
      const context: FormatsProviderContext = { providerChain: new Set<FormatsProvider>() };
      const definition: FormatDefinition = { type: "Decimal", precision: 4 };
      const getFormatSync = vi.fn((_name: string, _system?: UnitSystemKey, _context?: FormatsProviderContext) => definition);
      const provider: FormatsProvider & SyncFormatsProvider = {
        async getFormat() { return undefined; },
        getFormatSync,
        onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
      };
      const manager = new FormatsProviderManager(createFormatsProvider(async () => undefined));
      expect(manager.getFormatSync("TestFormat", "metric", context)).toBeUndefined();

      manager.setFormatsProvider(provider);
      expect(manager.getFormatSync("TestFormat", "metric", context)).toBe(definition);
      expect(getFormatSync).toHaveBeenCalledWith("TestFormat", "metric", context);
    });

    it("should return undefined for synchronous lookups when the provider is asynchronous only", () => {
      const getFormat = vi.fn(async () => undefined);
      const manager = new FormatsProviderManager({ getFormat, onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>() });

      expect(manager.getFormatSync("TestFormat", "metric")).toBeUndefined();
      expect(getFormat).not.toHaveBeenCalled();
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
    const originalLoad = (qf as any).loadFormatAndParsingMapsForSystem.bind(qf);
    let loadCount = 0;
    (qf as any).loadFormatAndParsingMapsForSystem = async function (...args: any[]) {
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
      (qf as any).loadFormatAndParsingMapsForSystem = originalLoad;
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
    const originalLoad = (qf as any).loadFormatAndParsingMapsForSystem.bind(qf);
    (qf as any).loadFormatAndParsingMapsForSystem = async function (...args: any[]) {
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
      (qf as any).loadFormatAndParsingMapsForSystem = originalLoad;
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
