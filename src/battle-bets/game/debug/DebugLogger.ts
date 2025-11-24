/**
 * DebugLogger - Captures all debug logs for easy copying
 */

interface DebugLog {
  timestamp: number;
  type: 'castle-damage' | 'castle-manager' | 'store-hp' | 'collision' | 'projectile' | 'general';
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: DebugLog[] = [];
  private maxLogs = 500; // Keep last 500 logs
  private enabled = false;

  enable() {
    this.enabled = true;
    console.log('🔍 [DebugLogger] Enabled - capturing logs...');
  }

  disable() {
    this.enabled = false;
    console.log('🔍 [DebugLogger] Disabled');
  }

  clear() {
    this.logs = [];
    console.log('🔍 [DebugLogger] Logs cleared');
  }

  log(type: DebugLog['type'], message: string, data?: any) {
    if (!this.enabled) return;

    const log: DebugLog = {
      timestamp: Date.now(),
      type,
      message,
      data
    };

    this.logs.push(log);

    // Keep only last maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get formatted debug report
   */
  getReport(battleId?: string): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('BATTLE BETS DEBUG REPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total Logs: ${this.logs.length}`);
    if (battleId) {
      lines.push(`Battle ID: ${battleId}`);
    }
    lines.push('='.repeat(80));
    lines.push('');

    // Group logs by type
    const logsByType = this.logs.reduce((acc, log) => {
      if (!acc[log.type]) acc[log.type] = [];
      acc[log.type].push(log);
      return acc;
    }, {} as Record<string, DebugLog[]>);

    // Output each type
    for (const [type, typeLogs] of Object.entries(logsByType)) {
      lines.push(`\n${'='.repeat(80)}`);
      lines.push(`${type.toUpperCase()} (${typeLogs.length} logs)`);
      lines.push('='.repeat(80));
      
      typeLogs.forEach(log => {
        const time = new Date(log.timestamp).toISOString().split('T')[1];
        lines.push(`[${time}] ${log.message}`);
        if (log.data) {
          lines.push(`  Data: ${JSON.stringify(log.data, null, 2)}`);
        }
      });
    }

    lines.push('\n' + '='.repeat(80));
    lines.push('END OF REPORT');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Get logs as JSON
   */
  getLogsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const debugLogger = new DebugLogger();

