export default {
  apps: [{
    name: 'researcher-backend',
    script: './server.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'client'],
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Advanced features
    instance_var: 'INSTANCE_ID',
    
    // Environment-specific variables
    env_production: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development',
      watch: true
    }
  }]
};
