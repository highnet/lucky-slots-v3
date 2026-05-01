#!/bin/bash
set -e

echo "🚀 Deploying Lucky Slots to Fly.io"

# Deploy API
echo "📡 Deploying API..."
fly deploy --config fly.api.toml

# Deploy Web
echo "🌐 Deploying Web..."
fly deploy --config fly.web.toml

echo "✅ Deployment complete!"
echo ""
echo "API:  https://lucky-slots-api.fly.dev"
echo "Web:  https://lucky-slots-web.fly.dev"
