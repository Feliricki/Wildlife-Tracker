const PROXY_CONFIG = [
  {
    context: [
      "/api",
    ],
    target: "https://localhost:40443",
    ws: true,
    secure: false,
    logLevel: "debug"
  },
]

module.exports = PROXY_CONFIG;
