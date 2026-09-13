/**
 * Features boundary root.
 * Each feature under src/features/ represents an isolated bounded domain context.
 * Sibling cross-feature direct imports are strictly forbidden by ESLint architectural rules.
 */
export interface FeatureMetadata {
  id: string;
  name: string;
  enabled: boolean;
}
