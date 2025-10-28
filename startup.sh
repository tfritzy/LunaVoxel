#!/bin/bash

PROJECT_ROOT="${1:-.}"
set -e

write_step() {
    echo -e "\e[36mStep: $1\e[0m"
}

write_success() {
    echo -e "\e[32mSuccess: $1\e[0m"
}

write_error() {
    echo -e "\e[31mError: $1\e[0m"
}

DEV_WORKSPACE=2

open_in_new_terminal() {
    local title="$1"
    local command="$2"
    local working_dir="${3:-$PWD}"
    
    hyprctl dispatch workspace $DEV_WORKSPACE >/dev/null 2>&1
    
    if command -v alacritty >/dev/null 2>&1; then
        alacritty --working-directory "$working_dir" --title "$title" -e bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v kitty >/dev/null 2>&1; then
        kitty --directory "$working_dir" --title "$title" bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v wezterm >/dev/null 2>&1; then
        wezterm start --cwd "$working_dir" -- bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v foot >/dev/null 2>&1; then
        foot --working-directory="$working_dir" --title="$title" bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v st >/dev/null 2>&1; then
        st -d "$working_dir" -t "$title" -e bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v konsole >/dev/null 2>&1; then
        konsole --new-tab --workdir "$working_dir" --title "$title" -e bash -c "$command; echo 'Press Enter to close...'; read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    else
        echo "No supported terminal found. Running in background..."
        cd "$working_dir" && bash -c "$command" &
        return 1
    fi
    return 0
}

cleanup() {
    if [ $? -ne 0 ]; then
        write_error "Script failed"
        exit 1
    fi
}

trap cleanup EXIT

cd "$PROJECT_ROOT"

write_step "Step 0: Clearing all local SpacetimeDB data"
echo -e "\e[33mStopping any running SpacetimeDB instances...\e[0m"
pkill -f "spacetime start" 2>/dev/null || true
sleep 2

echo -e "\e[33mClearing SpacetimeDB data directory...\e[0m"
SPACETIME_DATA_DIR="$HOME/.spacetime"
if [ -d "$SPACETIME_DATA_DIR" ]; then
    rm -rf "$SPACETIME_DATA_DIR"
    write_success "SpacetimeDB data cleared"
else
    write_success "No existing SpacetimeDB data found"
fi

write_step "Step 1: Starting SpaceTimeDB"
if open_in_new_terminal "SpaceTimeDB" "spacetime start"; then
    write_success "SpaceTimeDB started in new terminal"
else
    write_success "SpaceTimeDB started in background"
fi

echo -e "\e[33mWaiting for SpaceTimeDB to initialize...\e[0m"
sleep 5

write_step "Step 2: Publishing Rust backend with clean flag"
spacetime publish -c --project-path backend lunavoxel-db -y
write_success "Rust backend published successfully"

write_step "Step 3: Generating TypeScript bindings"
spacetime generate --lang typescript --out-dir frontend/src/module_bindings --project-path backend
write_success "TypeScript bindings generated"

write_step "Step 4: Building functions"
cd functions
npm run build
cd ..
write_success "Functions built successfully"

write_step "Step 5: Building WASM module"
cd wasm
wasm-pack build --target web --release
cd ..
write_success "WASM module built successfully"

write_step "Step 6: Starting Firebase emulators"
if open_in_new_terminal "Firebase Emulators" "firebase emulators:start" "$PWD"; then
    write_success "Firebase emulators started in new terminal"
else
    write_success "Firebase emulators started in background"
fi
sleep 3

write_step "Step 7: Starting frontend development server"
if open_in_new_terminal "Frontend Dev Server" "npm run dev" "$PWD/frontend"; then
    write_success "Frontend development server started in new terminal"
else
    write_success "Frontend development server started in background"
fi

echo -e "\e[32mProject startup complete!\e[0m"
echo -e "\e[33mAll services launched in workspace $DEV_WORKSPACE\e[0m"

echo -e "\e[36m=== Service Status ===\e[0m"
echo -e "\e[32m✓ SpaceTimeDB (Rust Backend)\e[0m - Running in workspace $DEV_WORKSPACE"
echo -e "\e[32m✓ Firebase Emulators\e[0m - Running in workspace $DEV_WORKSPACE" 
echo -e "\e[32m✓ Frontend Dev Server\e[0m - Running in workspace $DEV_WORKSPACE"
echo -e "\e[36m======================\e[0m"

echo -e "\e[33mTip: Switch to workspace $DEV_WORKSPACE to see all your dev services\e[0m"
echo -e "\e[33mTip: Use Ctrl+C in each terminal window to stop individual services\e[0m"