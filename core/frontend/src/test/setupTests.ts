// By importing a barrel file within a setup file, we would be disabling vitest's ability to mock modules. But it's the easiest way to avoid circular import runtime errors within vitest.
// Link to a section covering this issue: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file-js-because-it-is-already-loaded
// Not importing all of core frontend, as it's not needed. Only MockRender namespace is causing circular import runtime errors.
import "../render/MockRender";
