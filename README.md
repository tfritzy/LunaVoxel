# LunaVoxel

A voxel-based application with frontend and backend components.

## Development

### Testing

The project includes automated tests for both frontend and backend:

- **Frontend tests**: Run with `npm test -- --run` in the `frontend` directory
- **Backend tests**: Run with `dotnet test` in the `lunavoxel/test` directory

### Branch Protection

To ensure code quality, all tests must pass before a PR can be merged. See [Branch Protection Configuration](.github/BRANCH_PROTECTION.md) for setup instructions.

## Repository Structure

- `frontend/` - Frontend application (Node.js/TypeScript)
- `lunavoxel/` - Backend application (.NET/C#)
- `functions/` - Cloud functions
- `.github/workflows/` - CI/CD workflows
