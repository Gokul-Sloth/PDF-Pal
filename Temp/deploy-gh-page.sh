#!/bin/bash
# Exit on error
set -e

echo "Cleaning previous build..."
rm -rf dist

echo "Building project..."
npm run build

echo "Deploying to gh-pages..."
cd dist
git init
git config user.email "deploy@pdf-pal"
git config user.name "Deploy Bot"
git add -A
git commit -m "Deploy to gh-pages"
git push -f https://github.com/Gokul-Sloth/PDF-Pal.git HEAD:gh-pages
cd ..

echo ""
echo "Deployment complete!"
echo "Site will be live at: https://gokul-sloth.github.io/PDF-Pal/"
echo ""
echo "IMPORTANT: Make sure GitHub Pages is set to deploy from the 'gh-pages' branch."
echo "Go to: https://github.com/Gokul-Sloth/PDF-Pal/settings/pages"
