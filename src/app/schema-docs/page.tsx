import { getSupabase } from '@/lib/supabase/server'

export default async function SchemaDocsPage() {
  const supabase = getSupabase()
  
  // Get all tables using Supabase's approach
  const { data: tables, error } = await supabase
    .rpc('get_tables')

  // Fallback: manually define known tables if RPC doesn't work
  // Only include tables that actually exist in the database
  const knownTables = [
    'games', 'picks', 'teams', 'users', 'odds_history',
    'event_log', 'shiva_runs', 'shiva_run_steps'
  ]

  if (error) {
    console.log('RPC failed, using known tables:', error.message)
    // Use known tables as fallback
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">DeepPick Database Schema</h1>
        <p className="text-gray-600 mb-8">
          Database schema documentation (using known tables). Last updated: {new Date().toLocaleString()}
        </p>
        <div className="space-y-8">
          {knownTables.map((tableName) => (
            <TableSchema key={tableName} tableName={tableName} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">DeepPick Database Schema</h1>
      <p className="text-gray-600 mb-8">
        Auto-generated database schema documentation. Last updated: {new Date().toLocaleString()}
      </p>

      <div className="space-y-8">
        {tables?.map((table: any) => (
          <TableSchema key={table.table_name} tableName={table.table_name} />
        ))}
      </div>
    </div>
  )
}

async function TableSchema({ tableName }: { tableName: string }) {
  const supabase = getSupabase()
  
  // Try to get a sample row to infer column structure
  const { data: sampleData, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)

  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-red-50">
        <h2 className="text-xl font-semibold mb-2">{tableName}</h2>
        <div className="text-red-500">Error loading table: {error.message}</div>
      </div>
    )
  }

  // Extract column info from sample data
  const columns = sampleData && sampleData.length > 0 
    ? Object.keys(sampleData[0]).map(key => ({
        column_name: key,
        data_type: typeof sampleData[0][key],
        is_nullable: 'YES',
        column_default: null
      }))
    : []

  // If no sample data, show a message
  if (columns.length === 0) {
    return (
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h2 className="text-2xl font-semibold mb-4 text-blue-600">{tableName}</h2>
        <div className="text-gray-500 italic">Table exists but has no data to infer schema</div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <h2 className="text-2xl font-semibold mb-4 text-blue-600">{tableName}</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold">Column</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold">Type</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold">Nullable</th>
              <th className="border border-gray-300 px-4 py-2 text-left text-gray-900 font-semibold">Default</th>
            </tr>
          </thead>
          <tbody>
            {columns?.map((column) => (
              <tr key={column.column_name} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-mono text-gray-900 font-medium">
                  {column.column_name}
                </td>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-700">
                  {column.data_type}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center text-gray-900">
                  {column.is_nullable === 'YES' ? '✓' : '✗'}
                </td>
                <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-600">
                  {column.column_default || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
