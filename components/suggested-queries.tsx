import { motion } from "framer-motion";
import { Button } from "./ui/button";

export const SuggestedQueries = ({
  handleSuggestionClick,
}: {
  handleSuggestionClick: (suggestion: string) => void;
}) => {
  const suggestionQueries = [
    {
      desktop: "Show me top 5 portfolios by total value",
      mobile: "Top portfolios",
    },
    {
      desktop: "List top 3 clients with highest portfolio values",
      mobile: "Top clients",
    },
    {
      desktop: "Show distribution of risk profiles across clients",
      mobile: "Risk profiles",
    },
    {
      desktop: "Compare average portfolio values by risk level",
      mobile: "Risk vs Value",
    },
    {
      desktop: "Show total investments by asset type",
      mobile: "Asset types",
    },
    {
      desktop: "List portfolios created in the last 30 days",
      mobile: "New portfolios",
    },
    {
      desktop: "Show clients grouped by their financial goals",
      mobile: "Goals",
    },
    {
      desktop: "Compare market value across different portfolio types",
      mobile: "Portfolio types",
    },
    {
      desktop: "Show average investment allocation by asset type",
      mobile: "Allocations",
    },
    {
      desktop: "List clients with portfolios above $1M in value",
      mobile: "High value",
    },
    {
      desktop: "Show investment distribution by risk level",
      mobile: "Risk dist.",
    },
  ];

  return (
    <motion.div
      key="suggestions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      layout
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
        Try these queries:
      </h2>
      <div className="flex flex-wrap gap-2">
        {suggestionQueries.map((suggestion, index) => (
          <Button
            key={index}
            className={index > 5 ? "hidden sm:inline-block" : ""}
            type="button"
            variant="outline"
            onClick={() => handleSuggestionClick(suggestion.desktop)}
          >
            <span className="sm:hidden">{suggestion.mobile}</span>
            <span className="hidden sm:inline">{suggestion.desktop}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};
