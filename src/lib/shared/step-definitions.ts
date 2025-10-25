export interface StepDefinition {
  step: number
  name: string
  description: string
  details: string[]
}

export const STEP_DEFINITIONS: StepDefinition[] = [
  {
    step: 1,
    name: "Game Selection",
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
    description: "Compute NBA Totals factors using team performance data",
    details: [
      "Fetch team stats from NBA Stats API for enabled factors (pace, ORtg/DRtg, 3P rates, FT rates)",
      "Calculate 6 NBA Totals factors: Pace Index, Offensive Form, Defensive Erosion, 3-Point Environment, Free-Throw Environment, Key Injuries & Availability",
      "Apply factor weights from capper profile configuration (250% total budget)",
      "Generate overScore/underScore signals for each factor using tanh normalization",
      "Use AI (Perplexity/OpenAI) for injury/availability analysis in Key Injuries factor"
    ]
  },
  {
    step: 4,
    name: "Score Predictions",
    description: "Generate total predictions using factor signals and confidence calculation",
    details: [
      "Calculate base confidence score from all factor signals using weighted sum",
      "Generate predicted total: leagueAverage (225) + Σ(factor_signal × 5.0 × weight%)",
      "Apply factor adjustments from Step 3: Pace, Offense, Defense, 3P, FT, Injuries",
      "Split total into home/away scores with realistic variance",
      "Calculate final confidence score for unit allocation in Step 5",
      "Note: Team-specific baseline calculation pending implementation"
    ]
  },
  {
    step: 5,
    name: "Pick Generation",
    description: "Calculate final Edge vs Market factor and generate betting pick",
    details: [
      "Compare predicted total from Step 4 vs current market line from Step 2",
      "Calculate edge points: edgePts = predictedTotal - marketTotalLine",
      "Generate Edge vs Market factor signal: signal = clamp(edgePts/10, -1, +1)",
      "Apply final factor: if signal > 0: overScore = |signal| × 5.0, underScore = 0; else: overScore = 0, underScore = |signal| × 5.0",
      "Calculate final confidence: base_confidence + (edgeFactor × 1.0)",
      "Determine unit allocation: <2.5→0u, 2.5-3.5→1u, 3.5-4.0→2u, 4.0-4.5→3u, ≥4.5→5u",
      "Generate pick selection text (e.g., 'OVER 227.5') with units and confidence"
    ]
  },
  {
    step: 6,
    name: "Bold Player Predictions",
    description: "Generate AI-powered bold player predictions using web research",
    details: [
      "Research recent news, injuries, and statistical trends using AI",
      "Generate 2-4 specific, measurable player predictions",
      "Align predictions with pick direction (OVER/UNDER) from Step 5",
      "Include reasoning and confidence levels for each prediction",
      "Use AI to analyze matchups and recent form for maximum accuracy"
    ]
  },
  {
    step: 7,
    name: "Pick Finalization",
    description: "Finalize and commit the betting pick with locked odds",
    details: [
      "Use pick decision from Step 5 with unit allocation and confidence",
      "Lock in odds snapshot from Step 2 for grading purposes",
      "Apply risk management rules and validation",
      "Store final pick with confidence, units, and locked odds",
      "Generate unique pick ID for tracking and grading"
    ]
  },
  {
    step: 8,
    name: "Insight Card",
    description: "Generate comprehensive analysis summary and visualization",
    details: [
      "Create visual factor breakdown showing Over/Under direction for each factor",
      "Display prominent prediction bar with units and selection",
      "Show confidence factors table with overScore/underScore contributions",
      "Generate AI-powered prediction writeup and game analysis",
      "Display market analysis, edge visualization, and confidence scoring",
      "Include locked odds and final confidence breakdown"
    ]
  },
  {
    step: 9,
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
