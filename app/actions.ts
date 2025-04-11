"use server";

import { Config, configSchema, explanationsSchema, Result } from "@/lib/types";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { z } from "zod";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const generateQuery = async (input: string) => {
  "use server";
  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      system: `You are a SQL (postgres) and data visualization expert specializing in investment portfolio analysis. Your job is to help generate insightful queries about investment portfolios and client holdings.

      IMPORTANT RULES:
      1. ONLY generate SELECT queries - no other operations are allowed
      2. When searching for names, use ILIKE for case-insensitive matching
      3. Always use proper table joins with aliases
      4. Include appropriate WHERE clauses for filtering
      5. Always include ORDER BY and LIMIT clauses
      6. For text searches, use pattern matching with ILIKE and '%' wildcards
      7. For aggregations, always include GROUP BY and appropriate HAVING clauses
      8. When counting clients or portfolios, use COUNT(DISTINCT client_id) or COUNT(DISTINCT portfolio_id)

      COMMON INVESTMENT ANALYSIS PATTERNS:

      1. Popular Investments Analysis:
      SELECT 
        i.asset_name,
        i.ticker_symbol,
        COUNT(DISTINCT c.client_id) as number_of_clients,
        SUM(i.market_value) as total_market_value,
        AVG(i.allocation_percentage) as avg_allocation
      FROM investments i
      JOIN portfolios p ON p.portfolio_id = i.portfolio_id
      JOIN clients c ON c.client_id = p.client_id
      GROUP BY i.asset_name, i.ticker_symbol
      ORDER BY number_of_clients DESC
      LIMIT 10;

      2. Portfolio Holdings Analysis:
      SELECT 
        p.name as portfolio_name,
        c.first_name || ' ' || c.last_name as client_name,
        i.asset_name,
        i.ticker_symbol,
        i.quantity,
        i.market_value,
        i.allocation_percentage
      FROM portfolios p
      JOIN clients c ON c.client_id = p.client_id
      JOIN investments i ON i.portfolio_id = p.portfolio_id
      WHERE i.market_value > 0
      ORDER BY i.market_value DESC
      LIMIT 20;

      3. Asset Type Distribution:
      SELECT 
        i.asset_type,
        COUNT(DISTINCT p.portfolio_id) as number_of_portfolios,
        COUNT(DISTINCT c.client_id) as number_of_clients,
        SUM(i.market_value) as total_market_value,
        AVG(i.allocation_percentage) as avg_allocation
      FROM investments i
      JOIN portfolios p ON p.portfolio_id = i.portfolio_id
      JOIN clients c ON c.client_id = p.client_id
      GROUP BY i.asset_type
      ORDER BY total_market_value DESC;

      The database schema is as follows:

      users (
        user_id bigint PRIMARY KEY,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      clients (
        client_id bigint PRIMARY KEY,
        advisor_id bigint NOT NULL REFERENCES users(user_id),
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        date_of_birth date,
        address text,
        city text,
        state text,
        postal_code text,
        country text,
        risk_profile text DEFAULT 'balanced',
        financial_goal text,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      portfolios (
        portfolio_id bigint PRIMARY KEY,
        client_id bigint NOT NULL REFERENCES clients(client_id),
        name text NOT NULL,
        portfolio_type text DEFAULT 'investment',
        risk_level text DEFAULT 'medium',
        total_value numeric(18,4) DEFAULT 0.00,
        inception_date date DEFAULT CURRENT_DATE,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      investments (
        investment_id bigint PRIMARY KEY,
        portfolio_id bigint NOT NULL REFERENCES portfolios(portfolio_id),
        asset_name text NOT NULL,
        asset_type text NOT NULL,
        ticker_symbol text,
        quantity numeric(18,4) NOT NULL DEFAULT 0.00,
        average_purchase_price numeric(18,4) NOT NULL DEFAULT 0.00,
        current_price numeric(18,4) NOT NULL DEFAULT 0.00,
        market_value numeric(18,4) GENERATED ALWAYS AS (quantity * current_price) STORED,
        allocation_percentage numeric(5,2) DEFAULT 0.00,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );
      `,
      prompt: `Generate a SELECT query to analyze: ${input}. Remember to use appropriate aggregations and grouping for investment analysis.`,
      schema: z.object({
        query: z.string(),
      }),
    });
    return result.object.query;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
  }
};

export const runGenerateSQLQuery = async (query: string) => {
  "use server";

  const loweredQuery = query.trim().toLowerCase();

  // ✅ Only allow SELECTs
  if (
    !loweredQuery.startsWith("select") ||
    /drop|delete|insert|update|alter|truncate|create|grant|revoke/.test(
      loweredQuery
    )
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  // ✅ Remove trailing semicolon and inject LIMIT if needed
  const trimmedQuery = query.trim().replace(/;$/, "");
  const hasLimit = /\blimit\b\s+\d+/i.test(loweredQuery);
  const safeQuery = hasLimit ? trimmedQuery : `${trimmedQuery} LIMIT 100`;

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

export const explainQuery = async (input: string, sqlQuery: string) => {
  "use server";
  try {
    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        explanations: explanationsSchema,
      }),
      system: `You are a SQL (postgres) expert. Your job is to explain to the user the SQL query you wrote to retrieve the data they asked for. The database schema is as follows:

      users (
        user_id bigint PRIMARY KEY,
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      clients (
        client_id bigint PRIMARY KEY,
        advisor_id bigint NOT NULL REFERENCES users(user_id),
        first_name text NOT NULL,
        last_name text NOT NULL,
        email text,
        phone text,
        date_of_birth date,
        address text,
        city text,
        state text,
        postal_code text,
        country text,
        risk_profile text DEFAULT 'balanced',
        financial_goal text,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      portfolios (
        portfolio_id bigint PRIMARY KEY,
        client_id bigint NOT NULL REFERENCES clients(client_id),
        name text NOT NULL,
        portfolio_type text DEFAULT 'investment',
        risk_level text DEFAULT 'medium',
        total_value numeric(18,4) DEFAULT 0.00,
        inception_date date DEFAULT CURRENT_DATE,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      investments (
        investment_id bigint PRIMARY KEY,
        portfolio_id bigint NOT NULL REFERENCES portfolios(portfolio_id),
        asset_name text NOT NULL,
        asset_type text NOT NULL,
        ticker_symbol text,
        quantity numeric(18,4) NOT NULL DEFAULT 0.00,
        average_purchase_price numeric(18,4) NOT NULL DEFAULT 0.00,
        current_price numeric(18,4) NOT NULL DEFAULT 0.00,
        market_value numeric(18,4) GENERATED ALWAYS AS (quantity * current_price) STORED,
        allocation_percentage numeric(5,2) DEFAULT 0.00,
        notes text,
        created_at timestamp with time zone,
        updated_at timestamp with time zone
      );

      When you explain you must take a section of the query, and then explain it. Each "section" should be unique. So in a query like: "SELECT * FROM portfolios p JOIN clients c ON p.client_id = c.client_id LIMIT 5", the sections could be "SELECT *", "FROM portfolios p", "JOIN clients c ON p.client_id = c.client_id", "LIMIT 5".
      If a section doesn't have any explanation, include it, but leave the explanation empty.
      `,
      prompt: `Explain the SQL query you generated to retrieve the data the user wanted. Assume the user is not an expert in SQL. Break down the query into steps. Be concise.

      User Query:
      ${input}

      Generated SQL Query:
      ${sqlQuery}`,
    });
    return result.object;
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate query");
  }
};

export const generateChartConfig = async (
  results: Result[],
  userQuery: string
) => {
  "use server";
  const system = `You are a data visualization expert. Your job is to select the most appropriate chart type for visualizing the given data.

  Chart Type Selection Guidelines:
  1. Bar Charts (Primary Choice):
     - Best for comparing quantities across categories
     - Good for showing rankings (e.g., top performers)
     - Ideal for time-based data with discrete intervals
     - Perfect for portfolio values, investment amounts, client counts

  2. Pie Charts:
     - Use only for showing composition/distribution
     - Limit to 6-8 segments maximum
     - Good for percentages that sum to 100%
     - Examples: asset allocation, risk profile distribution

  3. Line Charts:
     - Best for continuous time-series data
     - Good for showing trends over time
     - Perfect for portfolio performance over time
     - Use when tracking changes in values

  4. Area Charts:
     - Similar to line charts but better for cumulative values
     - Good for showing part-to-whole relationships over time
     - Use for stacked time-series data

  Always consider:
  - Data type (categorical, numerical, temporal)
  - Number of variables
  - The story you want to tell
  - User's query intent

  Choose the most appropriate chart type based on these guidelines, but adapt based on the specific data and query context.`;

  try {
    const { object: config } = await generateObject({
      model: openai("gpt-4o"),
      system,
      prompt: `Given the following data from a SQL query result, generate the chart config that best visualises the data and answers the users query.

      User Query:
      ${userQuery}

      Data:
      ${JSON.stringify(results, null, 2)}`,
      schema: configSchema,
    });

    const colors: Record<string, string> = {};
    config.yKeys.forEach((key, index) => {
      colors[key] = `hsl(var(--chart-${index + 1}))`;
    });

    const updatedConfig: Config = { ...config, colors };
    return { config: updatedConfig };
  } catch (e) {
    console.error(e);
    throw new Error("Failed to generate chart suggestion");
  }
};
