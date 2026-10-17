import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from './Icon'
import { normalizeDestination, type Poster } from '../lib/utils'

export function Lightbox({ poster, onClose }: { poster: Poster | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (poster && !d.open) d.showModal()
    if (!poster && d.open) d.close()
    setCopied(false); setNote('')
  }, [poster])
  const [reported, setReported] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('reported') || '[]') } catch { return [] } })
  const pid = poster?.id == null ? null : String(poster.id)
  const done = pid !== null && reported.includes(pid)
  const url = poster ? normalizeDestination(poster.target_url) : null

  const share = async () => {
    if (!poster) return
    if (navigator.share) {
      try { await navigator.share({ title: poster.title || 'CrowdCanvas poster', text: poster.caption || '', url: poster.image_url }) } catch { /* cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(poster.image_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }

  const report = async () => {
    if (pid === null || done || !confirm('Report this poster to the moderators?')) return
    const reason = (prompt('Reason (optional, max 200 characters)') ?? '').trim().slice(0, 200)
    const { error } = await supabase.from('poster_reports').insert({ poster_id: poster!.id, reason: reason || null })
    // 23505 = this IP already reported it; treat as done
    if (error && error.code !== '23505') { setNote('Could not report: ' + error.message); return }
    const next = [...reported, pid]
    setReported(next)
    setNote('Reported, thanks')
    try { localStorage.setItem('reported', JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  return (
    <dialog ref={ref} className="lightbox" aria-label="Poster preview" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}>
      <img src={poster?.image_url} alt={poster?.title || 'Community poster'} />
      <h3>{poster?.title || 'Untitled poster'}</h3>
      <p>{poster?.caption || ''}</p>
      <div className="lbbar">
        <a className="visit-link" hidden={typeof url !== 'string'} href={typeof url === 'string' ? url : undefined} target="_blank" rel="noopener noreferrer">
          <Icon name="arrowUpRight" /><span>Visit website</span>
        </a>
        <button className="btn" type="button" onClick={share}><Icon name="share" /><span>{copied ? 'Copied' : 'Share'}</span></button>
        <button className="btn" type="button" disabled={done} onClick={report}><Icon name="flag" /><span>{done ? 'Reported' : 'Report'}</span></button>
        <button className="themebtn lbclose" type="button" aria-label="Close" onClick={() => ref.current?.close()}><Icon name="x" /></button>
      </div>
      <p role="status">{note}</p>
    </dialog>
  )
}
