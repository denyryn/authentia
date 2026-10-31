/** Six digits read in threes, eight in fours. */
export function groupCode(code: string) {
  return code.length === 8
    ? `${code.slice(0, 4)} ${code.slice(4)}`
    : `${code.slice(0, 3)} ${code.slice(3)}`
}
