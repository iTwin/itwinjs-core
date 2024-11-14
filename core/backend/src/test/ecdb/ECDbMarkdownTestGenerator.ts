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
import { format } from "sql-formatter";


// Call like this:
// node lib\cjs\test\ecdb\ECDbMarkdownTestGenerator.js AllProperties.bim "SELECT " -t
// node lib\cjs\test\ecdb\ECDbMarkdownTestGenerator.js AllProperties.bim "SELECT te.ECInstanceId [MyId], te.s, te.DT [Date], row_number() over(PARTITION BY te.DT ORDER BY te.ECInstanceId) as [RowNumber] from aps.TestElement te WHERE te.i < 1006" -t
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

function arrayToMarkdownTable(data: any[]): string {
  if (data.length === 0) {
    return "";
  }

  const headers = Object.keys(data[0]);
  const columnWidths = headers.map(header =>
    Math.max(header.length, ...data.map(row => String(row[header]).length))
  );

  const formatRow = (row: any) =>
    `| ${headers.map((header, i) => String(row[header]).padEnd(columnWidths[i])).join(" | ")} |`;

  const headerRow = formatRow(headers.reduce((acc, header) => ({ ...acc, [header]: header }), {}));
  const separatorRow = `| ${columnWidths.map(width => "-".repeat(width)).join(" | ")} |`;
  const dataRows = data.map(formatRow);

  return [headerRow, separatorRow, ...dataRows].join("\n");
}

function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

function writeMarkdownFile(dataset: string, sql: string, columns: any[], results: any[], useTables: boolean): void {
  const hash = generateHash(sql);
  if (sql.length > 100) { // we format the SQL if it's too long
    sql = format(sql, {language: "sqlite", keywordCase: "upper", "tabWidth": 2, indentStyle: "standard", logicalOperatorNewline: "after"});
  }

  let markdownContent = `# GeneratedTest #${dataset} - ${hash}

- dataset: ${dataset}

\`\`\`sql
${sql}
\`\`\`

\`\`\`json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertynames"
  }
}
\`\`\`
`;

  if (useTables) {
    markdownContent += `
${arrayToMarkdownTable(columns)}

${arrayToMarkdownTable(results)}

`;
  } else {
    markdownContent += `
\`\`\`json
${JSON.stringify({columns}, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

`;
  }

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

  const [dataset, sql, tablesFlag] = args;
  const useTables = tablesFlag === "-t";
  try {
    await ECDbMarkdownDatasets.generateFiles();
    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECDbTests", dataset);
    const { metadata, rows } = await runConcurrentQuery(datasetFilePath, sql);
    writeMarkdownFile(dataset, sql, metadata, rows, useTables);
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