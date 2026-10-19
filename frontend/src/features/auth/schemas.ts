import { z } from 'zod';

/** Mirrors the server rules for fast feedback; the API remains the authority. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters — a short phrase works well`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);

export const accountPortalSchema = z.enum(['patient', 'doctor']);

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name')
    .max(100, 'Name is too long')
    .regex(/^[^<>{}]+$/, 'Name contains characters that are not allowed'),
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: passwordSchema,
  acceptTerms: z
    .boolean()
    .refine((value) => value, 'Please accept the Terms and Privacy Notice to continue'),
  accountType: accountPortalSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address'),
  password: z.string().min(1, 'Enter your password'),
  portal: z.enum(['patient', 'doctor', 'staff']),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password you have not used here',
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
});

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const authenticatorCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'));

export const recoveryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z2-7]{5}[\s-]?[A-Za-z2-7]{5}$/, 'Recovery codes look like abcde-fgh23');

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
