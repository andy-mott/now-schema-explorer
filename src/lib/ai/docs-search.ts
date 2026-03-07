/**
 * Searches ServiceNow documentation for a specific field.
 * Returns documentation text if found, null if not found or unavailable.
 * Designed to fail gracefully — never throws, always returns null on error.
 */
export async function searchServiceNowDocs(
  tableName: string,
  element: string
): Promise<string | null> {
  try {
    // Strategy: Use docs.servicenow.com search to find field documentation.
    // The search query targets the specific table and field name.
    const query = encodeURIComponent(
      `${tableName} ${element} field ServiceNow`
    );
    const url = `https://docs.servicenow.com/api/search?q=${query}&limit=3`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000), // 5s timeout — don't block if docs are slow
    });

    if (!response.ok) return null;

    const data = await response.json();
    return extractRelevantDocs(data, tableName, element);
  } catch {
    // Network error, timeout, or parse error — gracefully fall back
    return null;
  }
}

/**
 * Extracts the most relevant documentation snippet from search results.
 */
function extractRelevantDocs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  tableName: string,
  element: string
): string | null {
  try {
    // The docs.servicenow.com search API response structure may vary.
    // We look for results that contain both the table name and field name.
    const results = data?.results || data?.data || data?.items || [];

    if (!Array.isArray(results) || results.length === 0) return null;

    // Find the best matching result
    for (const result of results) {
      const title = (result.title || result.name || "").toLowerCase();
      const snippet = (
        result.snippet ||
        result.description ||
        result.body ||
        result.content ||
        ""
      ).toLowerCase();
      const combined = `${title} ${snippet}`;

      // Prefer results that mention both the table and element
      if (
        combined.includes(tableName.toLowerCase()) &&
        combined.includes(element.toLowerCase())
      ) {
        const text =
          result.snippet ||
          result.description ||
          result.body ||
          result.content;
        if (text && text.length > 20) {
          // Truncate very long docs to keep prompt reasonable
          return text.length > 1000 ? text.substring(0, 1000) + "..." : text;
        }
      }
    }

    // Fall back to the first result if it mentions the element at all
    const first = results[0];
    const firstText =
      first?.snippet ||
      first?.description ||
      first?.body ||
      first?.content;
    if (
      firstText &&
      firstText.toLowerCase().includes(element.toLowerCase()) &&
      firstText.length > 20
    ) {
      return firstText.length > 1000
        ? firstText.substring(0, 1000) + "..."
        : firstText;
    }

    return null;
  } catch {
    return null;
  }
}
