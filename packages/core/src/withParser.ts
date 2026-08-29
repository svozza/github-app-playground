import type { ParsedResult } from '@aws-lambda-powertools/parser/types';
import type { Context } from 'aws-lambda';
import type { z } from 'zod';

function withParser<TSchema extends z.ZodType>(
  schema: TSchema,
  options: { safeParse: true }
): <T>(
  handler: (
    event: ParsedResult<unknown, z.infer<TSchema>>,
    context: Context
  ) => Promise<T>
) => (event: unknown, context: Context) => Promise<T>;

function withParser<TSchema extends z.ZodType>(
  schema: TSchema
): <T>(
  handler: (event: z.infer<TSchema>, context: Context) => Promise<T>
) => (event: unknown, context: Context) => Promise<T>;

function withParser<TSchema extends z.ZodType>(
  schema: TSchema,
  options?: { safeParse?: boolean }
) {
  return <T>(handler: (event: unknown, context: Context) => Promise<T>) => {
    return async (event: unknown, context: Context): Promise<T> => {
      return options?.safeParse
        ? handler(schema.safeParse(event), context)
        : handler(schema.parse(event), context);
    };
  };
}

export { withParser };
