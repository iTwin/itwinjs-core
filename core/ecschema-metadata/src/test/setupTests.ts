// By importing the barrel file within a setup file, we avoid circular import runtime errors within vitest.
// This forces all modules to be loaded in the correct order before tests run.
// Link to a section covering this issue: https://vitest.dev/guide/common-errors.html#cannot-mock-mocked-file-js-because-it-is-already-loaded
import "../ecschema-metadata";
