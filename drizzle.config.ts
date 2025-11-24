import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/db/schemas',
	out: './drizzle',
	dialect: 'postgresql',
	casing: 'snake_case',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	tablesFilter: ['!pg_stat_statements*'],
});
