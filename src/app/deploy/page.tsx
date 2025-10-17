'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, ExternalLink } from 'lucide-react'

export default function DeployPage() {
  const [functions, setFunctions] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const fetchFunctions = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/deploy-functions', {
        method: 'POST'
      })
      const data = await response.json()
      setFunctions(data)
    } catch (error) {
      console.error('Error fetching functions:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, functionName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(functionName)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-50 via-dark-100 to-dark-200 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gradient mb-4">
            Deploy Supabase Edge Functions
          </h1>
          <p className="text-xl text-muted-foreground">
            Deploy your odds ingestion functions to production
          </p>
        </div>

        <Card className="glass-effect neon-glow">
          <CardHeader>
            <CardTitle className="text-gradient">Deployment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-neon-green rounded-full flex items-center justify-center text-dark-900 font-bold">1</div>
                <p>Go to your <a href="https://supabase.com/dashboard/project/xckbsyeaywrfzvcahhtk/functions" target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline inline-flex items-center gap-1">Supabase Edge Functions dashboard <ExternalLink className="w-4 h-4" /></a></p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-neon-blue rounded-full flex items-center justify-center text-dark-900 font-bold">2</div>
                <p>Click "Create a new function"</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-neon-purple rounded-full flex items-center justify-center text-dark-900 font-bold">3</div>
                <p>Get the function code below and deploy both functions</p>
              </div>
            </div>

            <Button 
              onClick={fetchFunctions}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading...' : 'Get Function Code'}
            </Button>
          </CardContent>
        </Card>

        {functions && (
          <div className="grid gap-6 md:grid-cols-2">
            {Object.entries(functions.functions).map(([name, code]) => (
              <Card key={name} className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-gradient">{name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(code as string, name)}
                    >
                      {copied === name ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied === name ? 'Copied!' : 'Copy'}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-dark-300 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{code as string}</code>
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="glass-effect neon-glow-green">
          <CardHeader>
            <CardTitle className="text-gradient">Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>1. Deploy both functions in Supabase</p>
              <p>2. Add environment variables in Vercel dashboard</p>
              <p>3. Test the functions are working</p>
              <p>4. Set up a cron job to run every 5 minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
