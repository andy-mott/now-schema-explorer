/**
 * Centralized prompt templates for AI-powered definition drafting.
 */

export function buildSystemPrompt(): string {
  return `You are a ServiceNow data dictionary specialist. Your task is to write clear, concise field definitions for a ServiceNow data catalog.

Rules:
- Write in the present tense, third person (e.g., "Stores the...", "Indicates whether...")
- Be specific about the field's purpose in its table context
- Keep definitions to 1-3 sentences
- Do not include the field name or label in the definition — the reader already knows which field this is
- If the field references another table, explain the relationship briefly
- Do not speculate about implementation details you are not certain about
- Return ONLY the definition text with no extra formatting, labels, or explanation`;
}

export interface FieldContext {
  tableName: string;
  element: string;
  label: string;
  internalType: string;
  tableLabel?: string;
  referenceTable?: string | null;
  existingDefinition?: string | null;
}

export function buildUserPrompt(context: FieldContext): string {
  let prompt = `Write a definition for this ServiceNow field:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  if (context.existingDefinition) {
    prompt += `\n\nAn existing definition exists but may need improvement:\n${context.existingDefinition}`;
  }

  prompt += `\n\nProvide only the definition text.`;
  return prompt;
}

export function buildUserPromptWithDocs(
  context: FieldContext,
  documentation: string
): string {
  let prompt = `Write a definition for this ServiceNow field:

Table: ${context.tableName}${context.tableLabel ? ` (${context.tableLabel})` : ""}
Field name: ${context.element}
Label: ${context.label}
Type: ${context.internalType}`;

  if (context.referenceTable) {
    prompt += `\nReferences table: ${context.referenceTable}`;
  }

  prompt += `\n\nThe following official ServiceNow documentation was found for this field. Use it as a primary source, but improve clarity and conciseness if needed:\n\n${documentation}`;

  if (context.existingDefinition) {
    prompt += `\n\nAn existing definition also exists:\n${context.existingDefinition}`;
  }

  prompt += `\n\nProvide only the definition text.`;
  return prompt;
}
