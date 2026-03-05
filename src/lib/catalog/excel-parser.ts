import ExcelJS from "exceljs";

export interface ExcelDefinitionRow {
  tableName: string;
  element: string;
  definition: string;
}

// Column header variants (case-insensitive matching)
const TABLE_NAME_HEADERS = ["table_name", "tablename", "table", "name"];
const ELEMENT_HEADERS = ["element", "field", "field_name", "fieldname", "column", "column_name"];
const DEFINITION_HEADERS = ["definition", "description", "hint", "text"];

function findColumnIndex(
  headerRow: ExcelJS.Row,
  variants: string[]
): number | null {
  let colIndex: number | null = null;

  headerRow.eachCell((cell, colNumber) => {
    const value = String(cell.value || "").trim().toLowerCase();
    if (variants.includes(value) && colIndex === null) {
      colIndex = colNumber;
    }
  });

  return colIndex;
}

export async function parseDefinitionExcel(
  buffer: ArrayBuffer
): Promise<ExcelDefinitionRow[]> {
  const workbook = new ExcelJS.Workbook();
  const nodeBuffer = Buffer.from(new Uint8Array(buffer));
  // @ts-expect-error - Node.js Buffer type version mismatch with exceljs types
  await workbook.xlsx.load(nodeBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file contains no worksheets");
  }

  const headerRow = worksheet.getRow(1);

  const tableCol = findColumnIndex(headerRow, TABLE_NAME_HEADERS);
  const elementCol = findColumnIndex(headerRow, ELEMENT_HEADERS);
  const definitionCol = findColumnIndex(headerRow, DEFINITION_HEADERS);

  if (!tableCol) {
    throw new Error(
      `Could not find a table name column. Expected one of: ${TABLE_NAME_HEADERS.join(", ")}`
    );
  }
  if (!elementCol) {
    throw new Error(
      `Could not find an element/field column. Expected one of: ${ELEMENT_HEADERS.join(", ")}`
    );
  }
  if (!definitionCol) {
    throw new Error(
      `Could not find a definition column. Expected one of: ${DEFINITION_HEADERS.join(", ")}`
    );
  }

  const rows: ExcelDefinitionRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const tableName = String(row.getCell(tableCol).value || "").trim();
    const element = String(row.getCell(elementCol).value || "").trim();
    const definition = String(row.getCell(definitionCol).value || "").trim();

    if (tableName && element && definition) {
      rows.push({ tableName, element, definition });
    }
  });

  return rows;
}
