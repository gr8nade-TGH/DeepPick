import fs from 'fs'
import path from 'path'

export interface StepDefinition {
  step: number
  name: string
  description: string
  details: string[]
}

// This function reads the wizard component and extracts step definitions automatically
export function extractStepsFromWizard(): StepDefinition[] {
  try {
    const wizardPath = path.join(process.cwd(), 'src/app/cappers/shiva/management/components/wizard.tsx')
    const wizardContent = fs.readFileSync(wizardPath, 'utf-8')
    
    const steps: StepDefinition[] = []
    
    // Extract step names and descriptions from the JSX
    const stepNameRegex = /step === (\d+) && "Step \d+: ([^"]+)"/g
    const stepDescriptionRegex = /step === (\d+) && \(\s*<div>\s*<div className="[^"]*">([^<]+)<\/div>\s*<ul[^>]*>([\s\S]*?)<\/ul>\s*<\/div>\s*\)/g
    
    let stepNameMatch
    const stepNames = new Map<number, string>()
    
    while ((stepNameMatch = stepNameRegex.exec(wizardContent)) !== null) {
      const stepNum = parseInt(stepNameMatch[1])
      const name = stepNameMatch[2]
      stepNames.set(stepNum, name)
    }
    
    let stepDescMatch
    while ((stepDescMatch = stepDescriptionRegex.exec(wizardContent)) !== null) {
      const stepNum = parseInt(stepDescMatch[1])
      const description = stepDescMatch[2].trim()
      const detailsHtml = stepDescMatch[3]
      
      // Extract list items from the HTML
      const listItemRegex = /<li[^>]*>([^<]+)<\/li>/g
      const details: string[] = []
      let listItemMatch
      
      while ((listItemMatch = listItemRegex.exec(detailsHtml)) !== null) {
        // Clean up HTML entities and tags
        let detail = listItemMatch[1]
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/<strong[^>]*>([^<]+)<\/strong>/g, '$1')
          .replace(/<[^>]+>/g, '')
          .trim()
        if (detail) {
          details.push(detail)
        }
      }
      
      const name = stepNames.get(stepNum) || `Step ${stepNum}`
      
      steps.push({
        step: stepNum,
        name,
        description,
        details
      })
    }
    
    return steps.sort((a, b) => a.step - b.step)
    
  } catch (error) {
    console.error('Error extracting steps from wizard:', error)
    // Fallback to static definitions
    return [
      {
        step: 1,
        name: "Run Intake",
        description: "Initialize prediction run and select optimal game",
        details: ["Filter games by status and timing", "Generate run_id and retrieve game details"]
      },
      {
        step: 2,
        name: "Odds Snapshot", 
        description: "Capture current market odds at prediction time",
        details: ["Collect odds from all bookmakers", "Generate timestamp snapshot for grading"]
      }
    ]
  }
}

// For use in Next.js API routes or server components
export function getAutoExtractedSteps(): StepDefinition[] {
  // In production, this would extract from the built files
  // For now, return a simplified version
  return extractStepsFromWizard()
}
