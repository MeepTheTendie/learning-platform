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

// A unit is a neutral spine plus the period's own documents. Nothing else.
export const UnitSchema = z.object({
  id: z.string().regex(/^[0-9]{2}-[a-z0-9-]+$/),
  title: z.string().min(3),
  period: z.string().min(3),
  region: z.string().min(3),
  spine: z.string().regex(/^spine\.md$/),
  sources: z.array(SourceSchema).min(1),
});

export type Unit = z.infer<typeof UnitSchema>;
export type Source = z.infer<typeof SourceSchema>;
