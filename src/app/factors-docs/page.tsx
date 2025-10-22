import { getSupabase } from '@/lib/supabase/server'
import { FACTOR_REGISTRY } from '@/lib/cappers/shiva-v1/factor-registry'
import { getAllStepDefinitions } from '@/lib/shared/step-definitions'

export default async function FactorsDocsPage() {
  const supabase = getSupabase()
  
  // Get recent factor usage from database
  const { data: recentFactors, error } = await supabase
    .from('shiva_run_steps')
    .select('step_number, json, created_at')
    .eq('step_number', 3)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.log('Error loading recent factors:', error.message)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">DeepPick Factors & Pick Generation</h1>
      <p className="text-gray-600 mb-8">
        Auto-generated documentation for SHIVA factor system and pick generation pipeline. 
        Last updated: {new Date().toLocaleString()}
      </p>

      {/* Factor Registry */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-blue-600">Factor Registry</h2>
        <p className="text-gray-600 mb-4">
          Complete catalog of all available factors with their configurations, data sources, and computation logic.
        </p>
        
        <div className="space-y-6">
          {FACTOR_REGISTRY.map((factor, index) => (
            <div key={factor.key} className="border rounded-lg p-6 bg-white shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {factor.icon} {factor.name}
                  </h3>
                  <p className="text-sm text-gray-600 font-mono">{factor.key}</p>
                </div>
                <div className="flex gap-2">
                  {factor.appliesTo.sports === '*' ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Global</span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      {Array.isArray(factor.appliesTo.sports) ? factor.appliesTo.sports.join(', ') : factor.appliesTo.sports}
                    </span>
                  )}
                  {factor.appliesTo.betTypes === '*' ? (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">All Bet Types</span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                      {Array.isArray(factor.appliesTo.betTypes) ? factor.appliesTo.betTypes.join(', ') : factor.appliesTo.betTypes}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700 text-sm">{factor.description}</p>
                  
                  <h4 className="font-semibold text-gray-900 mb-2 mt-4">Data Source</h4>
                  <p className="text-gray-700 text-sm">StatMuse API, NBA Stats API, LLM Analysis</p>
                  
                  <h4 className="font-semibold text-gray-900 mb-2 mt-4">Max Points</h4>
                  <p className="text-gray-700 text-sm">{factor.maxPoints}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Computation Logic</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono text-gray-800">
                    Normalized scoring based on league anchors and team performance metrics
                  </div>
                  
                  <h4 className="font-semibold text-gray-900 mb-2 mt-4">Examples</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm">
                    <p>High pace team vs slow team = +0.8 points toward Over</p>
                    <p>Hot shooting vs cold defense = +0.6 points toward Over</p>
                    <p>Injury impact = -0.4 points toward Under</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pick Generation Pipeline */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-blue-600">Pick Generation Pipeline</h2>
        <p className="text-gray-600 mb-4">
          The {getAllStepDefinitions().length}-step process for generating sports predictions using the SHIVA system.
        </p>
        
        <div className="space-y-4">
          {getAllStepDefinitions().map((step) => (
            <div key={step.step} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center mb-3">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
                  {step.step}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{step.name}</h3>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-11">
                {step.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Factor Usage */}
      {recentFactors && recentFactors.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-blue-600">Recent Factor Usage</h2>
          <p className="text-gray-600 mb-4">
            Latest factor computations from recent pick generation runs.
          </p>
          
          <div className="space-y-4">
            {recentFactors.map((run, index) => (
              <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Run {run.created_at ? new Date(run.created_at).toLocaleString() : 'Unknown'}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {run.json?.factor_count || 0} factors computed
                  </span>
                </div>
                {run.json?.factors && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {run.json.factors.slice(0, 8).map((factor: any, idx: number) => (
                      <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                        <div className="font-mono font-semibold">{factor.key}</div>
                        <div className="text-gray-600">
                          {factor.normalized_value ? Number(factor.normalized_value).toFixed(2) : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Configuration */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-blue-600">System Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Environment Variables</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">SHIVA_V1_UI_ENABLED:</span>
                <span className="font-mono">{process.env.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SHIVA_V1_API_ENABLED:</span>
                <span className="font-mono">{process.env.NEXT_PUBLIC_SHIVA_V1_API_ENABLED || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SHIVA_V1_WRITE_ENABLED:</span>
                <span className="font-mono">{process.env.NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED || 'Not set'}</span>
              </div>
            </div>
          </div>
          
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Factor Statistics</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Steps:</span>
                <span className="font-mono">{getAllStepDefinitions().length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Factors:</span>
                <span className="font-mono">{FACTOR_REGISTRY.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Global Factors:</span>
                <span className="font-mono">
                  {FACTOR_REGISTRY.filter(f => f.appliesTo.sports === '*').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">NBA-Specific:</span>
                <span className="font-mono">
                  {FACTOR_REGISTRY.filter(f => f.appliesTo.sports === '*' || (Array.isArray(f.appliesTo.sports) && f.appliesTo.sports.includes('NBA'))).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
