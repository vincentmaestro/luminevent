// pm2.config.cjs
module.exports = {
	apps: [
		{
			name: 'dev-express-server',
			script: 'txs src/index.ts',
			instances: 5,
			exec_mode: 'cluster',
			watch: true,
			env_development: {
				NODE_ENV: 'development',
			},
			env_production: {
				NODE_ENV: 'production',
			},
		},
		{
			name: 'prod-express-server',
			script: 'build/index.js',
			instances: 5,
			exec_mode: 'cluster',
			watch: true,
			env_development: {
				NODE_ENV: 'development',
			},
			env_production: {
				NODE_ENV: 'production',
			},
		},
		{
			name: 'email-worker',
			script: 'build/workers/index.js',
			instances: 1,
			exec_mode: 'fork', // Use fork mode for single-instance workers
			watch: true,
			autorestart: true,
			env_development: {
				NODE_ENV: 'development',
			},
			env_production: {
				NODE_ENV: 'production',
			},
		},
	],
};
