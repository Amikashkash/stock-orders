export function useHaptics() {
  const vibrate = (pattern) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  }

  return {
    addToCart: () => vibrate(50),
    success: () => vibrate([100, 50, 100]),
    error: () => vibrate([200, 100, 200]),
  }
}
