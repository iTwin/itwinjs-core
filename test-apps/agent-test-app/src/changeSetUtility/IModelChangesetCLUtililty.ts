/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ChangesetGenerationHarness} from "./ChangesetGenerationHarness";
import { TestChangesetSequence } from "./TestChangesetSequence";
import { ChangesetGenerationConfig } from "./Config";
class ProcessHandler {
    constructor(private _process: NodeJS.Process) {}
    public exitSuccessfully() { this._process.exit(); }
    public exitWithError() { this._process.exit(1); }
}
/** Main entry point for Command Line Utility */
export const main = async (_process: NodeJS.Process,
    config: ChangesetGenerationConfig = new ChangesetGenerationConfig(),
    harness: ChangesetGenerationHarness = new ChangesetGenerationHarness(config)): Promise<void> => {
    const processHandler = new ProcessHandler(_process);
    // Now that the Harness is initalialized, generate changeset sequence
    const changesetSequence: TestChangesetSequence = new TestChangesetSequence(config.numChangesets, config.numCreatedPerChangeset,
        config.changesetPushDelay);
    let success = false;
    try {
        success = await harness.generateChangesets(changesetSequence);
    } catch {}
    if (success)
        processHandler.exitSuccessfully();
    processHandler.exitWithError();
};
// Invoke main if IModelChangesetCLUtility.js is being run directly
if (require.main === module) { main(process); }
