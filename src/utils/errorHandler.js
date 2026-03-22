export function handleError(err, context = '') {
  console.error(`[PDF Tool] ${context}:`, err);
  const message = err?.message || err?.toString() || "An unexpected error occurred.";
  return `${context ? context + ': ' : ''}${message}`;
}
