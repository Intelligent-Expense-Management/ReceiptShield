#!/bin/bash

# ReceiptShield Production Deployment Script
# This script handles the complete deployment process to Firebase App Hosting

set -e  # Exit on any error

# Function to print receipt upload form status for debugging
print_receipt_form_status() {
    local stage=$1
    local form_path="src/components/employee/receipt-upload-form.tsx"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 RECEIPT UPLOAD FORM STATUS - $stage"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ -f "$form_path" ]; then
        echo "✅ File exists: $form_path"
        
        # Get file size and checksum
        local file_size=$(wc -c < "$form_path" 2>/dev/null || echo "0")
        local file_hash=$(md5sum "$form_path" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$form_path" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
        
        echo "📏 File size: $file_size bytes"
        echo "🔐 File hash: $file_hash"
        
        # Extract build tag if present
        if grep -q "RECEIPT_UPLOAD_FORM_BUILD_TAG" "$form_path" 2>/dev/null; then
            local build_tag=$(grep "RECEIPT_UPLOAD_FORM_BUILD_TAG" "$form_path" | head -1 | sed -n "s/.*= '\([^']*\)'.*/\1/p" || echo "not found")
            echo "🏷️  Build tag: $build_tag"
        else
            echo "⚠️  Build tag not found in file"
        fi
        
        # Show first 10 lines
        echo ""
        echo "📄 First 10 lines:"
        echo "─────────────────────────────────────────────────"
        head -n 10 "$form_path" | sed 's/^/   /'
        echo "─────────────────────────────────────────────────"
        
        # Show last 5 lines
        echo ""
        echo "📄 Last 5 lines:"
        echo "─────────────────────────────────────────────────"
        tail -n 5 "$form_path" | sed 's/^/   /'
        echo "─────────────────────────────────────────────────"
        
    else
        echo "❌ FILE NOT FOUND: $form_path"
        echo "⚠️  WARNING: Receipt upload form is missing!"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

echo "🚀 Starting ReceiptShield Production Deployment..."

# Print form status at the very beginning
print_receipt_form_status "START (Before any operations)"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run: firebase login"
    exit 1
fi

# Check if production environment file exists
if [ ! -f ".env.production" ]; then
    echo "⚠️  Production environment file not found."
    echo "Please copy env.production.template to .env.production and configure your production values."
    exit 1
fi

# Pull latest code from repository (if in a git repo)
if [ -d ".git" ]; then
    echo "🔄 Pulling latest code from repository..."
    CURRENT_BRANCH=$(git branch --show-current)
    echo "📍 Current branch: $CURRENT_BRANCH"
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "⚠️  Warning: You have uncommitted changes in your working directory."
        echo "   The deployment will use your local code, which may include uncommitted changes."
        echo "   Consider committing or stashing changes before deploying."
    fi
    
    # Always pull latest to ensure we're deploying the latest code
    if [ -z "$CI" ]; then
        # Pull latest changes (skip in CI where code is already fresh)
        git fetch origin
        LOCAL=$(git rev-parse @)
        REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "$LOCAL")
        
        if [ "$LOCAL" != "$REMOTE" ] && [ -n "$REMOTE" ]; then
            echo "🔄 Pulling latest changes from origin/$CURRENT_BRANCH..."
            git pull origin "$CURRENT_BRANCH" || {
                echo "⚠️  Failed to pull. Continuing with local code..."
            }
        else
            echo "✅ Local branch is up to date with remote."
        fi
    else
        echo "ℹ️  Running in CI environment. Using checked out code."
    fi
else
    echo "ℹ️  Not in a git repository. Building from current directory."
fi

# Print form status after git operations
print_receipt_form_status "AFTER GIT PULL (Before build)"

# Build the application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi

echo "✅ Build completed successfully!"

# Print form status after build
print_receipt_form_status "AFTER BUILD (Before deployment)"

# Deploy to Firebase App Hosting
echo "🚀 Deploying to Firebase App Hosting..."
firebase deploy --only apphosting

if [ $? -eq 0 ]; then
    echo "🎉 Deployment completed successfully!"
    
    # Print form status after deployment
    print_receipt_form_status "END (After deployment)"
    
    echo "Your app should be available at the Firebase App Hosting URL."
    echo "Next steps:"
    echo "1. Configure your custom domain in Firebase Console"
    echo "2. Update DNS records on Porkbun"
    echo "3. Test all functionality in production"
else
    echo "❌ Deployment failed. Please check the errors above."
    
    # Print form status even on failure
    print_receipt_form_status "END (After failed deployment)"
    
    exit 1
fi
