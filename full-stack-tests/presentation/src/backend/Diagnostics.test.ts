/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { using } from "@itwin/core-bentley";
import { Presentation, PresentationManager } from "@itwin/presentation-backend";
import { ChildNodeSpecificationTypes, Diagnostics, DiagnosticsLogEntry, PresentationError, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("Diagnostics", async () => {
  const ruleset: Ruleset = {
    id: "ruleset",
    rules: [
      {
        ruleType: RuleTypes.RootNodes,
        specifications: [
          {
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
          },
        ],
      },
    ],
  };

  let imodel: IModelDb;
  before(async () => {
    await initialize();
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  it("includes diagnostics if request takes longer than minimum duration", async () => {
    const requestDiagnosticsSpy = sinon.spy();
    await using(new PresentationManager(), async (manager) => {
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          perf: { minimumDuration: 1 },
          handler: requestDiagnosticsSpy,
        },
      });
    });
    expect(requestDiagnosticsSpy).to.be.calledOnceWith(sinon.match((d: Diagnostics) => d && d.logs && d.logs.length > 0));
  });

  it("doesn't include diagnostics if request takes less time than minimum duration", async () => {
    const requestDiagnosticsSpy = sinon.spy();
    await using(new PresentationManager(), async (manager) => {
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          perf: { minimumDuration: 5000 },
          handler: requestDiagnosticsSpy,
        },
      });
    });
    expect(requestDiagnosticsSpy).to.not.be.called;
  });

  it("includes diagnostics if request fails", async () => {
    const requestDiagnosticsSpy = sinon.spy();
    await expect(
      using(new PresentationManager(), async (manager) => {
        await manager.getNodes({
          imodel,
          rulesetOrId: ruleset,
          instanceFilter: {} as any,
          diagnostics: {
            dev: "error",
            handler: requestDiagnosticsSpy,
          },
        });
      }),
    ).to.eventually.be.rejectedWith(PresentationError);
    expect(requestDiagnosticsSpy).to.be.calledOnceWith(sinon.match((d: Diagnostics) => d && d.logs && d.logs.length > 0));
  });

  it("doesn't report request diagnostics if not requested when manager diagnostics requested", async () => {
    const managerDiagnosticsSpy = sinon.spy();
    const requestDiagnosticsSpy = sinon.spy();
    await using(new PresentationManager({ diagnostics: { dev: true, editor: true, perf: true, handler: managerDiagnosticsSpy } }), async (manager) => {
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          handler: requestDiagnosticsSpy,
        },
      });
    });
    expect(requestDiagnosticsSpy).to.not.be.called;
    expect(managerDiagnosticsSpy).to.be.calledOnce;
  });

  it("doesn't report manager diagnostics if not requested when request diagnostics requested", async () => {
    const managerDiagnosticsSpy = sinon.spy();
    const requestDiagnosticsSpy = sinon.spy();
    await using(new PresentationManager({ diagnostics: { handler: managerDiagnosticsSpy } }), async (manager) => {
      await manager.getNodes({
        imodel,
        rulesetOrId: ruleset,
        diagnostics: {
          dev: true,
          editor: true,
          perf: true,
          handler: requestDiagnosticsSpy,
        },
      });
    });
    expect(requestDiagnosticsSpy).to.be.calledOnce;
    expect(managerDiagnosticsSpy).to.not.be.called;
  });

  it("reports with only requested diagnostics", async () => {
    const managerDiagnosticsContext = {};
    const managerDiagnosticsSpy = sinon.spy();
    const requestDiagnosticsContext = {};
    const requestDiagnosticsSpy = sinon.spy();
    await using(
      new PresentationManager({
        diagnostics: { perf: true, dev: "trace", handler: managerDiagnosticsSpy, requestContextSupplier: () => managerDiagnosticsContext },
      }),
      async (manager) => {
        await manager.getNodes({
          imodel,
          rulesetOrId: ruleset,
          diagnostics: {
            editor: "trace",
            handler: requestDiagnosticsSpy,
            requestContextSupplier: () => requestDiagnosticsContext,
          },
        });
      },
    );
    expect(managerDiagnosticsSpy).be.calledOnceWithExactly(
      sinon.match((d: Diagnostics) => {
        function isPerfOrDevLog(entry: DiagnosticsLogEntry): boolean {
          if (DiagnosticsLogEntry.isMessage(entry)) {
            return entry.severity.dev !== undefined;
          }
          return (
            ((entry.duration !== undefined && entry.scopeCreateTimestamp !== undefined) || entry.logs !== undefined) &&
            (!entry.logs || entry.logs.every(isPerfOrDevLog))
          );
        }
        return d.logs && d.logs.length > 0 && d.logs.every(isPerfOrDevLog);
      }),
      managerDiagnosticsContext,
    );
    expect(requestDiagnosticsSpy).to.calledOnceWithExactly(
      sinon.match((d: Diagnostics) => {
        function isEditorLog(entry: DiagnosticsLogEntry): boolean {
          if (DiagnosticsLogEntry.isMessage(entry)) {
            return entry.severity.editor !== undefined;
          }
          return entry.duration === undefined && entry.scopeCreateTimestamp === undefined && (!entry.logs || entry.logs.every(isEditorLog));
        }
        return d.logs && d.logs.length > 0 && d.logs.every(isEditorLog);
      }),
      requestDiagnosticsContext,
    );
  });
});

describe("Learning Snippets", () => {
  describe("Diagnostics", async () => {
    let imodel: IModelDb;
    before(async () => {
      await initialize();
      imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
      expect(imodel).is.not.null;
    });

    after(async () => {
      imodel.close();
      await terminate();
    });

    it("gets backend per-request diagnostics", async () => {
      const log = sinon.stub();
      const elementId = "0x1";
      // __PUBLISH_EXTRACT_START__ Presentation.Diagnostics.Backend.PerRequest
      await Presentation.getManager().getElementProperties({
        imodel,
        elementId,
        diagnostics: {
          // request performance metrics
          perf: true,
          // supply a callback that'll receive the diagnostics
          handler: (diagnostics: Diagnostics) => {
            // log duration of each diagnostics scope
            diagnostics.logs &&
              diagnostics.logs.forEach((entry) => {
                log(`${entry.scope}: ${entry.duration}`);
              });
          },
        },
      });
      // __PUBLISH_EXTRACT_END__
      expect(log).to.be.calledOnce;
      expect(log.firstCall.args[0]).to.match(/GetContent: \d+/);
    });

    it("gets backend per-manager diagnostics", async () => {
      Presentation.terminate();

      let requestIndex = 0;
      const getCurrentActivityId = sinon.fake(() => (++requestIndex).toString());

      const log = sinon.stub();
      const id1 = "0x1";
      const id2 = "0x2";

      // __PUBLISH_EXTRACT_START__ Presentation.Diagnostics.Backend.PerManager
      Presentation.initialize({
        diagnostics: {
          // request performance metrics
          perf: true,
          // supply a method to capture current request context
          requestContextSupplier: getCurrentActivityId,
          // supply a callback that'll receive the diagnostics and request context supplied by `requestContextSupplier`
          handler: (diagnostics: Diagnostics, currentActivityId?: string) => {
            // log duration of each diagnostics scope
            diagnostics.logs &&
              diagnostics.logs.forEach((entry) => {
                log(`[${currentActivityId}] ${entry.scope}: ${entry.duration}`);
              });
          },
        },
      });

      // diagnostics of the following requests are captured by the handler supplied to `Presentation.initialize` call
      await Presentation.getManager().getElementProperties({ imodel, elementId: id1 });
      await Presentation.getManager().getElementProperties({ imodel, elementId: id2 });
      // __PUBLISH_EXTRACT_END__

      expect(getCurrentActivityId).to.be.calledTwice;
      expect(log).to.be.calledTwice;
      expect(log.firstCall.args[0]).to.match(/\[1\] GetContent: \d+/);
      expect(log.secondCall.args[0]).to.match(/\[2\] GetContent: \d+/);
    });
  });
});
