/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { RenderTarget } from "../../render/RenderTarget";

/** Diagnostic state of an actual Gaussian color draw. No images or credentials are included. @internal */
export interface GaussianSplatFrameState {
  phase: "draw" | "dispose";
  time: number;
  candidateVersion: number;
  completedVersion: number;
  selectedGeometryIds: number[];
  completedGeometryIds: number[];
  drawnGeometryIds: number[];
  sourceModelIds: string[];
  /** Unique instances in the displayed field; color-space filtering can submit these more than once. */
  drawnInstances: number;
  drawCalls: number;
  submittedInstances: number;
  awaitingCandidate: boolean;
  /** A previously complete source still lacks ready native coverage for its replacement. */
  awaitingCoverage: boolean;
  /** Current native Gaussian sources have ready visible coverage, including ready fallbacks. */
  coverageComplete: boolean;
  sorting: boolean;
  sortAgeMs?: number;
  candidateAgeMs?: number;
  atlasPages: number;
  atlasBytes: number;
  /** Packed arrays leased by this viewport, including current and completed fields; excludes worker/GPU buffers. */
  packedSplatBytes: number;
  failed: boolean;
}

/** @internal */
export type GaussianSplatFrameObserver = (state: Readonly<GaussianSplatFrameState>) => void;

const observers = new WeakMap<RenderTarget, Set<GaussianSplatFrameObserver>>();

/** Observe one native target. Recording is opt-in; removing the last observer disables snapshot allocation. @internal */
export function observeGaussianSplats(target: RenderTarget, observer: GaussianSplatFrameObserver): () => void {
  let set = observers.get(target);
  if (!set) {
    set = new Set();
    observers.set(target, set);
  }
  set.add(observer);
  return () => {
    set.delete(observer);
    if (!set.size && observers.get(target) === set)
      observers.delete(target);
  };
}

/** Returns undefined when no diagnostic observer is installed. @internal */
export function gaussianSplatObservers(target: RenderTarget): ReadonlySet<GaussianSplatFrameObserver> | undefined {
  return observers.get(target);
}
