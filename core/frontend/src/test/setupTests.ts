// By importing a barrel file within a setup file, we would be disabling vitest's ability to mock modules. But it's the easiest way to avoid circular import runtime errors within vitest.
// Link to a section covering this issue: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file-js-because-it-is-already-loaded
<<<<<<< HEAD
// Not importing all of core frontend, as it's not needed. Only MockRender namespace is causing circular import runtime errors.
import "../render/MockRender";
=======
import "../core-frontend";
// Import custom matchers
import "./setupCustomMatchers";
>>>>>>> ffa6c0f45c (Use vitest v3, Resolve GHSA-9crc-q9x8-ghqq  (#7340))
