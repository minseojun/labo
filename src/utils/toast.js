const listeners = new Set()

export const toast = {
  show(message, type = 'info') {
    listeners.forEach(fn => fn({ message, type, id: Date.now() + Math.random() }))
  },
  error(message) { this.show(message, 'error') },
  success(message) { this.show(message, 'success') },
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
