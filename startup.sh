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

# Workspace for development services (change this if you want a different workspace)
DEV_WORKSPACE=2

open_in_new_terminal() {
    local title="$1"
    local command="$2"
    local working_dir="${3:-$PWD}"
    
    # Switch to dev workspace first
    hyprctl dispatch workspace $DEV_WORKSPACE >/dev/null 2>&1
    
    # Common Arch Linux terminals (in order of preference)
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
    elif command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal --tab --title="$title" --working-directory="$working_dir" -- bash -c "$command; echo 'Press Enter to close...'; read; exit" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v terminator >/dev/null 2>&1; then
        terminator --new-tab --title="$title" --working-directory="$working_dir" -e "bash -c '$command; echo Press Enter to close...; read'" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    elif command -v xterm >/dev/null 2>&1; then
        xterm -T "$title" -e "cd '$working_dir' && $command && echo 'Press Enter to close...' && read" &
        sleep 0.5
        hyprctl dispatch movetoworkspacesilent $DEV_WORKSPACE >/dev/null 2>&1
    else
        write_error "No suitable terminal emulator found. Running $title in background..."
        cd "$working_dir"
        eval "$command" &
        cd - >/dev/null
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

write_step "Step 1: Starting SpaceTimeDB"
if open_in_new_terminal "SpaceTimeDB" "spacetime start"; then
    write_success "SpaceTimeDB started in new terminal"
else
    write_success "SpaceTimeDB started in background"
fi

echo -e "\e[33mWaiting for SpaceTimeDB to initialize...\e[0m"
sleep 5

write_step "Step 2: Rebuilding database with clean flag"
spacetime publish -c --project-path lunavoxel/server lunavoxel-db -y
write_success "Database rebuilt successfully"

write_step "Step 3: Generating TypeScript bindings"
spacetime generate --lang typescript --out-dir frontend/src/module_bindings --project-path lunavoxel/server
write_success "TypeScript bindings generated"

write_step "Step 5: Starting frontend development server"
if open_in_new_terminal "Frontend Dev Server" "npm run dev" "$PWD/frontend"; then
    write_success "Frontend development server started in new terminal"
else
    write_success "Frontend development server started in background"
fi

echo -e "\e[32mProject startup complete!\e[0m"
echo -e "\e[33mAll services launched in workspace $DEV_WORKSPACE\e[0m"

echo -e "\e[36m=== Service Status ===\e[0m"
echo -e "\e[32m✓ SpaceTimeDB\e[0m - Running in workspace $DEV_WORKSPACE"
echo -e "\e[32m✓ Frontend Dev Server\e[0m - Running in workspace $DEV_WORKSPACE"
echo -e "\e[36m======================\e[0m"

echo -e "\e[33mTip: Switch to workspace $DEV_WORKSPACE to see all your dev services\e[0m"
echo -e "\e[33mTip: Use Ctrl+C in each terminal window to stop individual services\e[0m"