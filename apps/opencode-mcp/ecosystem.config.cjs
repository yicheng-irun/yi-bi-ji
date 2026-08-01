module.exports = {
  apps: [
    {
      name: 'opencode-mcp',
      script: 'pnpm',
      args: '--filter @bi-ji/opencode-mcp start',
      cwd: '/home/yicheng/proj/20xx/bi-ji',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        OPENCODE_PORT: '4096',
        MCP_PORT: '29420',
        // MCP_TOKEN: 'xxx',
      },
    },
  ],
}
