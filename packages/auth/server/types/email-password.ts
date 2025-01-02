import { z } from 'zod';

export const ZCurrentPasswordSchema = z
  .string()
  .min(6, { message: 'Must be at least 6 characters in length' })
  .max(72);

export const ZSignInFormSchema = z.object({
  email: z.string().email().min(1),
  password: ZCurrentPasswordSchema,
  totpCode: z.string().trim().optional(),
  backupCode: z.string().trim().optional(),
});

export type TSignInFormSchema = z.infer<typeof ZSignInFormSchema>;

export const ZPasswordSchema = z
  .string()
  .min(8, { message: 'Must be at least 8 characters in length' })
  .max(72, { message: 'Cannot be more than 72 characters in length' })
  .refine((value) => value.length > 25 || /[A-Z]/.test(value), {
    message: 'One uppercase character',
  })
  .refine((value) => value.length > 25 || /[a-z]/.test(value), {
    message: 'One lowercase character',
  })
  .refine((value) => value.length > 25 || /\d/.test(value), {
    message: 'One number',
  })
  .refine((value) => value.length > 25 || /[`~<>?,./!@#$%^&*()\-_"'+=|{}[\];:\\]/.test(value), {
    message: 'One special character is required',
  });

export const ZSignUpRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: ZPasswordSchema,
  signature: z.string().nullish(),
  url: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .regex(/^[a-z0-9-]+$/, {
      message: 'Username can only container alphanumeric characters and dashes.',
    })
    .optional(),
});

export type TSignUpRequestSchema = z.infer<typeof ZSignUpRequestSchema>;

export const ZForgotPasswordSchema = z.object({
  email: z.string().email().min(1),
});

export type TForgotPasswordSchema = z.infer<typeof ZForgotPasswordSchema>;

export const ZResetPasswordSchema = z.object({
  password: ZPasswordSchema,
  token: z.string().min(1),
});

export type TResetPasswordSchema = z.infer<typeof ZResetPasswordSchema>;

export const ZVerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type TVerifyEmailSchema = z.infer<typeof ZVerifyEmailSchema>;
