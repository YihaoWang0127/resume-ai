import { supabase } from '@/lib/supabase'
import type { AiUsageAction, AiUsageEntry, AiUsageStats } from '@/types/aiUsage'

let _statsPromise: Promise<AiUsageStats> | null = null

function emptyStats(): AiUsageStats {
  return {
    totalCalls: 0,
    callsThisMonth: 0,
    callsByAction: {
      parse: 0,
      enrich: 0,
      tailor: 0,
      cover_letter: 0,
      ats_score: 0,
    },
    recent: [],
  }
}

/**
 * Best-effort usage log. Must never throw — failures here must not break
 * the calling AI request.
 */
export async function logAiUsage(action: AiUsageAction, model: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('ai_usage_log')
      .insert({ user_id: user.id, action, model })

    if (error) {
      // Table not yet created (migration not applied) or any other failure — swallow it.
      return
    }

    _statsPromise = null
  } catch {
    // Never throw from usage logging.
  }
}

async function _fetchAiUsageStats(): Promise<AiUsageStats> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('ai_usage_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      // Table not yet created (migration not applied) — treat as "no usage yet"
      if (error.code === 'PGRST205' || error.code === '42P01') return emptyStats()
      throw error
    }

    const rows = (data ?? []) as AiUsageEntry[]

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const stats = emptyStats()
    stats.totalCalls = rows.length

    for (const row of rows) {
      const created = new Date(row.created_at)
      if (created.getFullYear() === currentYear && created.getMonth() === currentMonth) {
        stats.callsThisMonth += 1
      }
      if (row.action in stats.callsByAction) {
        stats.callsByAction[row.action] += 1
      }
    }

    stats.recent = rows.slice(0, 10)

    return stats
  } catch (err) {
    _statsPromise = null
    throw err
  }
}

export function getAiUsageStats(): Promise<AiUsageStats> {
  if (!_statsPromise) _statsPromise = _fetchAiUsageStats()
  return _statsPromise
}

export function prefetchAiUsageStats(): void {
  if (!_statsPromise) _statsPromise = _fetchAiUsageStats().catch(() => { _statsPromise = null; return emptyStats() })
}

export function clearAiUsageStatsCache(): void {
  _statsPromise = null
}
