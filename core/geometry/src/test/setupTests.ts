// By importing a barrel file within a setup file, we would be disabling vitest's ability to mock modules. But it's the easiest way to avoid circular import runtime errors within vitest.
// Link to a section covering this issue: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file-js-because-it-is-already-loaded
import "../core-geometry"; // Needed to avoid circular import runtime errors with vitest
