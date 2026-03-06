import { APP_I18N_OPTIONS, type SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { extractLocaleData } from '@documenso/lib/utils/i18n';

import { langCookie } from '~/storage/lang-cookie.server';

export const getRequestLanguage = async (request: Request): Promise<SupportedLanguageCodes> => {
  const urlLanguage = new URL(request.url).searchParams.get('lang');

  if (APP_I18N_OPTIONS.supportedLangs.includes(urlLanguage as SupportedLanguageCodes)) {
    return urlLanguage as SupportedLanguageCodes;
  }

  const cookieLanguage = await langCookie.parse(request.headers.get('cookie') ?? '');

  if (APP_I18N_OPTIONS.supportedLangs.includes(cookieLanguage)) {
    return cookieLanguage;
  }

  return extractLocaleData({ headers: request.headers }).lang;
};
