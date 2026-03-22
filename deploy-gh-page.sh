#!/bin/bash
# Exit on error
set -e

# Build the project with Vite
echo "Building the project..."
npm run build

# Navigate into the build output directory
cd dist

# Initialize a new git repository for the built files
echo "Initializing deployment repository..."
git init
git add -A
git commit -m "Deploy to gh-pages"

# Push to the gh-pages branch
echo "Pushing built files to GitHub Pages..."
git push -f https://github.com/Gokul-Sloth/PDF-Pal.git master:gh-pages

# Return to root
cd ..
echo "Deployment complete! Give GitHub a few minutes to publish the site."
