import { useEffect, useRef } from 'react'

interface Props {
  text: string
  isStreaming: boolean
}

export default function StreamingOutput({ text, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [text])

  return (
    <div className="w-full bg-background p-4 font-mono text-xs text-primary border border-border">
      <pre className="whitespace-pre-wrap break-all leading-relaxed">
        {text || (
          <span className="text-muted-foreground not-italic">
            Waiting for AI response…
          </span>
        )}
        {isStreaming && (
          <span
            className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-text-bottom"
            style={{ animation: 'blink 0.8s step-end infinite' }}
          />
        )}
      </pre>
      <div ref={bottomRef} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
