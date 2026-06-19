import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { ResumeSchema } from '@/types/resume'
import ResumePreview, { type DiffHighlight } from './ResumePreview'

interface ComparisonViewProps {
  originalResume: ResumeSchema
  enrichedResume: ResumeSchema
  onAccept: () => void
  onDiscard: () => void
  hideActions?: boolean
}

type ViewMode = 'split' | 'unified'

function computeDiff(original: ResumeSchema, enriched: ResumeSchema): DiffHighlight {
  const diff: DiffHighlight = {}

  if ((original.summary ?? '') !== (enriched.summary ?? '')) {
    diff.summary = true
  }

  diff.experience = enriched.experience.map((exp, i) => {
    const origExp = original.experience[i]
    return exp.bullets.filter(Boolean).map((b, j) => {
      const origBullet = origExp?.bullets?.filter(Boolean)?.[j]
      return origBullet !== b
    })
  })

  diff.education = enriched.education.map((edu, i) => {
    const origEdu = original.education[i]
    if (!origEdu) return true
    return (
      origEdu.institution !== edu.institution ||
      origEdu.degree !== edu.degree ||
      origEdu.field !== edu.field ||
      origEdu.graduationYear !== edu.graduationYear
    )
  })

  diff.skills = enriched.skills.map((group, i) => {
    const origGroup = original.skills[i]
    return group.items.map((item, j) => {
      const origItem = origGroup?.items?.[j]
      return origItem !== item
    })
  })

  return diff
}

export default function ComparisonView({
  originalResume,
  enrichedResume,
  onAccept,
  onDiscard,
  hideActions,
}: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const leftScrollRef = useRef<HTMLDivElement>(null)
  const rightScrollRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const diffHighlight = computeDiff(originalResume, enrichedResume)

  const syncScroll = (source: 'left' | 'right') => {
    if (syncingRef.current) return
    const from = source === 'left' ? leftScrollRef.current : rightScrollRef.current
    const to = source === 'left' ? rightScrollRef.current : leftScrollRef.current
    if (!from || !to) return
    syncingRef.current = true
    requestAnimationFrame(() => {
      to.scrollTop = from.scrollTop
      to.scrollLeft = from.scrollLeft
      syncingRef.current = false
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + toggle bar */}
      <div className="shrink-0 flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-bold text-primary uppercase tracking-widest font-display">
          Live Preview
        </p>
        <div className="flex border border-border">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'px-3 min-h-[44px] text-xs font-bold uppercase tracking-wide transition-colors border-b-2',
              viewMode === 'split'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Split View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            className={cn(
              'px-3 min-h-[44px] text-xs font-bold uppercase tracking-wide transition-colors border-b-2',
              viewMode === 'unified'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Unified View
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {viewMode === 'split' ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 overflow-hidden">
            {/* Original */}
            <div
              ref={leftScrollRef}
              onScroll={() => syncScroll('left')}
              className="relative flex-1 min-h-0 overflow-auto"
            >
              <span className="absolute top-2 left-2 z-10 bg-secondary text-muted-foreground text-xs font-bold uppercase tracking-wider px-2 py-0.5">
                Original
              </span>
              <div className="opacity-75 grayscale-[0.15]">
                <ResumePreview resume={originalResume} />
              </div>
            </div>

            {/* Enriched */}
            <div
              ref={rightScrollRef}
              onScroll={() => syncScroll('right')}
              className="relative flex-1 min-h-0 overflow-auto"
            >
              <span className="absolute top-2 left-2 z-10 bg-[#22c55e] text-white text-xs font-bold uppercase tracking-wider px-2 py-0.5">
                AI Enriched
              </span>
              <div
                className="shadow-[0_0_16px_rgba(34,197,94,0.35)] border-2"
                style={{ borderColor: '#22c55e' }}
              >
                <ResumePreview resume={enrichedResume} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto">
            <ResumePreview resume={enrichedResume} diffHighlight={diffHighlight} />
          </div>
        )}

        {/* Sticky action bar */}
        {!hideActions && (
          <div className="shrink-0 mt-4 border border-border bg-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider text-center sm:text-left">
              AI enrichment ready — review changes
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onDiscard}
                className="flex-1 sm:flex-none min-h-[44px] px-4 border border-destructive text-destructive text-xs font-bold uppercase tracking-wider hover:bg-destructive/10 transition-colors"
              >
                ✗ Discard
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 sm:flex-none min-h-[44px] px-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
              >
                ✓ Accept Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
