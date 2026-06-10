import katex from 'katex'
import React from 'react'

function renderTex(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' })
  } catch {
    return tex
  }
}

// Formula in display (centrata, grande)
export function Display({ tex }) {
  return <div className="ktx-display" dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />
}

// Testo che puo contenere math inline tra $...$
export function Inline({ text }) {
  if (text == null) return null
  const parts = String(text).split('$')
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(p, false) }} />
          : <span key={i}>{p}</span>
      )}
    </>
  )
}
