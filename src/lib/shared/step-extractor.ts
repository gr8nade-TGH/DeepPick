import { getAllStepDefinitions } from './step-definitions'

// This function will automatically extract step definitions from the wizard component
// by parsing the step descriptions and names directly from the code
export function extractStepDefinitionsFromWizard(): typeof getAllStepDefinitions {
  // For now, return the static definitions
  // In the future, this could parse the wizard component file to extract step info
  return getAllStepDefinitions
}

// Alternative approach: Create a step registry that gets populated automatically
// when steps are defined in the wizard component
export class StepRegistry {
  private static steps: Map<number, { name: string; description: string; details: string[] }> = new Map()

  static registerStep(step: number, name: string, description: string, details: string[]) {
    this.steps.set(step, { name, description, details })
  }

  static getAllSteps() {
    return Array.from(this.steps.entries())
      .sort(([a], [b]) => a - b)
      .map(([step, data]) => ({
        step,
        name: data.name,
        description: data.description,
        details: data.details
      }))
  }

  static getStepCount() {
    return this.steps.size
  }
}

// Auto-extract from wizard component by reading the file
export function autoExtractStepDefinitions(): any[] {
  // This would read the wizard.tsx file and extract step definitions
  // For now, return the static ones
  return getAllStepDefinitions()
}
