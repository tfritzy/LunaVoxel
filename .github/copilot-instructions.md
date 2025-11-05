# LunaVoxel - Copilot Instructions

## Project Overview

LunaVoxel is a voxel-based block builder application with:
- **Backend**: C# SpacetimeDB module compiled to WASM for game logic
- **Frontend**: React + TypeScript + Vite with Three.js for 3D rendering
- **Cloud Functions**: Firebase Functions (Node.js/TypeScript) for backend services
- **Database**: SpacetimeDB for real-time multiplayer functionality

## Technology Stack

### Backend (C# - SpacetimeDB Module)
- **Language**: C# (.NET 8.0)
- **Runtime**: WASI-WASM
- **Framework**: SpacetimeDB.Runtime
- **Location**: `lunavoxel/server/`
- **Project File**: `lunavoxel/server/StdbModule.csproj`

### Frontend (React + TypeScript)
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui with Radix UI components
- **Styling**: Tailwind CSS v4
- **3D Rendering**: Three.js
- **State Management**: SpacetimeDB SDK for multiplayer state
- **Testing**: Vitest
- **Location**: `frontend/`

### Firebase Functions
- **Language**: TypeScript
- **Runtime**: Node.js v22
- **Framework**: Firebase Functions
- **Location**: `functions/`

## Project Structure

```
LunaVoxel/
├── .github/              # GitHub configuration and workflows
│   ├── workflows/        # CI/CD workflows
│   └── ruleset.json      # Branch protection rules
├── frontend/             # React frontend application
│   ├── src/              # Source code
│   ├── public/           # Static assets
│   ├── package.json      # Dependencies and scripts
│   └── vite.config.js    # Vite configuration (JavaScript)
├── functions/            # Firebase Cloud Functions
│   ├── src/              # Function source code
│   └── package.json      # Dependencies and scripts
├── lunavoxel/            # SpacetimeDB backend module
│   ├── server/           # C# SpacetimeDB module
│   └── test/             # C# unit tests
├── .vscode/              # VS Code configuration
├── firebase.json         # Firebase configuration
└── block-builder.sln     # .NET solution file
```

## Build and Test Commands

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm test             # Run tests
npm test -- --run    # Run tests once (CI mode)
```

### Backend (C# SpacetimeDB Module)
```bash
cd lunavoxel/test
dotnet restore       # Restore dependencies
dotnet build         # Build the project
dotnet test          # Run tests
```

### Firebase Functions
```bash
cd functions
npm install          # Install dependencies
npm run build        # Build TypeScript
npm run lint         # Run ESLint
npm run serve        # Start Firebase emulator
```

## Development Guidelines

### Code Style
- **Frontend**: Follow ESLint configuration with TypeScript strict mode
- **Backend**: Follow C# conventions with nullable reference types enabled
- **Functions**: Follow Google's ESLint config for TypeScript

### Testing
- **Frontend**: Use Vitest for unit and integration tests
- **Backend**: Use xUnit or NUnit for C# tests
- Run tests before committing changes

### CI/CD
- All PRs must pass `test-frontend` and `test-backend` checks
- Tests run automatically on pushes to `main`/`master` branches
- See `.github/workflows/test.yml` for CI configuration

### Git Workflow
- Main branches: `main` or `master`
- Branch protection requires passing tests
- No required reviewers currently configured

## Key Dependencies

### Frontend
- `@clockworklabs/spacetimedb-sdk`: Real-time multiplayer state management
- `three`: 3D rendering engine
- `react-router-dom`: Client-side routing
- `@radix-ui/*`: Accessible UI components
- `firebase`: Firebase authentication and services
- `lz4js`: Compression for network data

### Backend
- `SpacetimeDB.Runtime`: SpacetimeDB module runtime
- `K4os.Compression.LZ4`: LZ4 compression

### Functions
- `firebase-admin`: Firebase Admin SDK
- `firebase-functions`: Cloud Functions runtime
- `canvas`: Server-side canvas rendering

## Important Notes

### When Making Changes
1. **Frontend**: Use `npm ci` for clean installs in CI, `npm install` for development
2. **Backend**: Ensure .NET 8.0 SDK is installed
3. **Tests**: Always run tests locally before pushing
4. **Linting**: Fix linting errors before committing

### File Locations
- Frontend tests: `frontend/src/**/*.test.ts` or `frontend/src/**/*.test.tsx`
- Backend tests: `lunavoxel/test/`
- Ignore files: `.gitignore` excludes `node_modules/`, `wasm/target/`, and build artifacts

### Development Scripts
- `startup.sh`: Automated development environment setup (Linux)
- `startup.ps1`: Development environment setup (Windows PowerShell)
- `stop_services.sh`: Stop all running services

## Firebase Configuration
- Project: Configured in `.firebaserc`
- Storage rules: `storage.rules`
- Functions configuration: `firebase.json`

## Common Tasks

### Adding a New Frontend Component
1. Create component in `frontend/src/components/`
2. Use TypeScript with proper types
3. Follow existing component patterns (use shadcn/ui components)
4. Add tests if the component has complex logic
5. Import and use in your feature

### Adding a New SpacetimeDB Table
1. Define table in `lunavoxel/server/` using SpacetimeDB attributes
2. Rebuild the module
3. Update frontend SDK types if needed
4. Test database operations

### Adding a New Firebase Function
1. Create function in `functions/src/`
2. Export from `functions/src/index.ts`
3. Add tests if applicable
4. Deploy with `npm run deploy`

## Environment Setup
- Node.js: v20 (frontend, as used in CI), v22 (functions)
- .NET: 8.0 SDK
- Firebase CLI: Required for functions development
