import { bindActivation } from './activation'
import type { ThemeManager } from './theme/ThemeManager'
import type { FinishMode } from './theme/types'

export function setupObjectPicker(manager: ThemeManager): void {
    const picker = document.getElementById('object-picker')
    const trigger = document.getElementById('object-type')
    const menu = document.getElementById('object-menu')
    const icon = document.querySelector<HTMLImageElement>('#object-type-icon')
    if (!picker || !trigger || !menu || !icon) return
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-finish]'))
    const close = (restoreFocus = false): void => {
        menu.hidden = true
        trigger.setAttribute('aria-expanded', 'false')
        if (restoreFocus) trigger.focus()
    }
    const open = (last = false): void => {
        menu.hidden = false
        trigger.setAttribute('aria-expanded', 'true')
        const selected = items.find(item => item.getAttribute('aria-checked') === 'true')
        ;(last ? items[items.length - 1] : selected ?? items[0])?.focus()
    }
    manager.subscribe(state => {
        for (const item of items) item.setAttribute('aria-checked', String(item.dataset.finish === state.finishMode))
        icon.src = `/icons/objects/${state.finishMode}.svg`
        const selected = items.find(item => item.dataset.finish === state.finishMode)
        const label = `Object type: ${selected?.textContent?.trim() ?? state.finishMode}`
        trigger.setAttribute('aria-label', label)
        trigger.title = label
    })
    bindActivation(trigger, () => menu.hidden ? open() : close())
    for (const item of items) {
        bindActivation(item, () => {
            manager.setFinish(item.dataset.finish as FinishMode)
            close(true)
        })
    }
    picker.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            if (menu.hidden) { open(event.key === 'ArrowUp' || event.key === 'End'); return }
            const current = items.indexOf(document.activeElement as HTMLButtonElement)
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            items[index]?.focus()
        }
    })
}
