#!/bin/bash

# Auto-commit script for Claude Code modifications
# Usage: ./scripts/auto-commit.sh "commit message description"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_COMMIT_TYPE="feat"
AUTHOR_NAME="Claude AI Assistant"
AUTHOR_EMAIL="claude@anthropic.com"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[AUTO-COMMIT]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository!"
        exit 1
    fi
}

# Function to check for uncommitted changes
check_changes() {
    if git diff --quiet && git diff --staged --quiet; then
        print_warning "No changes to commit"
        exit 0
    fi
}

# Function to run pre-commit checks
pre_commit_check() {
    print_status "Running pre-commit checks..."
    
    # Check for sensitive files
    if git diff --cached --name-only | grep -E '\.(env|key|pem|p12)$' > /dev/null; then
        print_error "Attempting to commit sensitive files!"
        return 1
    fi
    
    # Check for large files (> 10MB)
    for file in $(git diff --cached --name-only); do
        if [[ -f "$file" && $(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null) -gt 10485760 ]]; then
            print_warning "Large file detected: $file"
        fi
    done
    
    # Check if TypeScript/JavaScript files compile (if applicable)
    if command -v npm > /dev/null && [[ -f "package.json" ]]; then
        if npm run build > /dev/null 2>&1; then
            print_success "Build check passed"
        else
            print_warning "Build check failed, but continuing..."
        fi
    fi
    
    return 0
}

# Function to generate commit message
generate_commit_message() {
    local description="$1"
    local commit_type="${2:-$DEFAULT_COMMIT_TYPE}"
    
    if [[ -z "$description" ]]; then
        # Auto-generate description based on changed files
        local changed_files=$(git diff --staged --name-only | head -3)
        if [[ $(echo "$changed_files" | wc -l) -eq 1 ]]; then
            description="Update $(basename "$changed_files")"
        else
            description="Update multiple files"
        fi
    fi
    
    # Create full commit message
    cat << EOF
[$commit_type] $description

Modified files:
$(git diff --staged --name-only | sed 's/^/- /')

🤖 Generated with Claude Code (claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
}

# Function to perform the commit
do_commit() {
    local commit_message="$1"
    
    print_status "Staging all changes..."
    git add .
    
    print_status "Committing changes..."
    git commit -m "$commit_message" --author="$AUTHOR_NAME <$AUTHOR_EMAIL>"
    
    local commit_hash=$(git rev-parse --short HEAD)
    print_success "Committed successfully: $commit_hash"
}

# Function to push to remote (optional)
do_push() {
    if [[ "$AUTO_PUSH" == "true" ]] || [[ "$1" == "--push" ]]; then
        print_status "Pushing to remote..."
        if git push; then
            print_success "Pushed to remote successfully"
        else
            print_warning "Failed to push to remote"
            return 1
        fi
    fi
}

# Main function
main() {
    print_status "Starting auto-commit process..."
    
    # Parse arguments
    local description=""
    local commit_type="$DEFAULT_COMMIT_TYPE"
    local should_push=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --type=*)
                commit_type="${1#*=}"
                shift
                ;;
            --push)
                should_push=true
                shift
                ;;
            --help)
                echo "Usage: $0 [description] [--type=TYPE] [--push]"
                echo "  description: Commit description"
                echo "  --type=TYPE: Commit type (feat, fix, refactor, etc.)"
                echo "  --push: Push to remote after commit"
                exit 0
                ;;
            *)
                description="$1"
                shift
                ;;
        esac
    done
    
    # Run checks
    check_git_repo
    check_changes
    
    if ! pre_commit_check; then
        print_error "Pre-commit checks failed!"
        exit 1
    fi
    
    # Generate and execute commit
    local commit_message=$(generate_commit_message "$description" "$commit_type")
    do_commit "$commit_message"
    
    # Push if requested
    if [[ "$should_push" == "true" ]]; then
        do_push
    fi
    
    print_success "Auto-commit process completed!"
}

# Run main function
main "$@"