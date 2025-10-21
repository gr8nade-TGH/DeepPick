/**
 * Confidence Calculator
 * 
 * Calculates confidence scores using factor weights from Configure Factors modal
 * and implements the sigmoid edge-percent model for better calibration.
 */

import { FactorComputation } from '@/types/factors'

export interface ConfidenceInput {
  factors: FactorComputation[]
  factorWeights: Record<string, number> // weight percentages (0-100)
  confSource?: string
}

export interface ConfidenceOutput {
  edgeRaw: number
  edgePct: number
  confScore: number
  confSource: string
  factorContributions: Array<{
    key: string
    name: string
    z: number
    weight: number
    contribution: number
  }>
}

/**
 * Calculate confidence using sigmoid edge-percent model
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceOutput {
  const { factors, factorWeights, confSource = 'nba_totals_v1' } = input
  
  // Calculate raw edge: Σ(wᵢ × zᵢ)
  let edgeRaw = 0
  const factorContributions: ConfidenceOutput['factorContributions'] = []
  
  for (const factor of factors) {
    const weight = (factorWeights[factor.key] || 0) / 100 // Convert percentage to decimal
    const z = factor.normalized_value || 0
    const contribution = weight * z
    
    edgeRaw += contribution
    
    factorContributions.push({
      key: factor.key,
      name: factor.name,
      z,
      weight,
      contribution
    })
  }
  
  // Apply sigmoid transformation: edgePct = sigmoid(edgeRaw * 2.5)
  const sigmoidK = 2.5 // Scaling constant (can be calibrated)
  const edgePct = sigmoid(edgeRaw * sigmoidK)
  
  // Scale to 0-5 confidence score
  const confScore = 5 * edgePct
  
  return {
    edgeRaw,
    edgePct,
    confScore,
    confSource,
    factorContributions
  }
}

/**
 * Sigmoid function: 1 / (1 + e^(-x))
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Get factor weights from a capper profile
 */
export function getFactorWeightsFromProfile(profile: any): Record<string, number> {
  if (!profile?.factors) return {}
  
  const weights: Record<string, number> = {}
  for (const factor of profile.factors) {
    if (factor.enabled) {
      weights[factor.key] = factor.weight
    }
  }
  
  return weights
}

/**
 * Validate that weights sum to 100%
 */
export function validateWeights(weights: Record<string, number>): {
  isValid: boolean
  totalWeight: number
  remainingWeight: number
} {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const remainingWeight = 100 - totalWeight
  const isValid = Math.abs(remainingWeight) < 0.01 // Allow tiny floating point errors
  
  return { isValid, totalWeight, remainingWeight }
}
