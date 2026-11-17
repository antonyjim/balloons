export interface MenuState { enabled: boolean; collapsed: boolean }
export function loadMenuState(): MenuState {
    let enabled = true, collapsed = false
    try { enabled = localStorage.getItem('balloons.show-menu') !== 'false'; collapsed = localStorage.getItem('balloons.menu-collapsed') === 'true' } catch { /* defaults */ }
    return { enabled, collapsed }
}
export function saveMenuState(state: Partial<MenuState>): void {
    try {
        if (state.enabled !== undefined) localStorage.setItem('balloons.show-menu', String(state.enabled))
        if (state.collapsed !== undefined) localStorage.setItem('balloons.menu-collapsed', String(state.collapsed))
    } catch { /* retain current controls when storage is unavailable */ }
}
