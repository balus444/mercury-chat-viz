"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateChartConfig,
  generateQuery,
  runGenerateSQLQuery,
} from "./actions";
import { Config, Result } from "@/lib/types";
import { Loader2, Send, Brain, Database, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ProjectInfo } from "@/components/project-info";
import { Results } from "@/components/results";
import { SuggestedQueries } from "@/components/suggested-queries";
// import { QueryViewer } from "@/components/query-viewer";
import { Search } from "@/components/search";
import { Header } from "@/components/header";
import { ChatContainer } from "@/components/ui/chat-container";
import { Message, MessageContent } from "@/components/ui/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUGGESTED_QUERIES = [
  {
    title: "Show top 10 investment positions",
    subtitle: "by number of clients",
  },
  {
    title: "Asset type distribution",
    subtitle: "across all portfolios",
  },
  {
    title: "Portfolios with highest",
    subtitle: "market value",
  },
  {
    title: "Investments with allocation",
    subtitle: "greater than 10%",
  },
];

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  results?: Result[];
  columns?: string[];
  chartConfig?: Config | null;
  isLoading?: boolean;
  loadingStep?: number;
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content:
        "🚀 Welcome to Mercury Genie!!! \n\nYour AI-powered portfolio analyst to uncover insights across your client base.",
      role: "assistant",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  // const [queryExplanations, setQueryExplanations] = useState<
  //   Array<{ section: string; explanation: string }>
  // >([]);
  // const [loadingExplanation, setLoadingExplanation] = useState(false);
  // const [isQueryExpanded, setIsQueryExpanded] = useState(false);

  const handleSubmit = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add loading message
    const loadingMsgId = (Date.now() + 1).toString();
    const loadingMessage: ChatMessage = {
      id: loadingMsgId,
      content: "",
      role: "assistant",
      isLoading: true,
      loadingStep: 1,
    };

    setMessages((prev) => [...prev, loadingMessage]);
    setInputValue("");

    try {
      // Generate SQL query
      const query = await generateQuery(inputValue);
      if (query === undefined) {
        throw new Error("Failed to generate query");
      }

      // Update loading message to step 2 when generating query
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMsgId
            ? {
                ...msg,
                loadingStep: 2,
              }
            : msg
        )
      );

      // Execute query
      const queryResults = await runGenerateSQLQuery(query);
      const columns =
        queryResults.length > 0 ? Object.keys(queryResults[0]) : [];

      // Update to step 3 for chart generation
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMsgId
            ? {
                ...msg,
                loadingStep: 3,
              }
            : msg
        )
      );

      // Generate chart config
      const generation = await generateChartConfig(queryResults, inputValue);
      const chartConfig = generation.config || null;

      // Remove loading message and add results message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== loadingMsgId);
        return [
          ...filtered,
          {
            id: (Date.now() + 2).toString(),
            content: ` \n\n${generateContextualResponse(
              inputValue,
              queryResults
            )}`,
            role: "assistant",
            results: queryResults,
            columns: columns,
            chartConfig,
            // activeQuery: query, // Storing the active query for the explainer
          },
        ];
      });
    } catch (e) {
      // Remove loading message and add error message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== loadingMsgId);
        return [
          ...filtered,
          {
            id: (Date.now() + 2).toString(),
            content:
              "Sorry, I encountered an error while processing your request. Please try again.",
            role: "assistant",
          },
        ];
      });
      toast.error("An error occurred. Please try again.");
    }
  };

  const handleSuggestedQuery = (query: string) => {
    setInputValue(query);
    handleSubmit();
  };

  // const handleExplainQuery = async (
  //   currentQuery: string,
  //   currentExplanations: Array<{ section: string; explanation: string }>
  // ) => {
  //   if (currentExplanations.length > 0) {
  //     setIsQueryExpanded(!isQueryExpanded);
  //     return;
  //   }
  //   setIsQueryExpanded(true);
  //   setLoadingExplanation(true);
  //   try {
  //     const explanations = await explainQuery(inputValue, currentQuery);
  //     setQueryExplanations(explanations);
  //   } catch (error) {
  //     console.error("Failed to fetch explanations:", error);
  //     toast.error("Failed to load query explanation.");
  //     // Optionally set some error state for explanations here
  //   } finally {
  //     setLoadingExplanation(false);
  //   }
  // };

  return (
    <main className="flex h-screen flex-col bg-white">
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <ChatContainer>
              {messages.map((message) => (
                <Message key={message.id}>
                  <div
                    className={cn(
                      "w-full py-4",
                      message.role === "assistant" ? "bg-gray-50" : ""
                    )}
                  >
                    <div className="mx-auto max-w-3xl">
                      {message.isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                          {/* Proper shadcn spinner */}
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />

                          {/* Loading steps with icons */}
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <div
                              className={`flex items-center space-x-1 transition-all duration-300 ${
                                (message.loadingStep ?? 0) >= 1
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Brain className="w-4 h-4" />
                              <span>Analyzing</span>
                            </div>

                            <div className="w-2 h-0.5 bg-border"></div>

                            <div
                              className={`flex items-center space-x-1 transition-all duration-300 ${
                                (message.loadingStep ?? 0) >= 2
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <Database className="w-4 h-4" />
                              <span>Querying</span>
                            </div>

                            <div className="w-2 h-0.5 bg-border"></div>

                            <div
                              className={`flex items-center space-x-1 transition-all duration-300 ${
                                (message.loadingStep ?? 0) >= 3
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            >
                              <BarChart3 className="w-4 h-4" />
                              <span>Visualizing</span>
                            </div>
                          </div>

                          {/* Loading text */}
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                              {(message.loadingStep ?? 0) === 1 &&
                                "Understanding your request..."}
                              {(message.loadingStep ?? 0) === 2 &&
                                "Fetching data from database..."}
                              {(message.loadingStep ?? 0) === 3 &&
                                "Creating visualization..."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={
                              message.content.includes("```")
                                ? "prose dark:prose-invert"
                                : ""
                            }
                          >
                            <MessageContent
                              markdown={message.content.includes("```")}
                            >
                              {message.content}
                            </MessageContent>
                          </div>
                          {message.results && message.columns && (
                            <div className="mt-4 border rounded-lg p-4 bg-white">
                              <Results
                                results={message.results}
                                columns={message.columns}
                                chartConfig={message.chartConfig || null}
                              />
                              {/* {message.activeQuery && (
                                <div className="mt-2">
                                  <QueryViewer
                                    activeQuery={message.activeQuery}
                                    explanations={queryExplanations}
                                    onExplainQuery={() =>
                                      handleExplainQuery(
                                        message.activeQuery!,
                                        queryExplanations
                                      )
                                    }
                                    isExpanded={isQueryExpanded}
                                    isLoadingExplanation={loadingExplanation}
                                  />
                                </div>
                              )} */}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Message>
              ))}

              {messages.length === 1 && (
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {SUGGESTED_QUERIES.map((query, index) => (
                    <button
                      key={index}
                      onClick={() =>
                        handleSuggestedQuery(query.title + " " + query.subtitle)
                      }
                      className="p-6 text-left rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900">
                        {query.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {query.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ChatContainer>
          </div>
        </div>
      </div>

      <div className="border-t bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <PromptInput
            value={inputValue}
            onValueChange={setInputValue}
            onSubmit={handleSubmit}
          >
            <PromptInputTextarea
              placeholder="Send a message..."
              className="min-h-[60px] w-full resize-none rounded-lg border-0 bg-transparent p-4 shadow-none focus:ring-0 focus-visible:ring-0 md:text-sm"
            />
            <PromptInputActions>
              <Button
                size="icon"
                onClick={handleSubmit}
                className="rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </main>
  );
}

const generateContextualResponse = (query: string, results: Result[]) => {
  const queryLower = query.toLowerCase();

  if (queryLower.includes("top") && queryLower.includes("investment")) {
    return "I've analyzed the investment positions across all portfolios. Here are the most popular investments based on client holdings:";
  }

  if (
    queryLower.includes("asset type") ||
    queryLower.includes("distribution")
  ) {
    return "I've examined the portfolio composition. Here's how different asset types are distributed across all portfolios:";
  }

  if (queryLower.includes("market value") || queryLower.includes("highest")) {
    return "I've evaluated the portfolio values. Here are the portfolios with the highest market values:";
  }

  if (queryLower.includes("tech") || queryLower.includes("stocks")) {
    return "I've identified clients with technology investments in their portfolios. Here are the details:";
  }

  if (queryLower.includes("allocation") || queryLower.includes("percentage")) {
    return "I've analyzed the investment allocations. Here are the positions with significant portfolio weightings:";
  }

  // Default response for other queries
  return "I've analyzed your portfolio data. Here are the results:";
};
