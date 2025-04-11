import { Info } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";

export const ProjectInfo = () => {
  return (
    <div className="bg-muted p-4 mt-auto">
      <Alert className="bg-muted text-muted-foreground border-0">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription>
          Mercury Genie is your intelligent assistant for portfolio management,
          enabling natural language queries across your investment data. Explore
          client portfolios, track investments, and analyze performance with
          simple conversational questions.
        </AlertDescription>
      </Alert>
    </div>
  );
};
