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
      "Store odds snapshot in database with precise timestamp",
      "Generate snapshot_id for tracking and grading purposes",
      "Deactivate previous snapshots for the same run_id",
      "Enable accurate grading by comparing picks against locked odds",
      "Note: Edge calculation happens in Step 5, not here"
    ]
  },
  {
    step: 3,
    name: "Factor Analysis",
    description: "Compute confidence factors based on team performance data",
    details: [
      "Fetch team stats from NBA Stats API only for enabled factors (pace, ORtg/DRtg, 3P rates, FT rates)",
      "Calculate enabled NBA Totals factors: Pace Index, Offensive Form, Defensive Erosion, 3-Point Environment, Free-Throw Environment",
      "Apply factor weights from capper profile configuration",
      "Generate overScore/underScore signals for each factor using tanh normalization",
      "Use LLM for injury/availability analysis only if Defensive Erosion is enabled"
    ]
  },
  {
    step: 4,
    name: "AI Predictions",
    description: "Generate team-specific total predictions using factor signals",
    details: [
      "Calculate team-specific baseline: P = 0.5×(pace_home + pace_away), PPP_home = 1.10 + 0.5×(ORtg_home-110)/100 - 0.5×(DRtg_away-110)/100",
      "Compute away team efficiency: PPP_away = 1.10 + 0.5×(ORtg_away-110)/100 - 0.5×(DRtg_home-110)/100",
      "Generate baseline total: total_base = P × (PPP_home + PPP_away)",
      "Apply factor adjustments: predicted_total = total_base + Σ(factor_signal × 5.0 × weight%)",
      "Split total into home/away scores using efficiency-based allocation",
      "Calculate final confidence score from all enabled factors for unit allocation"
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
