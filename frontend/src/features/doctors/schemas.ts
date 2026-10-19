import { z } from 'zod';
import { CONSULTATION_MODES, LANGUAGES } from './api';

/** Mirrors the server rules for fast feedback; the API remains the authority. */
const TEXT = /^[\p{L}\p{N} .,&()'/-]+$/u;
const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Enter your ${label}`)
    .max(max, `Use at most ${max} characters`)
    .regex(TEXT, 'Use letters, numbers and simple punctuation only');

export const doctorApplicationSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Enter your registration number')
    .max(30, 'Use at most 30 characters')
    .regex(/^[A-Za-z0-9/. -]+$/, 'Use letters, numbers, spaces, / . or - only'),
  registrationCouncil: text('medical council', 3, 120),
  registrationYear: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the year as four digits, for example 2015')
    .refine(
      (value) => Number(value) >= 1950 && Number(value) <= new Date().getFullYear(),
      'Enter the year you were registered',
    ),
  qualification: text('qualifications', 2, 120),
  specialty: text('speciality', 2, 80),
});

export type DoctorApplicationValues = z.infer<typeof doctorApplicationSchema>;

const PLACE = /^[\p{L}\p{N} .,&()'/-]*$/u;
const place = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .regex(PLACE, 'Use letters, numbers and simple punctuation only');

export const doctorProfileSchema = z.object({
  bio: z.string().trim().max(1500, 'Use at most 1,500 characters'),
  languages: z.array(z.enum(LANGUAGES)),
  consultationModes: z.array(z.enum(CONSULTATION_MODES)),
  consultationFeeInr: z
    .string()
    .trim()
    .regex(/^\d{0,5}$/, 'Enter the fee in whole rupees, for example 500')
    .refine((value) => value === '' || Number(value) <= 50_000, 'The fee can be at most ₹50,000'),
  clinicName: place(120),
  city: place(60),
  locality: place(80),
  requiresBookingApproval: z.boolean(),
  published: z.boolean(),
});

export type DoctorProfileValues = z.infer<typeof doctorProfileSchema>;

export const rejectionSchema = z
  .string()
  .trim()
  .min(10, 'Explain what the applicant needs to fix (at least 10 characters)')
  .max(500, 'Use at most 500 characters');
