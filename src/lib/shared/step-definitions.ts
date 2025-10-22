export interface StepDefinition {
  step: number
  name: string
  description: string
  details: string[]
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    step: 1,
    name: "Run Intake",
    description: "Initialize prediction run and select optimal game",
    details: [
      "Filter games by status (scheduled), timing (>30min), and existing picks",
      "For TOTAL: Find games with no TOTAL predictions",
      "For SPREAD/MONEYLINE: Find games with no SPREAD OR MONEYLINE predictions",
      "Generate unique run_id and retrieve game details + current odds"
    ]
  },
  {
    step: 2,
    name: "Odds Snapshot",
    description: "Capture current market odds at prediction time",
    details: [
      "Collect moneyline, spread, and total odds from all bookmakers",
      "Timestamp snapshot for grading and edge calculation: Locks exact odds at prediction time for fair performance evaluation",
      "Generate snapshot_id with complete odds data and precise timestamp",
      "Enables accurate grading by comparing picks against the exact market lines you saw",
      "Calculates edge by measuring how much the market moved in your favor"
    ]
  },
  {
    step: 3,
    name: "Factor Analysis",
    description: "Compute confidence factors based on team performance data",
    details: [
      "Fetch team stats from NBA Stats API and StatMuse",
      "Analyze Pace Index, Offensive Form, Defensive Erosion",
      "Process 3-Point Environment and Free-Throw factors",
      "Apply injury/availability data via LLM analysis"
    ]
  },
  {
    step: 4,
    name: "AI Predictions",
    description: "Generate final score predictions using AI models",
    details: [
      "Combine factor analysis with team performance data",
      "Apply AI models for score prediction",
      "Calculate confidence scores and determine winner",
      "Generate predicted scores (home/away) and margin"
    ]
  },
  {
    step: 5,
    name: "Market Analysis",
    description: "Calculate market edge and adjust confidence",
    details: [
      "Compare predicted total vs market line",
      "Calculate edge percentage and market adjustment",
      "Apply final confidence score adjustments",
      "Determine pick direction (Over/Under) based on edge"
    ]
  },
  {
    step: 6,
    name: "Pick Generation",
    description: "Create final betting recommendation",
    details: [
      "Convert confidence to unit allocation (1u, 2u, 3u, 5u)",
      "Generate pick selection text and rationale",
      "Lock in odds snapshot for grading purposes",
      "Apply risk management rules and validation"
    ]
  },
  {
    step: 7,
    name: "Insight Card",
    description: "Generate comprehensive analysis summary",
    details: [
      "Create visual factor breakdown with team contributions",
      "Generate AI-powered prediction writeup",
      "Display market analysis and edge visualization",
      "Show confidence scoring explanation and rationale"
    ]
  },
  {
    step: 8,
    name: "Debug Report",
    description: "Generate comprehensive debugging information",
    details: [
      "Collect all step responses and execution data",
      "Generate comprehensive debug report for analysis",
      "Include factor breakdowns, AI responses, and timing data",
      "Provide copy-paste debug information for troubleshooting"
    ]
  }
]

export function getStepDefinition(stepNumber: number): StepDefinition | undefined {
  return STEP_DEFINITIONS.find(step => step.step === stepNumber)
}

export function getAllStepDefinitions(): StepDefinition[] {
  return STEP_DEFINITIONS
}
