import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseTranslations, ITranslationService, Locale } from '@notification/i18n/translation.interface';

/**
 * Service for loading, caching, and interpolating email template translations.
 * Implements Strategy Pattern (ITranslationService) to allow flexible translation retrieval.
 */
@Injectable()
export class TranslationService implements ITranslationService {
   private readonly logger = new Logger(TranslationService.name);
   private readonly translationCache = new Map<Locale, BaseTranslations>();

   constructor() {
      this.preloadTranslations();
   }

   /**
    * Returns translations for a requested locale.
    * Falls back to English (Locale.EN) if the requested locale is not supported or missing.
    */
   getTranslations(locale?: Locale | string): BaseTranslations {
      const normalizedLocale = this.normalizeLocale(locale);

      const cached = this.translationCache.get(normalizedLocale);
      if (cached) {
         return cached;
      }

      const loaded = this.loadTranslationFile(normalizedLocale);
      this.translationCache.set(normalizedLocale, loaded);
      return loaded;
   }

   /**
    * Returns the list of currently supported locales.
    */
   getSupportedLocales(): Locale[] {
      return [Locale.EN, Locale.VI];
   }

   /**
    * Checks whether a given locale string is supported.
    */
   isLocaleSupported(locale: string): boolean {
      return this.getSupportedLocales().includes(locale as Locale);
   }

   /**
    * Interpolates dynamic parameters into a translation string.
    * Example: "Hello {name}!" with { name: "Alice" } -> "Hello Alice!"
    */
   interpolate(text: string, params: Record<string, string | number>): string {
      return text.replace(/{(\w+)}/g, (_match: string, key: string): string => {
         const val: string | number | undefined = params[key];
         return val !== undefined ? String(val) : _match;
      });
   }

   /**
    * Normalizes input locale string and applies fallback to Locale.EN.
    */
   private normalizeLocale(locale?: Locale | string): Locale {
      if (!locale) {
         return Locale.EN;
      }

      const lower = locale.toLowerCase().trim();
      if (this.isLocaleSupported(lower)) {
         return lower as Locale;
      }

      this.logger.warn(`Unsupported locale: "${locale}". Falling back to "${Locale.EN}".`);
      return Locale.EN;
   }

   /**
    * Preloads all supported translations into memory on service startup.
    */
   private preloadTranslations(): void {
      for (const locale of this.getSupportedLocales()) {
         try {
            const translations = this.loadTranslationFile(locale);
            this.translationCache.set(locale, translations);
            this.logger.log(`Loaded translations for locale: ${locale}`);
         } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to preload translations for ${locale}: ${msg}`);
         }
      }
   }

   /**
    * Resolves and loads translation JSON file from disk across possible runtime directory layouts.
    */
   private loadTranslationFile(locale: Locale): BaseTranslations {
      const candidatePaths = [
         join(__dirname, 'email', `${locale}.json`),
         join(__dirname, '../i18n/email', `${locale}.json`),
         join(process.cwd(), 'apps/notification/src/i18n/email', `${locale}.json`),
         join(process.cwd(), 'dist/apps/notification/i18n/email', `${locale}.json`),
         join(process.cwd(), 'dist/apps/notification/src/i18n/email', `${locale}.json`),
      ];

      for (const filePath of candidatePaths) {
         if (existsSync(filePath)) {
            try {
               const raw = readFileSync(filePath, 'utf-8');
               return JSON.parse(raw) as BaseTranslations;
            } catch (err: unknown) {
               const msg = err instanceof Error ? err.message : String(err);
               this.logger.warn(`Failed reading translation at ${filePath}: ${msg}`);
            }
         }
      }

      // If locale is not EN and file loading failed, try falling back to EN file or default fallback
      if (locale !== Locale.EN) {
         this.logger.warn(`Could not locate ${locale}.json, falling back to ${Locale.EN}`);
         return this.getTranslations(Locale.EN);
      }

      throw new Error(`Translation file could not be found for locale: ${locale}`);
   }
}
