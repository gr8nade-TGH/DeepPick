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
 * Calculate confidence using new weighted signal model
 * 
 * Formula: confidence = |Σ(wᵢ × sᵢ)| × 5
 * Where: wᵢ = normalized weights (sum to 1.0), sᵢ = signals (-1 to +1)
 */
export function calculateConfidence(input: ConfidenceInput): ConfidenceOutput {
  const { factors, factorWeights, confSource = 'nba_totals_v1' } = input
  
  // Normalize weights to sum to 1.0
  const totalWeight = Object.values(factorWeights).reduce((sum, w) => sum + w, 0)
  const normalizedWeights = totalWeight > 0 
    ? Object.fromEntries(Object.entries(factorWeights).map(([k, v]) => [k, v / totalWeight]))
    : {}
  
  console.log('[ConfidenceCalculator] Weight normalization:', {
    factorWeights,
    totalWeight,
    normalizedWeights
  })
  
  // Calculate signed sum: Σ(wᵢ × sᵢ)
  let signedSum = 0
  const factorContributions: ConfidenceOutput['factorContributions'] = []
  
  for (const factor of factors) {
    const weight = normalizedWeights[factor.key] || 0
    const signal = factor.normalized_value || 0 // This is our sᵢ signal
    const contribution = weight * signal
    
    signedSum += contribution
    
    factorContributions.push({
      key: factor.key,
      name: factor.name,
      z: signal, // Rename to signal for clarity
      weight,
      contribution
    })
  }
  
  // Confidence = |signedSum| × 5
  const confScore = Math.abs(signedSum) * 5
  
  return {
    edgeRaw: signedSum, // Renamed from edgeRaw to signedSum
    edgePct: Math.abs(signedSum), // Magnitude of the signal
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
