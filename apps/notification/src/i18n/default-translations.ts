import { BaseTranslations } from '@notification/i18n/translation.interface';
import { TranslationService } from '@notification/i18n/translation.service';

/**
 * Default fallback translations (English) for React email templates when mounted standalone.
 */
let defaultTranslationsInstance: BaseTranslations | null = null;

export function getDefaultTranslations(): BaseTranslations {
   if (!defaultTranslationsInstance) {
      const service = new TranslationService();
      defaultTranslationsInstance = service.getTranslations();
   }
   return defaultTranslationsInstance;
}
