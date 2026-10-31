import {useEffect, useState} from 'react'

/** One shared one-second tick for every countdown on the page. */
export function useNow(clock: () => number) {
  const [now, setNow] = useState(clock)

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 1000)
    return () => window.clearInterval(id)
  }, [clock])

  return now
}
