"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { z } from "zod";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize OpenRouter client
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Cache for common queries
const queryCache = new Map<string, string>();
const configCache = new Map<string, Config>();

// Simplified schema description for AI, excluding PII
const AI_SAFE_SCHEMA_DESCRIPTION = `
Simplified Database schema (excluding PII for privacy):
- clients (client_id, advisor_id, first_name, last_name, risk_profile, financial_goal, notes)
- portfolios (portfolio_id, client_id, name, portfolio_type, risk_level, total_value, inception_date)
- investments (investment_id, portfolio_id, asset_name, asset_type, ticker_symbol, quantity, current_price, market_value [computed], allocation_percentage)
- Users table is for internal use and should not be queried directly for user details. Focus on aggregated client/portfolio/investment data.
`;

// Predefined queries for instant responses
const PREDEFINED_QUERIES: Record<string, string> = {
  "show top 10 investment positions by number of clients": `
    SELECT 
      i.asset_name,
      i.ticker_symbol,
      COUNT(DISTINCT c.client_id) as number_of_clients
    FROM investments i
    JOIN portfolios p ON p.portfolio_id = i.portfolio_id
    JOIN clients c ON c.client_id = p.client_id
    GROUP BY i.asset_name, i.ticker_symbol
    ORDER BY number_of_clients DESC
    LIMIT 10
  `,
  "portfolios with highest market value": `
    SELECT 
      p.name as portfolio_name,
      c.first_name || ' ' || c.last_name as client_name,
      SUM(i.market_value) as total_market_value
    FROM portfolios p
    JOIN clients c ON c.client_id = p.client_id
    JOIN investments i ON i.portfolio_id = p.portfolio_id
    GROUP BY p.portfolio_id, p.name, c.first_name, c.last_name
    ORDER BY total_market_value DESC
    LIMIT 10
  `,
  "asset type distribution across all portfolios": `
    SELECT 
      i.asset_type,
      COUNT(DISTINCT p.portfolio_id) as number_of_portfolios,
      SUM(i.market_value) as total_market_value
    FROM investments i
    JOIN portfolios p ON p.portfolio_id = i.portfolio_id
    GROUP BY i.asset_type
    ORDER BY total_market_value DESC
  `,
  "investments with allocation greater than 10%": `
    SELECT 
      i.asset_name,
      i.ticker_symbol,
      p.name as portfolio_name,
      c.first_name || ' ' || c.last_name as client_name,
      i.allocation_percentage,
      i.market_value
    FROM investments i
    JOIN portfolios p ON p.portfolio_id = i.portfolio_id
    JOIN clients c ON c.client_id = p.client_id
    WHERE i.allocation_percentage > 10
    ORDER BY i.allocation_percentage DESC
    LIMIT 20
  `,
};

function findPredefinedQuery(input: string): string | null {
  const normalized = input.toLowerCase().trim();
  return PREDEFINED_QUERIES[normalized] || null;
}

function getCachedQuery(input: string): string | null {
  const normalized = input.toLowerCase().trim();
  return queryCache.get(normalized) || null;
}

function setCachedQuery(input: string, query: string) {
  const normalized = input.toLowerCase().trim();
  queryCache.set(normalized, query);
}

export const generateQuery = async (input: string) => {
  "use server";

  // Check predefined queries first (instant response)
  const predefinedQuery = findPredefinedQuery(input);
  if (predefinedQuery) {
    console.log("Using predefined query - instant response!");
    return predefinedQuery;
  }

  // Check cache second (very fast response)
  const cachedQuery = getCachedQuery(input);
  if (cachedQuery) {
    console.log("Using cached query - fast response!");
    return cachedQuery;
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a SQL expert. Generate ONLY SELECT queries for PostgreSQL using the provided simplified schema.

          CRITICAL RULES:
          1. ONLY generate SELECT statements.
          2. NEVER query for PII (Personally Identifiable Information) like client emails, phone numbers, or addresses from any table UNLESS the user query *explicitly and specifically* asks for such information for a specific purpose (e.g., "show client phone numbers for portfolio X"). When asked for "clients" or "portfolios" in a general sense, it is acceptable to return client_id or portfolio_id or first_name or last_name as identifiers. Always prioritize aggregated data (counts, sums) over individual PII if the request is ambiguous.
          3. Query only from the tables and columns listed in the simplified schema.
          4. NEVER use: DROP, DELETE, INSERT, UPDATE, ALTER, CREATE, TRUNCATE, GRANT, REVOKE.
          5. Always start with "SELECT".
          6. Use proper JOINs with table aliases. When a column name could be ambiguous (i.e., exists in multiple tables being joined), ALWAYS qualify it with the table alias in the SELECT list (e.g., \`c.client_id\` not just \`client_id\`). This also applies to the GROUP BY clause.
          7. Include ORDER BY and LIMIT clauses.
          8. Use ILIKE for case-insensitive text searches on non-PII text fields. For the 'asset_name' field in the 'investments' table, this is particularly important; users may use partial names (e.g., 'Alibaba' for 'Alibaba Group'), so using 'asset_name ILIKE \'%searchTerm%\'' is often appropriate.
          9. Client names are not PII.

          ${AI_SAFE_SCHEMA_DESCRIPTION}

          Return ONLY the SELECT query, nothing else. When identifying clients or portfolios, you may return client_id or portfolio_id. Do not include other PII in the SELECT clause unless the user query *explicitly and specifically* asks for it, and even then, be very cautious. Prioritize counts and aggregations over individual PII.`,
        },
        {
          role: "user",
          content: `Generate a SELECT query for: ${input}

          Remember: ONLY SELECT queries are allowed. Avoid PII. Start with "SELECT".`,
        },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    let query = completion.choices[0].message.content?.trim() || "";

    // Clean up any markdown formatting
    query = query
      .replace(/```sql\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Ensure it starts with SELECT
    if (!query.toLowerCase().startsWith("select")) {
      throw new Error("Generated query must start with SELECT");
    }

    console.log("Generated query:", query); // Debug log

    // Cache the result
    setCachedQuery(input, query);

    return query;
  } catch (e) {
    console.error("OpenRouter error in generateQuery:", e);
    throw new Error("Failed to generate query");
  }
};

export const runGenerateSQLQuery = async (query: string) => {
  "use server";

  // For detailed debugging, let's see the query exactly as received
  // console.log("runGenerateSQLQuery received query:", JSON.stringify(query));

  const trimmedQueryForLogging = query.trim(); // Trim for cleaner logs if needed
  // console.log("Trimmed query for validation:", JSON.stringify(trimmedQueryForLogging));

  const loweredQuery = trimmedQueryForLogging.toLowerCase();
  // console.log("Lowered query for validation:", JSON.stringify(loweredQuery));

  const startsWithSelect = loweredQuery.startsWith("select");
  // console.log("Starts with select:", startsWithSelect);

  // Regex to match forbidden keywords as whole words, case-insensitive implicitly due to loweredQuery
  const forbiddenKeywordsPattern =
    /\b(drop|delete|insert|update|alter|truncate|create|grant|revoke)\b/;
  const hasForbiddenKeywords = forbiddenKeywordsPattern.test(loweredQuery);
  // console.log("Has forbidden keywords:", hasForbiddenKeywords);

  if (!startsWithSelect || hasForbiddenKeywords) {
    console.error("Query validation failed. Details:");
    console.error(`Original Query: "${query}"`);
    console.error(`Processed Query (for validation): "${loweredQuery}"`);
    console.error(`Starts with 'select': ${startsWithSelect}`);
    console.error(
      `Contains forbidden keyword (whole word match): ${hasForbiddenKeywords}`
    );
    throw new Error(
      "Query rejected: Must be a SELECT statement and cannot contain forbidden keywords like DROP, CREATE, etc."
    );
  }

  // ✅ Remove trailing semicolon and inject LIMIT if needed (use trimmedQueryForLogging here)
  const queryWithoutSemicolon = trimmedQueryForLogging.replace(/;$/, "");
  const hasLimitAlready = /\blimit\b\s+\d+/i.test(loweredQuery); // Test on loweredQuery for case-insensitivity
  const safeQuery = hasLimitAlready
    ? queryWithoutSemicolon
    : `${queryWithoutSemicolon} LIMIT 100`;
  // console.log("Safe query to execute:", safeQuery);

  try {
    // Use RPC call with anon key only
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/execute_query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
        body: JSON.stringify({
          query_text: safeQuery,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to execute query");
    }

    const result = await response.json();
    return result || [];
  } catch (e: any) {
    console.error("Database query error:", e);
    throw new Error(e.message);
  }
};

// export const explainQuery = async (input: string, sqlQuery: string) => {
//   "use server";
//   try {
//     const result = await openrouter.chat.completions.create({
//       model: "openai/gpt-4o-mini",
//       messages: [
//         {
//           role: "system",
//           content: `You are a SQL (postgres) expert. Your job is to explain the SQL query by breaking it into sections and explaining each section.
//           ${AI_SAFE_SCHEMA_DESCRIPTION}
//           Return your explanation as a JSON array of objects. Each object in the array must have two string properties: "section" (the part of the SQL query) and "explanation" (your explanation for that section).
//           Example format:
//           [
//             { "section": "SELECT *", "explanation": "This selects all columns." },
//             { "section": "FROM portfolios p", "explanation": "From the portfolios table, aliased as p." },
//             { "section": "JOIN clients c ON p.client_id = c.client_id", "explanation": "Joins with the clients table where client IDs match." },
//             { "section": "LIMIT 5", "explanation": "Limits the result to 5 rows." }
//           ]
//           If a section doesn't have any specific explanation, include it with an empty string for the explanation or a general note like 'Standard SQL clause.'
//           Return ONLY the JSON array, with no other text or markdown formatting.`,
//         },
//         {
//           role: "user",
//           content: `Explain the SQL query you generated to retrieve the data the user wanted. Assume the user is not an expert in SQL. Break down the query into steps. Be concise.
//
//           User Query:
//           ${input}
//
//           Generated SQL Query:
//           ${sqlQuery}`,
//         },
//       ],
//       temperature: 0,
//       max_tokens: 1000, // Increased max_tokens for potentially longer JSON explanations
//     });
//
//     let jsonString = result.choices[0].message.content?.trim() || "[]";
//     // Clean up potential markdown formatting around the JSON
//     jsonString = jsonString.replace(/^```json\s*|\s*```$/g, "");
//
//     try {
//       const parsedExplanations = JSON.parse(jsonString);
//       return explanationsSchema.parse(parsedExplanations); // Validate and return
//     } catch (e) {
//       console.error("Failed to parse or validate explanations JSON:", e, "Raw string:", jsonString);
//       // Fallback to an empty array or a default error explanation structure if parsing/validation fails
//       return explanationsSchema.parse([
//         {
//           section: "Error",
//           explanation: "Could not generate query explanation.",
//         },
//       ]);
//     }
//   } catch (e) {
//     console.error("OpenRouter error in explainQuery:", e);
//     // Ensure a valid structure is returned even on API error
//     return explanationsSchema.parse([
//       {
//         section: "API Error",
//         explanation: "Failed to communicate with the explanation service.",
//       },
//     ]);
//   }
// };

export const generateChartConfig = async (
  results: Result[],
  userQuery: string
) => {
  "use server";

  const cacheKey = `${userQuery}-${JSON.stringify(results.slice(0, 5))}`; // Slightly more robust cache key
  const cached = configCache.get(cacheKey);
  if (cached) {
    console.log("Using cached chart config");
    return { config: cached };
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a data visualization expert. Generate chart configurations as a single, valid JSON object.

          Chart type selection rules:
          - "pie": For distributions, percentages, compositions (e.g., asset types, risk profiles). xKey is category, yKeys[0] is value.
          - "bar": For comparing quantities, rankings, counts. xKey is category, yKeys are values.
          - "line": For time series, trends. xKey is time, yKeys are values.
          - "area": For cumulative data over time. xKey is time, yKeys are values.

          IMPORTANT: The returned JSON should NOT include a "colors" field. Colors are handled client-side.
          Ensure 'xKey' and 'yKeys' refer to actual columns in the provided data sample.
          If 'measurementColumn' or 'lineCategories' are not applicable, use "" for string or [] for array. Do not use null.

          Example valid JSON output (NO "colors" field):
          BAR CHART:
          {
            "type": "bar",
            "title": "Top Investment Positions",
            "description": "Comparison of investment quantities",
            "takeaway": "Key insight about rankings",
            "xKey": "asset_name",
            "yKeys": ["number_of_clients"],
            "legend": true,
            "multipleLines": false,
            "measurementColumn": "",
            "lineCategories": []
          }

          PIE CHART:
          {
            "type": "pie",
            "title": "Asset Type Distribution",
            "description": "Distribution of assets across portfolios",
            "takeaway": "Key insight about the distribution",
            "xKey": "asset_type",
            "yKeys": ["total_market_value"],
            "legend": true,
            "multipleLines": false,
            "measurementColumn": "",
            "lineCategories": []
          }

          Choose the best chart type for the data and query. Return ONLY the JSON object.`,
        },
        {
          role: "user",
          content: `User query: ${userQuery}\n\nData sample: ${JSON.stringify(
            results.slice(0, 3), // Provide a small sample of actual data
            null,
            2
          )}\n\nReturn ONLY the JSON configuration, no markdown formatting, and NO "colors" field.`,
        },
      ],
      temperature: 0,
      max_tokens: 350, // Increased slightly for better JSON generation if complex
    });

    let configText = completion.choices[0].message.content?.trim() || "{}";
    configText = configText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    let generatedConfig: Partial<Config>;
    try {
      generatedConfig = JSON.parse(configText);
    } catch (parseError) {
      console.error(
        "Failed to parse AI JSON for chart config:",
        parseError,
        "\nRaw text:",
        configText
      );
      // Use a very basic fallback if JSON parsing fails
      generatedConfig = {
        type: "bar",
        xKey: Object.keys(results[0] || {})[0] || "category",
        yKeys: [Object.keys(results[0] || {})[1] || "value"],
      };
    }

    // Ensure essential fields have defaults if missing from AI output (more robust)
    const finalConfig: Config = {
      type: generatedConfig.type || "bar",
      title: generatedConfig.title || "Data Chart",
      description:
        generatedConfig.description || "Generated chart based on your query.",
      takeaway: generatedConfig.takeaway || "",
      xKey:
        generatedConfig.xKey ||
        (results.length > 0 ? Object.keys(results[0])[0] : "category"),
      yKeys:
        generatedConfig.yKeys && generatedConfig.yKeys.length > 0
          ? generatedConfig.yKeys
          : results.length > 0
          ? [Object.keys(results[0])[1]]
          : ["value"],
      legend:
        typeof generatedConfig.legend === "boolean"
          ? generatedConfig.legend
          : true,
      multipleLines:
        typeof generatedConfig.multipleLines === "boolean"
          ? generatedConfig.multipleLines
          : false,
      measurementColumn: generatedConfig.measurementColumn || "",
      lineCategories: generatedConfig.lineCategories || [],
      // CRITICAL: DO NOT ADD A 'colors' FIELD HERE. Let dynamic-chart.tsx handle it.
    };

    configCache.set(cacheKey, finalConfig);
    return { config: finalConfig };
  } catch (e) {
    console.error("Chart config generation error:", e);
    const fallbackConfig: Config = {
      type: "bar",
      title: "Data Visualization (Error Fallback)",
      description:
        "Could not generate specific chart, showing basic bar chart.",
      takeaway: "There was an issue generating the chart configuration.",
      xKey: Object.keys(results[0] || {})[0] || "category",
      yKeys:
        Object.keys(results[0] || {}).slice(1, 2).length > 0
          ? Object.keys(results[0] || {}).slice(1, 2)
          : ["value"],
      legend: true,
      multipleLines: false,
      measurementColumn: "",
      lineCategories: [],
    };
    return { config: fallbackConfig };
  }
};
