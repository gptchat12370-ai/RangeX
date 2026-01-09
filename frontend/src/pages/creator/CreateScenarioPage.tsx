// LEGACY: Old multi-step scenario wizard. The new canonical creator editor is ScenarioBuilder (/creator/new).
// This component is retained only as a placeholder to avoid broken imports/routes.
import React from "react";

export function CreateScenarioPage() {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      This legacy scenario wizard has been replaced by the new Scenario Builder. Please use /creator/new.
    </div>
  );
}

export default CreateScenarioPage;
