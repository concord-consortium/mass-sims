/**
 * The rendered width of each label line in a timeline stop: the year line, then each event line.
 * Measured with a `Range` so the result is the text's own width, not its box. Two stops only collide
 * line against line, so the layout needs each line, not just the widest.
 *
 * In its own module so component tests can mock it: jsdom does not lay out text.
 */
export function measureLineWidths(stop: HTMLElement): number[] {
  return Array.from(stop.querySelectorAll(".collapse-tl-yr, .collapse-tl-ev"), (line) => {
    const range = document.createRange();
    range.selectNodeContents(line);
    return range.getBoundingClientRect().width;
  });
}
