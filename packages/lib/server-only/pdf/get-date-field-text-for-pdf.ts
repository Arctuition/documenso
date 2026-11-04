import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';

import { DEFAULT_DOCUMENT_TIME_ZONE } from '../../constants/time-zones';

const isUtcOrUnsetTimezone = (timezone: string | null | undefined) =>
  !timezone || timezone.toLowerCase() === DEFAULT_DOCUMENT_TIME_ZONE.toLowerCase();

/**
 * ArcSite: date fields signed without an explicit timezone are rendered in UTC,
 * so suffix the printed value with "UTC" to make that clear on the sealed PDF.
 */
export const getDateFieldTextForPdf = (field: Pick<Field, 'type' | 'customText'>, timezone?: string | null) => {
  if (field.type !== FieldType.DATE || !field.customText || /\bUTC$/.test(field.customText)) {
    return field.customText;
  }

  return isUtcOrUnsetTimezone(timezone) ? `${field.customText} UTC` : field.customText;
};
