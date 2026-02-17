#!/bin/bash

# Configuration
VERSION="v0.1.1"
TITLE="Aibō Desktop v0.1.1"
NOTES="Performance: Reduced app size by ~500MB. Fixed wallet insert on fresh installs."
FILES=(
    "release/Aibō Setup 0.1.1.exe"
    "release/Aibō-0.1.1-arm64.dmg"
    "release/latest-mac.yml"
    "release/latest.yml"
)

# Function to check if running
check_gh() {
    if ! command -v gh &> /dev/null; then
        echo "Error: gh could not be found. Please install it."
        exit 1
    fi
}

# Ensure logged in or token set
ensure_auth() {
    if [ -n "$GH_TOKEN" ]; then
        echo "Using GH_TOKEN environment variable."
        return 0
    fi
    
    if gh auth status >/dev/null 2>&1; then
        echo "Using existing gh auth session."
        return 0
    fi

    echo "Error: Not logged in. Please set GH_TOKEN or run 'gh auth login'."
    exit 1
}

# Main execution
check_gh
ensure_auth

echo "Creating release $VERSION..."
# Use || true to ignore error if release already exists (we might just want to upload assets)
gh release create "$VERSION" --title "$TITLE" --notes "$NOTES" || echo "Release might already exist, attempting upload..."

echo "Uploading files..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Uploading $file..."
        gh release upload "$VERSION" "$file" --clobber
    else
        echo "Warning: File $file not found!"
    fi
done

echo "Done! 🚀"
