export interface StepDefinition {
  step: number
  name: string
  description: string
  details: string[]
}

// Global step registry that gets populated automatically
class DynamicStepRegistry {
  private steps: Map<number, StepDefinition> = new Map()

  registerStep(step: StepDefinition) {
    this.steps.set(step.step, step)
  }

  getAllSteps(): StepDefinition[] {
    return Array.from(this.steps.values()).sort((a, b) => a.step - b.step)
  }

  getStepCount(): number {
    return this.steps.size
  }

  getStep(stepNumber: number): StepDefinition | undefined {
    return this.steps.get(stepNumber)
  }
}

// Global instance
export const stepRegistry = new DynamicStepRegistry()

// Helper functions
export function registerStep(step: StepDefinition) {
  stepRegistry.registerStep(step)
}

export function getAllSteps(): StepDefinition[] {
  return stepRegistry.getAllSteps()
}

export function getStepCount(): number {
  return stepRegistry.getStepCount()
}

export function getStep(stepNumber: number): StepDefinition | undefined {
  return stepRegistry.getStep(stepNumber)
}
