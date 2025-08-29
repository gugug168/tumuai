#!/bin/bash

# Pre-commit check script
# This script runs various checks before allowing a commit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[PRE-COMMIT]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Check for sensitive files
check_sensitive_files() {
    print_status "Checking for sensitive files..."
    
    local sensitive_patterns=(
        "\.env"
        "\.key$"
        "\.pem$"
        "\.p12$"
        "config\.json$"
        "secrets\..*"
        "password"
        "secret"
    )
    
    local found_sensitive=false
    for pattern in "${sensitive_patterns[@]}"; do
        if git diff --cached --name-only | grep -E "$pattern" > /dev/null; then
            print_error "Sensitive file pattern found: $pattern"
            found_sensitive=true
        fi
    done
    
    if [[ "$found_sensitive" == "true" ]]; then
        return 1
    else
        print_success "No sensitive files detected"
        return 0
    fi
}

# Check for TODO/FIXME comments without issue numbers
check_todos() {
    print_status "Checking for untracked TODOs..."
    
    local todos=$(git diff --cached | grep -E "^\+.*TODO|^\+.*FIXME" | grep -v "#[0-9]" || true)
    if [[ -n "$todos" ]]; then
        print_warning "Found TODOs without issue numbers:"
        echo "$todos"
        print_warning "Consider adding issue numbers to TODOs"
    else
        print_success "No untracked TODOs found"
    fi
    return 0
}

# Check file sizes
check_file_sizes() {
    print_status "Checking file sizes..."
    
    local large_files=()
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
            if [[ "$size" -gt 10485760 ]]; then  # 10MB
                large_files+=("$file ($(numfmt --to=iec "$size"))")
            fi
        fi
    done < <(git diff --cached --name-only)
    
    if [[ ${#large_files[@]} -gt 0 ]]; then
        print_warning "Large files detected:"
        printf '%s\n' "${large_files[@]}"
        print_warning "Consider using Git LFS for large files"
    else
        print_success "No large files detected"
    fi
    return 0
}

# Check for merge conflicts
check_merge_conflicts() {
    print_status "Checking for merge conflict markers..."
    
    local conflict_markers=$(git diff --cached | grep -E "^(\+.*<<<<<<< |^\+.*======= |^\+.*>>>>>>> )" || true)
    if [[ -n "$conflict_markers" ]]; then
        print_error "Merge conflict markers found!"
        return 1
    else
        print_success "No merge conflict markers found"
        return 0
    fi
}

# Check code formatting (if applicable)
check_formatting() {
    print_status "Checking code formatting..."
    
    # Check for trailing whitespace
    if git diff --cached --check > /dev/null 2>&1; then
        print_success "No whitespace issues found"
    else
        print_warning "Whitespace issues detected"
        # Fix automatically if possible
        git diff --cached --check 2>/dev/null || true
    fi
    
    # Run linter if available
    if [[ -f "package.json" ]] && command -v npm > /dev/null; then
        if npm run lint > /dev/null 2>&1; then
            print_success "Linting passed"
        else
            print_warning "Linting issues detected, but continuing..."
        fi
    fi
    
    return 0
}

# Main function
main() {
    print_status "Running pre-commit checks..."
    
    local failed_checks=()
    
    # Run all checks
    if ! check_sensitive_files; then
        failed_checks+=("sensitive_files")
    fi
    
    if ! check_merge_conflicts; then
        failed_checks+=("merge_conflicts")
    fi
    
    check_todos
    check_file_sizes
    check_formatting
    
    # Report results
    if [[ ${#failed_checks[@]} -eq 0 ]]; then
        print_success "All critical checks passed!"
        exit 0
    else
        print_error "Failed checks: ${failed_checks[*]}"
        print_error "Commit aborted!"
        exit 1
    fi
}

# Run main function
main "$@"