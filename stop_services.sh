#!/bin/bash

PROJECT_ROOT="${1:-.}"
PID_FILE="$PROJECT_ROOT/.startup_pids"

write_success() {
    echo -e "\e[32m$1\e[0m"
}

write_warning() {
    echo -e "\e[33m$1\e[0m"
}

write_error() {
    echo -e "\e[31m$1\e[0m"
}

if [ ! -f "$PID_FILE" ]; then
    write_warning "No PID file found. Services may not be running or were started in terminals."
    echo "If services are running in terminals, close the terminal windows manually."
    exit 0
fi

write_warning "Stopping all services..."

while IFS=':' read -r service pid; do
    if [ -n "$pid" ]; then
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping $service (PID: $pid)..."
            if kill "$pid" 2>/dev/null; then
                sleep 1
                if kill -0 "$pid" 2>/dev/null; then
                    write_warning "Force killing $service (PID: $pid)..."
                    kill -9 "$pid" 2>/dev/null
                fi
                write_success "$service stopped"
            else
                write_error "Failed to stop $service (PID: $pid)"
            fi
        else
            write_warning "$service (PID: $pid) is not running"
        fi
    fi
done < "$PID_FILE"

rm -f "$PID_FILE"
write_success "All services stopped and PID file cleaned up"