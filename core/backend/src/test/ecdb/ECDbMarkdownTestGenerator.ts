/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, SnapshotDb } from "../../core-backend";
import { QueryOptionsBuilder, QueryRowFormat } from "@itwin/core-common";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { ECDbMarkdownDatasets } from "./ECDbMarkdownDatasets";
import { KnownTestLocations } from "../KnownTestLocations";

// Call like this:
// node lib\cjs\test\ecdb\ECDbMarkdownTestGenerator.js AllProperties.bim "SELECT * from meta.ECSchemaDef LIMIT 4"
async function runConcurrentQuery(datasetFilePath: string, sql: string): Promise<{metadata: any[], rows: any[] }> {
  const imodel: IModelDb = SnapshotDb.openFile(datasetFilePath);
  const queryOptions: QueryOptionsBuilder = new QueryOptionsBuilder();
  queryOptions.setRowFormat(QueryRowFormat.UseECSqlPropertyNames);
  const reader = imodel.createQueryReader(sql, undefined, queryOptions.getOptions());
  const rows = await reader.toArray();
  const metadata = await reader.getMetaData();
  imodel.close();
  return {metadata, rows };
}

function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

function writeMarkdownFile(dataset: string, sql: string, columns: any[], results: any[]): void {
  const hash = generateHash(sql);
  const markdownContent = `# Query Results for ${dataset} - ${hash}

- dataset: ${dataset}

\`\`\`sql
${sql}
\`\`\`

\`\`\`json
${JSON.stringify(columns, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`
`;

  const outputFilePath = path.join(__dirname, "generated.ecdbtest.md");
  fs.appendFileSync(outputFilePath, markdownContent, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Results written to ${outputFilePath}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    // eslint-disable-next-line no-console
    console.error("Usage: ts-node ECDbMarkdownTestGenerator.ts <dataset> <sql>");
    process.exit(1);
  }

  const [dataset, sql] = args;
  try {
    await ECDbMarkdownDatasets.generateFiles();
    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECDbTests", dataset);
    const { metadata, rows } = await runConcurrentQuery(datasetFilePath, sql);
    writeMarkdownFile(dataset, sql, metadata, rows);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error running query:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error in main:", error);
  process.exit(1);
});