/** Lightweight product analytics abstraction — no third-party SDK required. */

export type ProductEventName =
  | "guide_started"
  | "guide_step_viewed"
  | "guide_completed"
  | "guide_skipped"
  | "guide_dismissed"
  | "help_article_opened"
  | "help_search"
  | "help_article_helpful"
  | "help_article_not_helpful"
  | "checklist_dismissed"
  | "checklist_item_clicked";

type EventProps = Record<string, string | number | boolean | null | undefined>;

type Listener = (event: ProductEventName, props?: EventProps) => void;

const listeners = new Set<Listener>();

export function trackProductEvent(event: ProductEventName, props?: EventProps): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[sportza:analytics] ${event}`, props ?? {});
  }
  listeners.forEach((listener) => {
    try {
      listener(event, props);
    } catch {
      // never break the app for analytics
    }
  });
}

export function onProductEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
