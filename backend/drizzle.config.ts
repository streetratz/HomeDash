import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env['HOMEDASH_DATA_DIR']
      ? `${process.env['HOMEDASH_DATA_DIR']}/db/homedash.sqlite`
      : './data/db/homedash.sqlite',
  },
} satisfies Config;
