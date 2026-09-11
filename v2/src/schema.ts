import { z } from 'zod';

// A primary source: a document from the period, with the facts needed to cite
// it. No modern commentary lives here.
export const SourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  author: z.string().min(1),
  date: z.string().min(1),
  citation: z.string().min(10),
  license: z.string().min(3),
  url: z.string().regex(/^https?:\/\//),
  file: z.string().regex(/^sources\/[a-z0-9-]+\.md$/),
  context: z.string().min(20).max(600),
  questions: z.array(z.string().min(5)).min(1).max(6),
});

// An artifact or map image, with attribution.
export const ImageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  file: z.string().regex(/^assets\/[a-z0-9-]+\.jpg$/),
  caption: z.string().min(5).max(400),
  credit: z.string().min(5),
  license: z.string().min(2),
  url: z.string().regex(/^https?:\/\//),
});

// Activities: recognition (choice) and an optional written reflection.
export const ChoiceActivitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.literal('choice'),
  prompt: z.string().min(5),
  choices: z.array(z.string().min(1)).min(2).max(6),
  answer: z.number().int().min(0),
  feedback: z.string().min(5),
});

export const ResponseActivitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.literal('short-answer'),
  prompt: z.string().min(5),
  context: z.string().min(10).max(3000),
  rubric: z.array(z.string().min(3)).min(1).max(6),
});

export const ActivitySchema = z.discriminatedUnion('type', [ChoiceActivitySchema, ResponseActivitySchema]);

// A named interpretation: a historian's argument, clearly marked as argument.
export const InterpretationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  historian: z.string().min(3),
  work: z.string().min(3),
  year: z.string().min(3),
  claim: z.string().min(10).max(700),
  note: z.string().min(10).max(700),
});

// A unit is a neutral spine, the period's own documents, images, activities, and
// at least one named interpretation.
export const UnitSchema = z.object({
  id: z.string().regex(/^[0-9]{2}-[a-z0-9-]+$/),
  title: z.string().min(3),
  period: z.string().min(3),
  region: z.string().min(3),
  spine: z.string().regex(/^spine\.md$/),
  images: z.array(ImageSchema).default([]),
  sources: z.array(SourceSchema).min(1),
  interpretations: z.array(InterpretationSchema).default([]),
  activities: z.array(ActivitySchema).min(1),
});

export type Unit = z.infer<typeof UnitSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Interpretation = z.infer<typeof InterpretationSchema>;
