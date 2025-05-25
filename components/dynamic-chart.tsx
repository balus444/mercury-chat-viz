"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Config, Result } from "@/lib/types";
import { Label } from "recharts";
import { transformDataForMultiLineChart } from "@/lib/rechart-format";

function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
const colors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
];

// Helper function to create the ChartContainer's config object
function createContainerConfig(
  chartType: string,
  data: Result[],
  xKey: string,
  yKeys: string[],
  colorPalette: string[]
): Record<string, { label: string; color: string }> {
  if (chartType === "pie") {
    // For pie charts, the config keys are the unique values from the xKey (categories)
    return data.reduce((acc, item, index) => {
      const category = String(item[xKey]);
      acc[category] = {
        label: toTitleCase(category),
        color: colorPalette[index % colorPalette.length],
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>);
  } else {
    // For other chart types, the config keys are the yKeys (series)
    return yKeys.reduce((acc, yKeyItem, index) => {
      acc[yKeyItem] = {
        label: toTitleCase(yKeyItem),
        color: colorPalette[index % colorPalette.length],
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>);
  }
}

export function DynamicChart({
  chartData,
  chartConfig,
}: {
  chartData: Result[];
  chartConfig: Config;
}) {
  const renderChart = () => {
    if (!chartData || !chartConfig) return <div>No chart data</div>;
    const parsedChartData = chartData.map((item) => {
      const parsedItem: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(item)) {
        parsedItem[key] = isNaN(Number(value)) ? value : Number(value);
      }
      return parsedItem;
    });

    chartData = parsedChartData;

    const processChartData = (data: Result[], chartType: string) => {
      if (chartType === "bar" || chartType === "pie") {
        if (data.length <= 8) {
          return data;
        }

        const subset = data.slice(0, 20);
        return subset;
      }
      return data;
    };

    chartData = processChartData(chartData, chartConfig.type);
    // console.log({ chartData, chartConfig });

    switch (chartConfig.type) {
      case "bar":
        return (
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={chartConfig.xKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                value.length > 10 ? value.slice(0, 10) + "…" : value
              }
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {chartConfig.yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={4}
              />
            ))}
          </BarChart>
        );
      case "line":
        const { data, xAxisField, lineFields } = transformDataForMultiLineChart(
          chartData,
          chartConfig
        );
        const useTransformedData =
          chartConfig.multipleLines &&
          chartConfig.measurementColumn &&
          chartConfig.yKeys.includes(chartConfig.measurementColumn);
        // console.log(useTransformedData, "useTransformedData");
        // const useTransformedData = false;
        return (
          <LineChart
            accessibilityLayer
            data={useTransformedData ? data : chartData}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={useTransformedData ? chartConfig.xKey : chartConfig.xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {useTransformedData
              ? lineFields.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))
              : chartConfig.yKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={chartConfig.xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {chartConfig.yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                fill={`var(--color-${key})`}
                fillOpacity={0.4}
                stroke={`var(--color-${key})`}
              />
            ))}
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={chartConfig.yKeys[0]}
              nameKey={chartConfig.xKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.legend && <Legend />}
          </PieChart>
        );
      default:
        return <div>Unsupported chart type: {chartConfig.type}</div>;
    }
  };

  return (
    <div className="w-full flex flex-col justify-center items-center">
      <h2 className="text-lg font-bold mb-2">{chartConfig.title}</h2>
      {chartConfig && chartData.length > 0 && (
        <ChartContainer
          config={createContainerConfig(
            chartConfig.type,
            chartData,
            chartConfig.xKey,
            chartConfig.yKeys,
            colors
          )}
          className="h-[320px] w-full"
        >
          {renderChart()}
        </ChartContainer>
      )}
      <div className="w-full">
        <p className="mt-4 text-sm">{chartConfig.description}</p>
        <p className="mt-4 text-sm">{chartConfig.takeaway}</p>
      </div>
    </div>
  );
}
