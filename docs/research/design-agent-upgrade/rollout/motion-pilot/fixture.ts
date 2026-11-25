import { createDraggable, type MotionDraggable } from '../../../../core/templates/motion'

let handle: MotionDraggable | null = null
let releases = 0
let updates = 0
let adds = 0
let removes = 0
const matchMedia = window.matchMedia.bind(window)
window.matchMedia = query => {
  const mq = matchMedia(query)
  const add = mq.addEventListener.bind(mq)
  const remove = mq.removeEventListener.bind(mq)
  mq.addEventListener = (...args: Parameters<typeof mq.addEventListener>) => {
    if (args[0] === 'change') adds++
    add(...args)
  }
  mq.removeEventListener = (...args: Parameters<typeof mq.removeEventListener>) => {
    if (args[0] === 'change') removes++
    remove(...args)
  }
  return mq
}
function snapshot() {
  const d = handle?.draggable
  const rect = document.querySelector('#tile')!.getBoundingClientRect()
  return {
    time: performance.now(), x: rect.x, y: rect.y, engineX: d?.x,
    grabbed: d?.grabbed, released: d?.released, enabled: d?.enabled,
    tickerPaused: d?.updateTicker.paused,
    inertiaPaused: d ? Object.values(d.animate.animations).every(a => a.paused) : true,
    releases, updates, adds, removes,
  }
}
const pilot = {
  create() {
    releases = 0
    updates = 0
    handle = createDraggable('#tile', {
      y: false, container: [0, 900, 0, 0], cursor: false,
      onRelease() { releases++ }, onUpdate() { updates++ },
    })
    return snapshot()
  },
  snapshot,
  destroy() { handle?.destroy(); handle?.destroy(); return snapshot() },
}
declare global { interface Window { pilot: typeof pilot } }
window.pilot = pilot
pilot.create()
