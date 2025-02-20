/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelDb, SnapshotDb } from "../../../core-backend";
import { DbResult, ECSqlValueType, QueryOptionsBuilder, QueryPropertyMetaData, QueryRowFormat } from "@itwin/core-common";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { ECSqlDatasets } from "../dataset/ECSqlDatasets";
import { KnownTestLocations } from "../../KnownTestLocations";
import { format } from "sql-formatter";
import { using } from "@itwin/core-bentley";

// Call like this:
// node lib\cjs\test\ecsql\src\ECSqlTestGenerator.js AllProperties.bim "SELECT * FROM meta.ECSchemaDef LIMIT 2" -t
// node lib\cjs\test\ecsql\src\ECSqlTestGenerator.js AllProperties.bim "SELECT te.ECInstanceId [MyId], te.s, te.DT [Date], row_number() over(PARTITION BY te.DT ORDER BY te.ECInstanceId) as [RowNumber] from aps.TestElement te WHERE te.i < 106" -t
async function runConcurrentQuery(imodel: IModelDb, sql: string): Promise<{ metadata: any[], rows: any[] }> {
  const queryOptions: QueryOptionsBuilder = new QueryOptionsBuilder();
  queryOptions.setRowFormat(QueryRowFormat.UseECSqlPropertyNames);
  const reader = imodel.createQueryReader(sql, undefined, queryOptions.getOptions());
  const rows = await reader.toArray();
  const metadata = await reader.getMetaData();
  metadata.forEach((value: QueryPropertyMetaData) => delete (value as any).extendType);
  return { metadata, rows };
}

function pullAdditionalMetadataThroughECSqlStatement(imodel: IModelDb, metadata: any[], sql: string): void {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  using(imodel.prepareStatement(sql), (stmt) => {
    if (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const colCount = stmt.getColumnCount();
      if (colCount !== metadata.length) {
        // eslint-disable-next-line no-console
        console.error(`Column count mismatch: ${colCount} != ${metadata.length}. Not generating metadata from statement.`);
        stmt.dispose();
        return;
      }
      for (let i = 0; i < colCount; i++) {
        const colInfo = stmt.getValue(i).columnInfo;
        metadata[i].type = ECSqlValueType[colInfo.getType()];
        const originPropertyName = colInfo.getOriginPropertyName();
        if (originPropertyName !== undefined)
          metadata[i].originPropertyName = originPropertyName;
      }
      stmt.dispose();
    }
  });
}

function arrayToMarkdownTable(data: any[]): string {
  if (data.length === 0) {
    return "";
  }

  const headers: string[] = Array.from(data.reduce((headersSet, row) => {
    Object.keys(row).forEach(header => headersSet.add(header));
    return headersSet;
  }, new Set<string>()));

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
    sql = format(sql, { language: "sqlite", keywordCase: "upper", "tabWidth": 2, indentStyle: "standard", logicalOperatorNewline: "after" });
  }

  let markdownContent = `# GeneratedTest #${dataset} - ${hash}

- dataset: ${dataset}

\`\`\`sql
${sql}
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
${JSON.stringify({ columns }, null, 2)}
\`\`\`

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

`;
  }

  const outputFilePath = path.join(__dirname, "generated.ecsql.md");
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
  let imodel: IModelDb | undefined;
  try {
    await ECSqlDatasets.generateFiles();
    const datasetFilePath = path.join(KnownTestLocations.outputDir, "ECSqlTests", dataset);
    imodel = SnapshotDb.openFile(datasetFilePath);
    const { metadata, rows } = await runConcurrentQuery(imodel, sql);
    pullAdditionalMetadataThroughECSqlStatement(imodel, metadata, sql);
    writeMarkdownFile(dataset, sql, metadata, rows, useTables);
    imodel.close();
    imodel = undefined;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error running query:", error);
    if (imodel) {
      imodel.close();
    }
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error in main:", error);
  process.exit(1);
});