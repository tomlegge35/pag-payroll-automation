#!/usr/bin/env bash
# =============================================================================
# PAG Payroll Automation - macOS Developer Setup Script
# Tested on: macOS Sonoma 14.x / Sequoia 15.x, zsh, Apple Silicon + Intel
# Run once from repo root: bash setup-mac.sh
# =============================================================================

set -euo pipefail

GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[INFO]${RESET}  $1"; }
success() { echo -e "${GREEN}[OK]${RESET}    $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

echo ""
echo "========================================"
echo "  PAG Payroll - macOS Developer Setup"
echo "========================================"
echo ""

# --- Step 1: Homebrew ---
info "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ "$(uname -m)" == "arm64" ]]; then
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  success "Homebrew installed"
else
  success "Homebrew: $(brew --version | head -1)"
fi

# Fix Homebrew shallow clone before tapping (brew update handles this in Homebrew 4.x+)
info "Updating Homebrew..."
brew update 2>/dev/null || warn "brew update failed - continuing"
success "Homebrew up to date"

# --- Step 2: Node via nvm ---
export NVM_DIR="$HOME/.nvm"
info "Checking nvm..."
if [ ! -d "$NVM_DIR" ]; then
  info "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source "$NVM_DIR/nvm.sh"
  success "nvm installed"
else
  source "$NVM_DIR/nvm.sh" 2>/dev/null || true
  success "nvm: already installed"
fi

info "Installing Node from .nvmrc..."
if [ -f ".nvmrc" ]; then
  nvm install
  nvm use
else
  warn ".nvmrc not found - installing Node 18 LTS"
  nvm install 18 && nvm use 18
fi
success "Node: $(node --version)"

# --- Step 3: Supabase CLI ---
info "Checking Supabase CLI..."
if ! command -v supabase &>/dev/null; then
  info "Installing Supabase CLI..."
  brew install supabase/tap/supabase
  success "Supabase CLI: $(supabase --version)"
else
  success "Supabase CLI: $(supabase --version)"
  brew upgrade supabase/tap/supabase 2>/dev/null || true
fi

# --- Step 4: Netlify CLI ---
info "Checking Netlify CLI..."
if ! command -v netlify &>/dev/null; then
  npm install -g netlify-cli@latest
  success "Netlify CLI: $(netlify --version)"
else
  success "Netlify CLI: $(netlify --version)"
fi

# --- Step 5: GitHub CLI ---
info "Checking GitHub CLI..."
if ! command -v gh &>/dev/null; then
  brew install gh
fi
success "GitHub CLI: $(gh --version | head -1)"

# --- Step 6: Install project dependencies ---
info "Installing npm dependencies..."
if [ -f "package-lock.json" ]; then
  npm ci
else
  npm install
fi
success "Dependencies installed"

# --- Step 7: Environment file ---
info "Checking .env.local..."
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  warn ".env.local created from .env.example"
  warn "YOU MUST fill in real values before running the app"
  warn "Edit now: open -e .env.local"
else
  success ".env.local exists"
fi

# --- Step 8: Env var check ---
info "Checking environment variables..."
node scripts/check-env.js || warn "Fill in .env.local before starting dev server"

# --- Step 9: Auth checks ---
info "Checking Netlify auth..."
netlify status &>/dev/null && success "Netlify: authenticated" || warn "Netlify: run netlify login"

info "Checking GitHub auth..."
gh auth status &>/dev/null && success "GitHub CLI: authenticated" || warn "GitHub CLI: run gh auth login"

echo ""
echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with real values"
echo "  2. npm run env:check"
echo "  3. npm run dev"
echo "  4. open http://localhost:3000"
echo ""
echo "Supabase local dev (requires Docker):"
echo "  supabase start      # start local stack"
echo "  supabase db reset   # reset DB with migrations + seed"
echo "  supabase stop       # stop local stack"
echo ""
echo "Deploy:"
echo "  npm run validate    # typecheck + lint + build"
echo "  netlify deploy --prod"
echo ""
