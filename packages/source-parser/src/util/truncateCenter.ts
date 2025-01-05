/**
 * Truncate left and right of text, if it is more than maxLength characters from the center.
 */
export function truncateAround(text: string, truncationCenter: number, maxLength = 100): string {
  if (text.length <= maxLength) return text;

  const centerText = text.slice(
    Math.max(0, truncationCenter - maxLength / 2),
    Math.min(text.length, truncationCenter + maxLength / 2)
  );

  const needsLeftEllipsis = truncationCenter > maxLength / 2;
  const needsRightEllipsis = text.length - truncationCenter > maxLength / 2;

  return `${needsLeftEllipsis ? "..." : ""}${centerText}${needsRightEllipsis ? "..." : ""}`;
}
