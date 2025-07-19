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

decode_jwt() {
    local token="$1"
    IFS='.' read -ra parts <<< "$token"
    
    if [ ${#parts[@]} -ne 3 ]; then
        echo "Invalid JWT token format" >&2
        return 1
    fi
    
    local payload="${parts[1]}"
    while [ $((${#payload} % 4)) -ne 0 ]; do
        payload="${payload}="
    done
    
    echo "$payload" | base64 -d 2>/dev/null || {
        echo "Failed to decode JWT payload" >&2
        return 1
    }
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
gnome-terminal --tab --title="SpaceTimeDB" -- bash -c "spacetime start; exec bash" 2>/dev/null || \
xterm -T "SpaceTimeDB" -e "spacetime start; bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "spacetime start"' 2>/dev/null || {
    echo "Starting SpaceTimeDB in background..."
    spacetime start &
    SPACETIME_PID=$!
}
write_success "SpaceTimeDB started"

echo -e "\e[33mWaiting for SpaceTimeDB to initialize...\e[0m"
sleep 5

write_step "Step 2: Rebuilding database with clean flag"
spacetime publish -c --project-path lunavoxel/server lunavoxel -y
write_success "Database rebuilt successfully"

write_step "Step 3: Generating TypeScript bindings"
spacetime generate --lang typescript --out-dir frontend/src/module_bindings --project-path lunavoxel/server
write_success "TypeScript bindings generated"

write_step "Step 4: Creating new admin identity"
identity_response=$(curl -s -X POST -H "Content-Type: application/json" http://localhost:3000/v1/identity)
token=$(echo "$identity_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$token" ]; then
    write_error "Failed to create identity - no token received"
    exit 1
fi
write_success "New admin identity created"

write_step "Step 5: Updating .env.local file"
mkdir -p functions
cat > functions/.env.local << EOF
SPACETIME_URL=localhost:3000
SPACETIME_TOKEN=$token
EOF
write_success ".env.local updated"

write_step "Step 6: Extracting identity from token"
decoded_token=$(decode_jwt "$token")
hex_identity=$(echo "$decoded_token" | grep -o '"hex_identity":"[^"]*"' | cut -d'"' -f4)
echo -e "\e[33mNew identity hash: $hex_identity\e[0m"

write_step "Step 7: Updating admin user helper"
helper_path="lunavoxel/server/helpers/EnsureIsAdminUser.cs"
if [ ! -f "$helper_path" ]; then
    write_error "EnsureIsAdminUser.cs not found at $helper_path"
    exit 1
fi

hex_identity_lower=$(echo "$hex_identity" | tr '[:upper:]' '[:lower:]')
sed -i.bak "s/var isDev = callerIdentity\.ToLower() == \"[^\"]*\";/var isDev = callerIdentity.ToLower() == \"$hex_identity_lower\";/" "$helper_path"
write_success "Admin user helper updated with new identity"

write_step "Step 8: Updating database without clean flag"
spacetime publish --project-path lunavoxel/server lunavoxel
write_success "Database updated"

write_step "Step 9: Building functions"
cd functions
npm run build
cd ..
write_success "Functions built successfully"

write_step "Step 10: Starting Firebase emulators"
gnome-terminal --tab --title="Firebase Emulators" -- bash -c "firebase emulators:start; exec bash" 2>/dev/null || \
xterm -T "Firebase Emulators" -e "firebase emulators:start; bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "firebase emulators:start"' 2>/dev/null || {
    echo "Starting Firebase emulators in background..."
    firebase emulators:start &
    FIREBASE_PID=$!
}
write_success "Firebase emulators started"
sleep 3

write_step "Step 11: Starting frontend development server"
cd frontend
gnome-terminal --tab --title="Frontend Dev Server" -- bash -c "npm run dev; exec bash" 2>/dev/null || \
xterm -T "Frontend Dev Server" -e "npm run dev; bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd frontend && npm run dev"' 2>/dev/null || {
    echo "Starting frontend development server in background..."
    npm run dev &
    FRONTEND_PID=$!
}
cd ..
write_success "Frontend development server started"

echo -e "\e[32mProject startup complete!\e[0m"
echo -e "\e[33mNew identity token: $token\e[0m"
echo -e "\e[33mIdentity hash: $hex_identity\e[0m"