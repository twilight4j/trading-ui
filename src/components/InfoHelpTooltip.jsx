import { useEffect, useId, useRef, useState } from 'react'

function InfoHelpIconSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 11v5M12 8h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * @param {{ ariaLabel: string, children: import('react').ReactNode }} props
 */
export default function InfoHelpTooltip({ ariaLabel, children }) {
  const tooltipId = useId()
  const anchorRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return undefined
    }
    function onPointerDown(event) {
      if (anchorRef.current?.contains(event.target)) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className="snapshot-chart-help-anchor" ref={anchorRef}>
      <button
        type="button"
        className="snapshot-chart-help-icon-btn"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={ariaLabel}
        title="설명 보기"
        onClick={() => setOpen((value) => !value)}
      >
        <InfoHelpIconSvg />
      </button>
      {open ? (
        <div id={tooltipId} className="snapshot-chart-help-popover" role="tooltip">
          {children}
        </div>
      ) : null}
    </div>
  )
}
