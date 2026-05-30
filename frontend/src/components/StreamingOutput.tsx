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
    <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-green-400 overflow-y-auto max-h-56 border border-gray-800">
      <pre className="whitespace-pre-wrap break-all leading-relaxed">
        {text || (
          <span className="text-gray-500 not-italic">
            Waiting for AI response…
          </span>
        )}
        {isStreaming && (
          <span
            className="inline-block w-[2px] h-[1em] bg-green-400 ml-0.5 align-text-bottom"
            style={{ animation: 'blink 0.8s step-end infinite' }}
          />
        )}
      </pre>
      <div ref={bottomRef} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
