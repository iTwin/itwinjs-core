# Plan: Migrate Schema Example Snippets to core/ecschema-metadata

Establish the `test/example-code/` pattern by migrating 7 schema-only quantity formatting snippets from centralized [example-code/snippets](example-code/snippets) to [core/ecschema-metadata](core/ecschema-metadata) package-local directory. Single PR, no doc updates (snippet names unchanged).

**TL;DR:** Move [Ratio.test.ts](example-code/snippets/src/quantity/Ratio.test.ts) (6 markers) and [UnitConversion.test.ts](example-code/snippets/src/quantity/UnitConversion.test.ts) (1 marker) to `core/ecschema-metadata/src/test/example-code/`, convert from Mocha to Vitest, add extraction script, and remove old files.

## Steps

1. **Create directory structure** in [core/ecschema-metadata/src/test](core/ecschema-metadata/src/test):
   - Create `example-code/` directory
   - Copy [example-code/snippets/assets/RatioUnits.ecschema.xml](example-code/snippets/assets/RatioUnits.ecschema.xml) → `core/ecschema-metadata/src/test/assets/RatioUnits.ecschema.xml`

2. **Copy and adapt** [Ratio.test.ts](example-code/snippets/src/quantity/Ratio.test.ts) → `core/ecschema-metadata/src/test/example-code/Ratio.test.ts`:
   - Convert Mocha → Vitest: Change `before` to `beforeAll`, import from `vitest`
   - Update asset path: `path.join(__dirname, "..", "..", "assets")` → `path.join(__dirname, "..", "assets")`
   - Update units-schema path: `path.join(__dirname, "..", "..", "node_modules", "@bentley", "units-schema")` → `path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "units-schema")`
   - Keep all 6 snippet markers unchanged: `Quantity_Formatting.Metric_Scale`, `Imperial_Scale_FormatProps`, `Imperial_Scale`, `Metric_Scale_Parsing`, `Imperial_Scale_Parsing`, `Ratio_KOQ`

3. **Copy and adapt** [UnitConversion.test.ts](example-code/snippets/src/quantity/UnitConversion.test.ts) → `core/ecschema-metadata/src/test/example-code/UnitConversion.test.ts`:
   - Convert Mocha → Vitest: Change `before` to `beforeAll`, import from `vitest`
   - Update units-schema path (same as above)
   - Keep snippet marker unchanged: `Quantity_UnitConversion.Direct_Conversion`

4. **Add extraction script** to [core/ecschema-metadata/package.json](core/ecschema-metadata/package.json):
   - Add script: `"extract": "betools extract --fileExt=ts --extractFrom=./src/test/example-code --recursive --out=../../generated-docs/extract"`
   - Update `docs` script: `"docs": "npm run -s docs:json && npm run -s extract"` (where `docs:json` is the current docs script renamed)
   - Or simpler: `"docs": "betools docs --json=../../generated-docs/core/ecschema-metadata/file.json --tsIndexFile=./ecschema-metadata.ts --onlyJson && npm run -s extract"`

5. **Verify tests run**:
   - `cd core/ecschema-metadata && rushx build` (ensure assets copied)
   - `rushx test` (verify both test files pass)

6. **Verify extraction works**:
   - `rushx extract` from `core/ecschema-metadata/`
   - Check `generated-docs/extract/` contains 7 files: `Quantity_Formatting.Metric_Scale`, `Quantity_Formatting.Imperial_Scale_FormatProps`, `Quantity_Formatting.Imperial_Scale`, `Quantity_Formatting.Metric_Scale_Parsing`, `Quantity_Formatting.Imperial_Scale_Parsing`, `Quantity_Formatting.Ratio_KOQ`, `Quantity_UnitConversion.Direct_Conversion`

7. **Full pipeline test**:
   - From repo root: `rush build && rush docs`
   - Verify all 7 snippet files appear in `generated-docs/extract/`

8. **Remove old files**:
   - Delete [example-code/snippets/src/quantity/Ratio.test.ts](example-code/snippets/src/quantity/Ratio.test.ts)
   - Delete [example-code/snippets/src/quantity/UnitConversion.test.ts](example-code/snippets/src/quantity/UnitConversion.test.ts)
   - Keep [RatioUnits.ecschema.xml](example-code/snippets/assets/RatioUnits.ecschema.xml) (still used by other tests if any)

9. **Update CONTRIBUTING.md**:
   - Add section documenting new `test/example-code/` pattern
   - Example guidance: "Place testable documentation snippets in `test/example-code/` directory. Add extraction script: `betools extract --fileExt=ts --extractFrom=./src/test/example-code --recursive --out=../../generated-docs/extract`"

10. **Changelog**: Run `rush change` to document the refactoring

## Verification

**Tests pass:**
```bash
cd core/ecschema-metadata
rushx test  # Both Ratio.test.ts and UnitConversion.test.ts pass
```

**Extraction succeeds:**
```bash
rushx extract
ls ../../generated-docs/extract/Quantity* | wc -l  # Should be 7
```

**Full pipeline:**
```bash
rush clean && rush build && rush docs
ls generated-docs/extract/ | grep -E "(Quantity_Formatting|Quantity_UnitConversion)" | wc -l  # Should be 7+
```

**Documentation unchanged:**
- [docs/quantity-formatting/usage/Providers.md](docs/quantity-formatting/usage/Providers.md) still references `[[include:Quantity_Formatting.Ratio_KOQ]]`
- [docs/quantity-formatting/usage/UnitConversion.md](docs/quantity-formatting/usage/UnitConversion.md) still references `[[include:Quantity_UnitConversion.Direct_Conversion]]`
- All 7 snippets resolve in CI BeMetalsmith build

## Decisions

**Targeted scope:** Only schema-only examples (7 snippets) in this PR - establishes pattern without frontend complexity

**Mocha → Vitest conversion:** Target package uses Vitest, so tests must be adapted (minimal changes: `before` → `beforeAll`)

**Keep RatioUnits.ecschema.xml in snippets/assets:** May be used by other tests; copy rather than move to avoid breakage

**Standardized folder:** `test/example-code/` convention makes extraction patterns consistent and separates doc snippets from unit tests
